/**
 * renderQueue.ts — In-process async render job queue (no Redis needed).
 *
 * Jobs are stored in a module-level Map (survives across requests in the same
 * Node.js process). Rendered MP4 files live in `<cwd>/tmp/render-output/`.
 * Auto-cleanup removes files + job entries older than CLEANUP_AFTER_MS.
 *
 * Concurrency = 1: only one Remotion render runs at a time to avoid OOM
 * on a 2-vCPU / limited-RAM VPS.
 */

import path from "path";
import { mkdir, rm } from "fs/promises";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Constants ────────────────────────────────────────────────────────────────
// Rendered output MP4 files go here (separate from per-job temp upload dirs)
const OUTPUT_DIR = path.join(process.cwd(), "tmp", "render-output");
const CLEANUP_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;   // check every 30 min

// ─── Types ────────────────────────────────────────────────────────────────────
export type JobStatus = "pending" | "rendering" | "done" | "error";

export interface JobState {
  jobId: string;
  status: JobStatus;
  progress: number;       // 0-100
  renderedFrames: number;
  totalFrames: number;
  outputPath: string | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface RenderJobData {
  tempDir: string;
  footageItems: Array<{ url: string; duration: number; startFromSec: number; colorGrade: string }>;
  transitionsList: Array<{ type: string; afterClipIndex: number; duration: number }>;
  subtitleChunksList: Array<{ text: string; start: number; end: number }>;
  voiceOverUrl: string | undefined;
  bgmUrl: string | undefined;
  bgmVolume: number;
  subtitleStyle: string;
  subtitleFontSize: number;
  subtitleBottomPos: number;
  defaultTrimSec: number;
  exportPreset: string;
  aspectRatio: string;
}

// ─── Module-level state ────────────────────────────────────────────────────────
const jobStore = new Map<string, JobState>();
const jobQueue: Array<{ jobId: string; data: RenderJobData }> = [];

let isWorkerRunning = false;
let cleanupTimerStarted = false;

// ─── ffmpeg helper ─────────────────────────────────────────────────────────────
const FFMPEG_PATHS = [
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/usr/bin/ffmpeg",
  "ffmpeg",
];

async function findFfmpeg(): Promise<string | null> {
  for (const bin of FFMPEG_PATHS) {
    try {
      await execAsync(`"${bin}" -version`, { timeout: 5000 });
      return bin;
    } catch { /* try next */ }
  }
  return null;
}

export async function getCachedFfmpeg(): Promise<string | null> {
  if (_cachedFfmpegBin !== undefined) return _cachedFfmpegBin;
  _cachedFfmpegBin = await findFfmpeg();
  return _cachedFfmpegBin;
}

// ─── Public API ────────────────────────────────────────────────────────────────
export function getJob(jobId: string): JobState | undefined {
  return jobStore.get(jobId);
}

export function enqueueJob(jobId: string, data: RenderJobData): JobState {
  const state: JobState = {
    jobId,
    status: "pending",
    progress: 0,
    renderedFrames: 0,
    totalFrames: 0,
    outputPath: null,
    error: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
  jobStore.set(jobId, state);
  jobQueue.push({ jobId, data });

  console.log(`[renderQueue] Job enqueued: ${jobId} (queue length: ${jobQueue.length})`);

  if (!isWorkerRunning) {
    runWorker().catch((err) => {
      console.error("[renderQueue] Worker crashed:", err);
      isWorkerRunning = false;
    });
  }

  if (!cleanupTimerStarted) {
    cleanupTimerStarted = true;
    setInterval(cleanupOldJobs, CLEANUP_INTERVAL_MS);
  }

  return state;
}

// ─── Worker loop ───────────────────────────────────────────────────────────────
async function runWorker() {
  isWorkerRunning = true;
  console.log("[renderQueue] Worker started.");

  await mkdir(OUTPUT_DIR, { recursive: true });

  while (jobQueue.length > 0) {
    const item = jobQueue.shift()!;
    const { jobId, data } = item;
    const job = jobStore.get(jobId);
    if (!job) continue;

    job.status = "rendering";
    job.startedAt = Date.now();
    console.log(`[renderQueue] Processing job: ${jobId}`);

    try {
      const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
      await processRender(job, data, outputPath);
      job.status = "done";
      job.progress = 100;
      job.outputPath = outputPath;
      job.finishedAt = Date.now();
      const elapsed = ((job.finishedAt - job.startedAt!) / 1000).toFixed(1);
      console.log(`[renderQueue] ✓ Job done: ${jobId} (${elapsed}s)`);
    } catch (err: any) {
      job.status = "error";
      job.error = err?.message || "Unknown render error";
      job.finishedAt = Date.now();
      console.error(`[renderQueue] ✗ Job failed: ${jobId}`, err?.message);
      rm(data.tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  isWorkerRunning = false;
  console.log("[renderQueue] Worker idle (queue empty).");
}

// ─── Per-job media file server ────────────────────────────────────────────────
// Remotion's internal proxy only supports http:// and https://.
// We spin up a lightweight HTTP server per render job to serve media files
// from tempDir on a random free port. Server is closed after render completes.
async function startMediaServer(dir: string): Promise<{ baseUrl: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const filename = decodeURIComponent((req.url ?? "/").replace(/^\//, ""));
        const filepath = path.join(dir, filename);
        const stat = statSync(filepath);
        res.writeHead(200, {
          "Content-Length": stat.size,
          "Content-Type": "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        createReadStream(filepath).pipe(res);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      console.log(`[renderQueue] Media server started on port ${port} for dir: ${path.basename(dir)}`);
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
    server.on("error", reject);
  });
}

// ─── Core render logic ─────────────────────────────────────────────────────────
// Build a fresh Remotion bundle per job with publicDir pointing to tempDir.
// This is the original proven approach — Remotion serves media via its own
// HTTP server, so filenames like "footage_0.MOV" resolve correctly via staticFile().
async function processRender(job: JobState, data: RenderJobData, outputPath: string) {
  const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");

  console.log(`[renderQueue] Building Remotion bundle for job ${job.jobId}...`);
  const serveUrl = await bundle({
    entryPoint,
    ignoreRegisterRootWarning: true,
    publicDir: data.tempDir, // ← media files served by Remotion's own HTTP server
  });
  console.log(`[renderQueue] ✓ Bundle ready`);

  try {
    const {
      footageItems, transitionsList, subtitleChunksList,
      voiceOverUrl, bgmUrl, bgmVolume,
      subtitleStyle, subtitleFontSize, subtitleBottomPos,
      defaultTrimSec, exportPreset, aspectRatio,
    } = data;

    const inputProps = {
      footages: footageItems,       // urls are plain filenames, staticFile() resolves them
      transitions: transitionsList,
      subtitles: subtitleChunksList,
      voiceOverUrl,
      bgmUrl,
      bgmVolume,
      subtitleStyle,
      subtitleFontSize,
      subtitleBottomPos,
      clipDuration: defaultTrimSec,
    };

    const composition = await selectComposition({ serveUrl, id: "MainComposition", inputProps });

    let targetWidth = 720, targetHeight = 1280, targetFps = 30;
    if (exportPreset === "1080p") {
      targetFps = 60;
      if (aspectRatio === "9:16") { targetWidth = 1080; targetHeight = 1920; }
      else if (aspectRatio === "16:9") { targetWidth = 1920; targetHeight = 1080; }
      else { targetWidth = 1080; targetHeight = 1080; }
    } else if (exportPreset === "480p") {
      targetFps = 30;
      if (aspectRatio === "9:16") { targetWidth = 480; targetHeight = 854; }
      else if (aspectRatio === "16:9") { targetWidth = 854; targetHeight = 480; }
      else { targetWidth = 480; targetHeight = 480; }
    } else {
      if (aspectRatio === "9:16") { targetWidth = 720; targetHeight = 1280; }
      else if (aspectRatio === "16:9") { targetWidth = 1280; targetHeight = 720; }
      else { targetWidth = 720; targetHeight = 720; }
    }

    composition.width = targetWidth;
    composition.height = targetHeight;
    composition.fps = targetFps;

    let totalFrames = 0;
    for (const f of footageItems) {
      totalFrames += Math.max(1, Math.round((f.duration || defaultTrimSec || 3) * targetFps));
    }
    composition.durationInFrames = Math.max(targetFps, totalFrames);
    job.totalFrames = composition.durationInFrames;

    console.log(`[renderQueue] Rendering: ${composition.durationInFrames} frames @ ${targetWidth}x${targetHeight} ${targetFps}fps`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      concurrency: 1,
      chromiumOptions: { enableMultiProcessOnLinux: true },
      onProgress: ({ renderedFrames }) => {
        job.renderedFrames = renderedFrames;
        job.progress = Math.round((renderedFrames / composition.durationInFrames) * 100);
        if (renderedFrames % 30 === 0 || renderedFrames === composition.durationInFrames) {
          console.log(`[renderQueue] 🎬 ${job.jobId}: ${job.progress}% (${renderedFrames}/${composition.durationInFrames})`);
        }
      },
    });
  } finally {
    // Always cleanup temp dir (media files) after render completes or fails
    rm(data.tempDir, { recursive: true, force: true }).catch(() => {});
    // Also cleanup the webpack bundle dir created by bundle()
    rm(serveUrl, { recursive: true, force: true }).catch(() => {});
  }
}


  // Start per-job HTTP media server so Remotion's proxy can access files
  const { baseUrl, close: closeMediaServer } = await startMediaServer(data.tempDir);

  // Remap any URL format to http://127.0.0.1:<port>/<filename>
  const toMediaUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    const filename = url.split("/").pop()!;
    return `${baseUrl}/${filename}`;
  };

  try {
    const {
      footageItems, transitionsList, subtitleChunksList,
      voiceOverUrl, bgmUrl, bgmVolume,
      subtitleStyle, subtitleFontSize, subtitleBottomPos,
      defaultTrimSec, exportPreset, aspectRatio,
    } = data;

    const remappedFootages = footageItems.map(f => ({ ...f, url: toMediaUrl(f.url)! }));

    const inputProps = {
      footages: remappedFootages,
      transitions: transitionsList,
      subtitles: subtitleChunksList,
      voiceOverUrl: toMediaUrl(voiceOverUrl),
      bgmUrl: toMediaUrl(bgmUrl),
      bgmVolume,
      subtitleStyle,
      subtitleFontSize,
      subtitleBottomPos,
      clipDuration: defaultTrimSec,
    };

    const composition = await selectComposition({ serveUrl, id: "MainComposition", inputProps });

    let targetWidth = 720, targetHeight = 1280, targetFps = 30;
    if (exportPreset === "1080p") {
      targetFps = 60;
      if (aspectRatio === "9:16") { targetWidth = 1080; targetHeight = 1920; }
      else if (aspectRatio === "16:9") { targetWidth = 1920; targetHeight = 1080; }
      else { targetWidth = 1080; targetHeight = 1080; }
    } else if (exportPreset === "480p") {
      targetFps = 30;
      if (aspectRatio === "9:16") { targetWidth = 480; targetHeight = 854; }
      else if (aspectRatio === "16:9") { targetWidth = 854; targetHeight = 480; }
      else { targetWidth = 480; targetHeight = 480; }
    } else {
      if (aspectRatio === "9:16") { targetWidth = 720; targetHeight = 1280; }
      else if (aspectRatio === "16:9") { targetWidth = 1280; targetHeight = 720; }
      else { targetWidth = 720; targetHeight = 720; }
    }

    composition.width = targetWidth;
    composition.height = targetHeight;
    composition.fps = targetFps;

    let totalFrames = 0;
    for (const f of footageItems) {
      totalFrames += Math.max(1, Math.round((f.duration || defaultTrimSec || 3) * targetFps));
    }
    composition.durationInFrames = Math.max(targetFps, totalFrames);
    job.totalFrames = composition.durationInFrames;

    console.log(`[renderQueue] Rendering: ${composition.durationInFrames} frames @ ${targetWidth}x${targetHeight} ${targetFps}fps`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      concurrency: 1,
      chromiumOptions: { enableMultiProcessOnLinux: true },
      onProgress: ({ renderedFrames }) => {
        job.renderedFrames = renderedFrames;
        job.progress = Math.round((renderedFrames / composition.durationInFrames) * 100);
        if (renderedFrames % 30 === 0 || renderedFrames === composition.durationInFrames) {
          console.log(`[renderQueue] 🎬 ${job.jobId}: ${job.progress}% (${renderedFrames}/${composition.durationInFrames})`);
        }
      },
    });
  } finally {
    // Always close media server & cleanup temp dir, even if render failed
    closeMediaServer();
    rm(data.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}


// ─── Cleanup old jobs ──────────────────────────────────────────────────────────
async function cleanupOldJobs() {
  const now = Date.now();
  for (const [jobId, job] of jobStore.entries()) {
    if (now - job.createdAt > CLEANUP_AFTER_MS) {
      if (job.outputPath) rm(job.outputPath, { force: true }).catch(() => {});
      jobStore.delete(jobId);
      console.log(`[renderQueue] Cleaned up old job: ${jobId}`);
    }
  }
}
