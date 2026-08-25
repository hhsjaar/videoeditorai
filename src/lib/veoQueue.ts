/**
 * veoQueue.ts — Async job queue for Gemini Veo text-to-video generation.
 *
 * Modeled on renderQueue.ts's enqueue/status/persist pattern, but far simpler:
 * no Lambda/S3, just a direct Gemini API call. `generateVideos` kicks off a
 * long-running operation (11s–6min per Google's docs); we poll it in the
 * background and, once done, download the result to data/veo-output/.
 *
 * Output deliberately lives OUTSIDE public/, not inside it: a `next start`
 * production server does not pick up files added to public/ after boot (only
 * what existed there at build/start time is served — anything written later
 * 404s). Files here are instead streamed by /api/video-ai/file/[jobId],
 * a normal dynamic route handler that reads the file fresh on every request.
 */

import path from "path";
import { mkdir, rm, readdir, stat } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { GoogleGenAI } from "@google/genai";
import { loadPersistedJobs, persistJobs } from "./jobPersistence";
import { QUALITY_TO_MODEL, type VeoQuality } from "./veoPricing";
import { getCachedFfmpeg } from "./renderQueue";

const execAsync = promisify(exec);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const JOBS_FILE = "veo-jobs.json";
export const OUTPUT_DIR = path.join(process.cwd(), "data", "veo-output");
const POLL_INTERVAL_MS = 10_000; // matches Google's own recommended poll cadence
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — generated clips are large, keep window short

export type { VeoQuality };

export type VeoJobStatus = "pending" | "generating" | "done" | "error";

export interface VeoJobState {
  jobId: string;
  status: VeoJobStatus;
  prompt: string;
  quality: VeoQuality;
  durationSeconds: number;
  aspectRatio: string;
  operationName: string | null;
  videoUrl: string | null;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
}

const jobStore = new Map<string, VeoJobState>();
let cleanupTimerStarted = false;

function scheduleSave() {
  const plain: Record<string, VeoJobState> = {};
  for (const [id, job] of jobStore.entries()) plain[id] = job;
  persistJobs(plain, JOBS_FILE).catch(() => {});
}

async function restoreFromDisk() {
  const persisted = await loadPersistedJobs<VeoJobState>(JOBS_FILE);
  for (const job of Object.values(persisted)) {
    jobStore.set(job.jobId, job);
    // A job still mid-flight when the server died has no way to resume (we don't
    // persist the in-memory poll loop) — surface it as an error rather than hang forever.
    if (job.status === "pending" || job.status === "generating") {
      job.status = "error";
      job.error = "Proses generate terputus karena server restart — silakan generate ulang.";
      job.finishedAt = Date.now();
    }
  }
  scheduleSave();

  if (!cleanupTimerStarted) {
    cleanupTimerStarted = true;
    setInterval(cleanupOldJobs, 60 * 60 * 1000);
  }
}

const restorePromise = restoreFromDisk().catch((err) =>
  console.error("[veoQueue] Failed to restore jobs from disk:", err)
);

export async function getVeoJob(jobId: string): Promise<VeoJobState | undefined> {
  await restorePromise;
  return jobStore.get(jobId);
}

export function enqueueVeoJob(params: {
  jobId: string;
  prompt: string;
  quality: VeoQuality;
  durationSeconds: number;
  aspectRatio: string;
}): VeoJobState {
  const state: VeoJobState = {
    jobId: params.jobId,
    status: "pending",
    prompt: params.prompt,
    quality: params.quality,
    durationSeconds: params.durationSeconds,
    aspectRatio: params.aspectRatio,
    operationName: null,
    videoUrl: null,
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
  };
  jobStore.set(state.jobId, state);
  scheduleSave();

  runJob(state).catch((err) => {
    console.error(`[veoQueue] Unexpected error running job ${state.jobId}:`, err);
  });

  return state;
}

const MAX_ATTEMPTS = 3; // 1 initial + 2 automatic retries
const RETRY_DELAY_MS = 8_000;

// Google's Veo backend intermittently returns a generic "internal server
// issue" (its own message literally says "please try again in a few
// minutes") — this is transient noise, not a real failure, and happens for
// a meaningful fraction of requests. Retry automatically rather than
// forcing the user to notice and click "Coba lagi" every time. Content
// safety rejections and hard API errors (bad args, quota) won't succeed on
// retry, so those are NOT retried — only the transient message is.
function isRetryableError(message: string): boolean {
  return /internal server issue|please try again/i.test(message);
}

