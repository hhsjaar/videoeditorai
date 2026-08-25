/**
 * renderQueue.ts — Async render job queue, backed by AWS Lambda + persisted to disk.
 *
 * Architecture:
 * - Rendering runs on AWS Lambda via Remotion Lambda (renderMediaOnLambda), not locally.
 * - Per-job media files are uploaded to the Remotion Lambda S3 bucket and referenced
 *   via short-lived presigned URLs, since the Lambda function cannot reach this VPS.
 * - Multiple jobs (from different users) can be in flight at once. Each job's Lambda
 *   chunk count is decided at DISPATCH time by dividing the account's safe concurrency
 *   budget among the jobs already running — busier moments give new jobs a smaller
 *   (but never zero) slice, so everyone renders in parallel instead of queueing behind
 *   one user. A job only waits in `jobQueue` if literally no budget is free at all.
 *   (A running job's own chunk count can't be changed after it's dispatched — the
 *   Lambda invocations are already in flight — so this only balances NEW dispatches.)
 * - Job state is persisted to disk (data/jobs.json) so it survives server restarts:
 *   jobs already dispatched to Lambda resume polling (and keep occupying their
 *   budget slice), jobs still queued locally are re-dispatched through the same
 *   budget-aware path (their temp media directory is preserved on disk).
 */

import path from "path";
import { rm } from "fs/promises";
import { readFile, access } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { renderMediaOnLambda, getRenderProgress, presignUrl, type AwsRegion } from "@remotion/lambda/client";
import { loadPersistedJobs, persistJobs } from "./jobPersistence";

const execAsync = promisify(exec);

// ─── Lambda / S3 configuration ─────────────────────────────────────────────────
const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion;
const FUNCTION_NAME = process.env.REMOTION_LAMBDA_FUNCTION_NAME || "";
const SERVE_URL = process.env.REMOTION_SERVE_URL || "";
const INPUT_BUCKET = process.env.REMOTION_S3_BUCKET || "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || "",
  },
});

const INPUT_PRESIGN_EXPIRY_SEC = 4 * 60 * 60; // 4h — generous headroom for Lambda cold starts/retries
const OUTPUT_PRESIGN_EXPIRY_SEC = 24 * 60 * 60; // 24h — refreshed on-demand for history views beyond that
const POLL_INTERVAL_MS = 2000;
const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // keep history entries for 30 days

// ─── Shared Lambda concurrency budget (multi-user aware) ──────────────────────
// AWS accounts start with a Lambda concurrency quota as low as 10 (this project's
// account is one of them — see `npx remotion lambda quotas`). Empirically, 6 chunks
// + 1 orchestrator (7 total) render reliably on this account; 8 chunks (9 total) gets
// throttled ("Rate Exceeded"). ACCOUNT_BUDGET is the safe account-wide ceiling; raise
// it (env var) once `npx remotion lambda quotas` reports a higher approved limit.
const ACCOUNT_BUDGET = parseInt(process.env.REMOTION_LAMBDA_ACCOUNT_BUDGET || "7", 10);
const MAX_CHUNKS_PER_JOB = parseInt(process.env.REMOTION_LAMBDA_MAX_CHUNKS_PER_JOB || "6", 10);
const MIN_CHUNKS_PER_JOB = 1;
const ORCHESTRATOR_OVERHEAD_PER_JOB = 1; // each dispatched job also holds its own "launch" invocation
const DEFAULT_FRAMES_PER_LAMBDA = 20;

// How many chunks (parallel Lambda invocations) a *new* job should get right now,
// given how much of the account budget is already held by currently-active jobs.
// Never returns less than MIN_CHUNKS_PER_JOB; returns null if there isn't even
// room for one more job (MIN_CHUNKS_PER_JOB + its own orchestrator slot).
function allocateChunksForNewJob(): number | null {
  const activeCount = activeChunkAllocations.size;
  const usedBudget = sumActiveChunks() + activeCount * ORCHESTRATOR_OVERHEAD_PER_JOB;
  const availableForNew = ACCOUNT_BUDGET - usedBudget - ORCHESTRATOR_OVERHEAD_PER_JOB;
  if (availableForNew < MIN_CHUNKS_PER_JOB) return null;

  const activeCountIncludingNew = activeCount + 1;
  const fairShare = Math.floor(ACCOUNT_BUDGET / activeCountIncludingNew) - ORCHESTRATOR_OVERHEAD_PER_JOB;
  return Math.max(MIN_CHUNKS_PER_JOB, Math.min(MAX_CHUNKS_PER_JOB, fairShare, availableForNew));
}