async function attemptGenerate(job: VeoJobState): Promise<{ video: any }> {
  const model = QUALITY_TO_MODEL[job.quality];
  let operation = await genai.models.generateVideos({
    model,
    source: { prompt: job.prompt },
    config: {
      numberOfVideos: 1,
      durationSeconds: job.durationSeconds,
      aspectRatio: job.aspectRatio,
      // NOTE: generateAudio and personGeneration are Vertex-only knobs —
      // the Gemini Developer API (what GEMINI_API_KEY authenticates
      // against) generates native audio by default on Veo 3.x models and
      // rejects both fields if set explicitly, so leave them unset here.
    },
  });
  job.operationName = operation.name || null;
  scheduleSave();

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    operation = await genai.operations.getVideosOperation({ operation });
  }

  if (operation.error) {
    const msg = typeof operation.error.message === "string" ? operation.error.message : "Video generation gagal di sisi Gemini.";
    throw new Error(msg);
  }

  const generated = operation.response?.generatedVideos?.[0];
  if (!generated?.video) {
    const raiReason = operation.response?.raiMediaFilteredReasons?.[0];
    throw new Error(raiReason || "Gemini tidak mengembalikan video (kemungkinan diblokir filter keamanan konten).");
  }

  return { video: generated.video };
}

async function runJob(job: VeoJobState) {
  job.status = "generating";
  scheduleSave();

  try {
    let generated: { video: any } | null = null;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        generated = await attemptGenerate(job);
        break;
      } catch (err: any) {
        lastErr = err;
        const retryable = isRetryableError(err?.message || "");
        console.warn(`[veoQueue] Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${job.jobId}${retryable ? ", retrying..." : " (not retryable)"}:`, err?.message);
        if (!retryable || attempt === MAX_ATTEMPTS) throw err;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    if (!generated) throw lastErr || new Error("Gagal generate video.");

    await mkdir(OUTPUT_DIR, { recursive: true });
    const outPath = path.join(OUTPUT_DIR, `${job.jobId}.mp4`);
    const rawPath = path.join(OUTPUT_DIR, `${job.jobId}.raw.mp4`);
    await genai.files.download({ file: generated.video, downloadPath: rawPath });

    // Veo's raw download writes the moov atom at the END of the file (not
    // "faststart"), which makes HTML5 <video> show a black frame / 0:00
    // duration until the whole file has downloaded. Remux (no re-encode) to
    // move moov to the front so it streams/plays immediately in-browser.
    const ffmpegBin = await getCachedFfmpeg();
    if (ffmpegBin) {
      try {
        await execAsync(`"${ffmpegBin}" -y -i "${rawPath}" -c copy -movflags +faststart "${outPath}"`, { timeout: 60000 });
        await rm(rawPath, { force: true });
      } catch (remuxErr: any) {
        console.warn(`[veoQueue] faststart remux failed for ${job.jobId}, serving raw file:`, remuxErr?.message?.slice(0, 200));
        await rm(outPath, { force: true }).catch(() => {});
        const { rename } = await import("fs/promises");
        await rename(rawPath, outPath);
      }
    } else {
      const { rename } = await import("fs/promises");
      await rename(rawPath, outPath);
    }

    job.status = "done";
    job.videoUrl = `/api/video-ai/file/${job.jobId}`;
    job.finishedAt = Date.now();
    scheduleSave();
  } catch (err: any) {
    job.status = "error";
    job.error = err?.message || "Gagal generate video.";
    job.finishedAt = Date.now();
    scheduleSave();
    console.error(`[veoQueue] Job failed: ${job.jobId}`, err?.message);
  }
}

async function cleanupOldJobs() {
  const now = Date.now();
  let changed = false;
  for (const [jobId, job] of jobStore.entries()) {
    if (now - job.createdAt > HISTORY_RETENTION_MS) {
      jobStore.delete(jobId);
      changed = true;
      rm(path.join(OUTPUT_DIR, `${jobId}.mp4`), { force: true }).catch(() => {});
    }
  }
  if (changed) scheduleSave();

  // Also sweep orphaned files (job entry gone but file survived a crash mid-write).
  try {
    const knownIds = new Set(jobStore.keys());
    const files = await readdir(OUTPUT_DIR).catch(() => [] as string[]);
    for (const file of files) {
      const id = file.replace(/\.mp4$/, "");
      if (!knownIds.has(id)) {
        const filePath = path.join(OUTPUT_DIR, file);
        const info = await stat(filePath).catch(() => null);
        if (info && now - info.mtimeMs > HISTORY_RETENTION_MS) {
          await rm(filePath, { force: true }).catch(() => {});
        }
      }
    }
  } catch { /* best-effort */ }
}