function sumActiveChunks(): number {
  let total = 0;
  for (const chunks of activeChunkAllocations.values()) total += chunks;
  return total;
}

function computeFramesPerLambda(totalFrames: number, chunks: number): number {
  return Math.max(DEFAULT_FRAMES_PER_LAMBDA, Math.ceil(totalFrames / chunks));
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type JobStatus = "pending" | "rendering" | "done" | "error";

export interface JobState {
  jobId: string;
  status: JobStatus;
  progress: number;
  renderedFrames: number;
  totalFrames: number;
  outputUrl: string | null;
  outKey: string | null;
  outBucket: string | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  // Lambda render handle — lets us resume polling after a server restart.
  renderId: string | null;
  bucketName: string | null;
  // How many concurrent Lambda chunks this job was given at dispatch time (null until dispatched).
  allocatedChunks: number | null;
  // History metadata
  title: string;
  aspectRatio: string;
  exportPreset: string;
  // Only present while status is "pending" (needed to (re-)dispatch to Lambda).
  // Cleared once dispatched to keep the persisted file small.
  data: RenderJobData | null;
}

export interface RenderJobData {
  tempDir: string;
  footageItems: Array<{ url: string; duration: number; startFromSec: number; colorGrade: string; isImage?: boolean }>;
  transitionsList: Array<{ type: string; afterClipIndex: number; duration: number }>;
  subtitleChunksList: Array<{ text: string; start: number; end: number }>;
  overlayItems: Array<{ url: string; position: string; sizePercent: number; opacity: number; startSec: number; endSec: number; isVideo: boolean; x?: number; y?: number }>;
  titleConfig?: any;
  voiceOverUrl: string | undefined;
  bgmUrl: string | undefined;
  bgmVolume: number;
  subtitleStyle: string;
  subtitleFontSize: number;
  subtitleBottomPos: number;
  defaultTrimSec: number;
  exportPreset: string;
  aspectRatio: string;
  title?: string;
}

// ─── Module-level state ────────────────────────────────────────────────────────
const jobStore = new Map<string, JobState>();
const jobQueue: string[] = []; // FIFO — jobs waiting for a free budget slot
const activeChunkAllocations = new Map<string, number>(); // jobId -> chunks currently held on Lambda

let cleanupTimerStarted = false;

// ─── Persistence helpers ────────────────────────────────────────────────────────
function scheduleSave() {
  const plain: Record<string, JobState> = {};
  for (const [id, job] of jobStore.entries()) plain[id] = job;
  persistJobs(plain).catch(() => {});
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

// Resume in-flight/queued jobs after a process restart.
async function restoreFromDisk() {
  const persisted = await loadPersistedJobs<JobState>();
  const jobs = Object.values(persisted).sort((a, b) => a.createdAt - b.createdAt);

  for (const job of jobs) {
    jobStore.set(job.jobId, job);

    if (job.status !== "pending" && job.status !== "rendering") {
      continue; // terminal (done/error) — just keep as history
    }

    if (job.renderId && job.bucketName) {
      // Already dispatched to Lambda before the restart — resume polling, don't re-render.
      // Re-occupy its budget slice so newly-arriving jobs don't over-allocate on top of it.
      activeChunkAllocations.set(job.jobId, job.allocatedChunks || MIN_CHUNKS_PER_JOB);
      console.log(`[renderQueue] Resuming in-flight Lambda render after restart: ${job.jobId}`);
      resumePolling(job).catch((err) => {
        job.status = "error";
        job.error = err?.message || "Render terputus dan gagal di-resume setelah server restart.";
        job.finishedAt = Date.now();
        scheduleSave();
      });
    } else if (job.data) {
      // Never made it to Lambda (killed during upload/dispatch, or still queued) — safe to redo from scratch.
      const stillHasFiles = await dirExists(job.data.tempDir);
      if (stillHasFiles) {
        console.log(`[renderQueue] Re-queueing job after restart (not yet dispatched to Lambda): ${job.jobId}`);
        job.status = "pending";
        jobQueue.push(job.jobId);
      } else {
        job.status = "error";
        job.error = "File sementara hilang setelah server restart — silakan upload ulang.";
        job.finishedAt = Date.now();
      }
    } else {
      // Lost cause: no renderId to resume and no source data to redo.
      job.status = "error";
      job.error = "Render terputus karena server restart.";
      job.finishedAt = Date.now();
    }
  }

  scheduleSave();
  pumpQueue();

  if (!cleanupTimerStarted) {
    cleanupTimerStarted = true;
    setInterval(cleanupOldJobs, 30 * 60 * 1000);
  }
}

const restorePromise = restoreFromDisk().catch((err) => console.error("[renderQueue] Failed to restore jobs from disk:", err));

// ─── ffmpeg helper (used by render-video route to pre-trim before upload) ─────
const FFMPEG_PATHS = [
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/usr/bin/ffmpeg",
  "ffmpeg",
];

let _cachedFfmpegBin: string | null | undefined = undefined;

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
export async function getJob(jobId: string): Promise<JobState | undefined> {
  await restorePromise;
  return jobStore.get(jobId);
}

export async function listJobHistory(limit = 50): Promise<JobState[]> {
  await restorePromise;
  return Array.from(jobStore.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

// Regenerates a fresh presigned URL from the stored S3 key (the cached one may
// have expired — this is what makes history entries downloadable long-term).
export async function getFreshDownloadUrl(jobId: string): Promise<string | null> {
  const job = jobStore.get(jobId);
  if (!job || job.status !== "done" || !job.outKey || !job.outBucket) return null;
  const url = await presignUrl({
    region: REGION,
    bucketName: job.outBucket,
    objectKey: job.outKey,
    expiresInSeconds: OUTPUT_PRESIGN_EXPIRY_SEC,
  });
  job.outputUrl = url;
  scheduleSave();
  return url;
}

export function enqueueJob(jobId: string, data: RenderJobData): JobState {
  const state: JobState = {
    jobId,
    status: "pending",
    progress: 0,
    renderedFrames: 0,
    totalFrames: 0,
    outputUrl: null,
    outKey: null,
    outBucket: null,
    error: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    renderId: null,
    bucketName: null,
    allocatedChunks: null,
    title: data.title?.trim() || `Render ${new Date().toLocaleDateString("id-ID")}`,
    aspectRatio: data.aspectRatio,
    exportPreset: data.exportPreset,
    data,
  };
  jobStore.set(jobId, state);
  jobQueue.push(jobId);
  scheduleSave();

  console.log(`[renderQueue] Job enqueued: ${jobId} (queue length: ${jobQueue.length})`);

  if (!cleanupTimerStarted) {
    cleanupTimerStarted = true;
    setInterval(cleanupOldJobs, 30 * 60 * 1000);
  }

  pumpQueue();

  return state;
}

// ─── Queue pump: dispatch as many waiting jobs as the shared budget allows ─────
// Strictly FIFO — if the job at the front of the queue can't be allocated a slot,
// stop (later, smaller jobs don't jump the line). As soon as any active job
// finishes and releases its slice, this runs again and the queue drains further.
function pumpQueue() {
  while (jobQueue.length > 0) {
    const chunks = allocateChunksForNewJob();
    if (chunks === null) break; // no room right now — front job waits

    const jobId = jobQueue.shift()!;
    const job = jobStore.get(jobId);
    if (!job || !job.data) continue; // stale entry, skip

    activeChunkAllocations.set(jobId, chunks);
    runJob(job, job.data, chunks).catch((err) => {
      console.error(`[renderQueue] Unexpected error running job ${jobId}:`, err);
    });
  }
}

// ─── Per-job execution ──────────────────────────────────────────────────────────
async function runJob(job: JobState, data: RenderJobData, chunks: number) {
  job.status = "rendering";
  job.startedAt = Date.now();
  job.allocatedChunks = chunks;
  scheduleSave();
  console.log(`[renderQueue] Dispatching job: ${job.jobId} (${chunks} chunks — ${activeChunkAllocations.size} job(s) active, ${sumActiveChunks()}/${ACCOUNT_BUDGET} budget used)`);

  try {
    const { renderId, bucketName } = await dispatchToLambda(job, data, chunks);
    job.renderId = renderId;
    job.bucketName = bucketName;
    job.data = null; // no longer needed — free it up in the persisted file
    scheduleSave();

    const outputUrl = await pollUntilDone(job, renderId, bucketName);
    job.status = "done";
    job.progress = 100;
    job.outputUrl = outputUrl;
    job.finishedAt = Date.now();
    const elapsed = ((job.finishedAt - job.startedAt!) / 1000).toFixed(1);
    console.log(`[renderQueue] ✓ Job done: ${job.jobId} (${elapsed}s, ${chunks} chunks)`);
  } catch (err: any) {
    job.status = "error";
    job.error = err?.message || "Unknown render error";
    job.finishedAt = Date.now();
    job.data = null;
    console.error(`[renderQueue] ✗ Job failed: ${job.jobId}`, err?.message);
  } finally {
    rm(data.tempDir, { recursive: true, force: true }).catch(() => {});
    deleteS3Prefix(`renders/${job.jobId}/`).catch(() => {});
    activeChunkAllocations.delete(job.jobId);
    scheduleSave();
    pumpQueue(); // release our slice back to the pool and let waiting jobs in
  }
}

// Resume polling a job that was already dispatched to Lambda before a restart.
async function resumePolling(job: JobState) {
  try {
    const outputUrl = await pollUntilDone(job, job.renderId!, job.bucketName!);
    job.status = "done";
    job.progress = 100;
    job.outputUrl = outputUrl;
    job.finishedAt = Date.now();
    scheduleSave();
  } finally {
    deleteS3Prefix(`renders/${job.jobId}/`).catch(() => {});
    activeChunkAllocations.delete(job.jobId);
    scheduleSave();
    pumpQueue();
  }
}

// ─── S3 helpers ─────────────────────────────────────────────────────────────────
async function uploadAndPresign(jobId: string, tempDir: string, filename: string): Promise<string> {
  const localPath = path.join(tempDir, filename);
  const key = `renders/${jobId}/${filename}`;
  const body = await readFile(localPath);

  await s3.send(new PutObjectCommand({
    Bucket: INPUT_BUCKET,
    Key: key,
    Body: body,
  }));

  return presignUrl({
    region: REGION,
    bucketName: INPUT_BUCKET,
    objectKey: key,
    expiresInSeconds: INPUT_PRESIGN_EXPIRY_SEC,
  });
}

async function deleteS3Prefix(prefix: string) {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: INPUT_BUCKET, Prefix: prefix }));
  const objects = (listed.Contents || []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
  if (objects.length === 0) return;
  await s3.send(new DeleteObjectsCommand({ Bucket: INPUT_BUCKET, Delete: { Objects: objects } }));
}

// ─── Core render logic ─────────────────────────────────────────────────────────
async function dispatchToLambda(job: JobState, data: RenderJobData, chunks: number): Promise<{ renderId: string; bucketName: string }> {
  if (!FUNCTION_NAME || !SERVE_URL || !INPUT_BUCKET) {
    throw new Error("Remotion Lambda belum dikonfigurasi (REMOTION_LAMBDA_FUNCTION_NAME / REMOTION_SERVE_URL / REMOTION_S3_BUCKET kosong).");
  }

  const {
    footageItems, transitionsList, subtitleChunksList,
    voiceOverUrl, bgmUrl, bgmVolume,
    subtitleStyle, subtitleFontSize, subtitleBottomPos,
    defaultTrimSec, exportPreset, aspectRatio,
  } = data;

  // Upload every referenced local file to S3 once and reuse the presigned URL for repeats.
  const urlCache = new Map<string, string>();
  const toMediaUrl = async (filename: string | undefined): Promise<string | undefined> => {
    if (!filename) return undefined;
    const base = filename.split("/").pop()!;
    if (urlCache.has(base)) return urlCache.get(base);
    const url = await uploadAndPresign(job.jobId, data.tempDir, base);
    urlCache.set(base, url);
    return url;
  };

  const footages = await Promise.all(footageItems.map(async (f) => ({ ...f, url: (await toMediaUrl(f.url))! })));
  const overlays = await Promise.all((data.overlayItems || []).map(async (o) => ({ ...o, url: (await toMediaUrl(o.url))! })));
  const voiceOver = await toMediaUrl(voiceOverUrl);
  const bgm = await toMediaUrl(bgmUrl);

  const inputProps = {
    footages,
    transitions: transitionsList,
    subtitles: subtitleChunksList,
    overlays,
    titleConfig: data.titleConfig,
    voiceOverUrl: voiceOver,
    bgmUrl: bgm,
    bgmVolume,
    subtitleStyle,
    subtitleFontSize,
    subtitleBottomPos,
    clipDuration: defaultTrimSec,
  };

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
  } else { // 720p default
    if (aspectRatio === "9:16") { targetWidth = 720; targetHeight = 1280; }
    else if (aspectRatio === "16:9") { targetWidth = 1280; targetHeight = 720; }
    else { targetWidth = 720; targetHeight = 720; }
  }

  let totalFrames = 0;
  for (const f of footageItems) {
    totalFrames += Math.max(1, Math.round((f.duration || defaultTrimSec || 3) * targetFps));
  }
  totalFrames = Math.max(targetFps, totalFrames);
  job.totalFrames = totalFrames;

  const framesPerLambda = computeFramesPerLambda(totalFrames, chunks);
  console.log(`[renderQueue] Rendering on Lambda: ${totalFrames} frames @ ${targetWidth}x${targetHeight} ${targetFps}fps (${framesPerLambda} frames/chunk, ${chunks} chunks allocated)`);

  return renderMediaOnLambda({
    region: REGION,
    functionName: FUNCTION_NAME,
    serveUrl: SERVE_URL,
    composition: "MainComposition",
    inputProps,
    codec: "h264",
    forceWidth: targetWidth,
    forceHeight: targetHeight,
    forceFps: targetFps,
    forceDurationInFrames: totalFrames,
    framesPerLambda,
    privacy: "private",
    downloadBehavior: { type: "download", fileName: `AutoVideo_${job.jobId.slice(-8)}.mp4` },
  });
}

// Poll until the Lambda-orchestrated render finishes.
async function pollUntilDone(job: JobState, renderId: string, bucketName: string): Promise<string> {
  for (;;) {
    const progress = await getRenderProgress({ functionName: FUNCTION_NAME, bucketName, renderId, region: REGION });

    job.progress = Math.round((progress.overallProgress || 0) * 100);
    job.renderedFrames = progress.framesRendered || 0;
    scheduleSave();

    if (progress.fatalErrorEncountered) {
      const msg = progress.errors?.[0]?.message || "Lambda render failed.";
      throw new Error(msg);
    }

    if (progress.done) {
      if (!progress.outKey || !progress.outBucket) {
        throw new Error("Render selesai tapi output tidak ditemukan di S3.");
      }
      job.outKey = progress.outKey;
      job.outBucket = progress.outBucket;
      return presignUrl({
        region: REGION,
        bucketName: progress.outBucket,
        objectKey: progress.outKey,
        expiresInSeconds: OUTPUT_PRESIGN_EXPIRY_SEC,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// ─── Cleanup old jobs ──────────────────────────────────────────────────────────
async function cleanupOldJobs() {
  const now = Date.now();
  let changed = false;
  for (const [jobId, job] of jobStore.entries()) {
    if (now - job.createdAt > HISTORY_RETENTION_MS) {
      jobStore.delete(jobId);
      changed = true;
      console.log(`[renderQueue] Pruned old job from history: ${jobId}`);
    }
  }
  if (changed) scheduleSave();
}
