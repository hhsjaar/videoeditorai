/**
 * veoQueue.ts — Async job queue for Gemini Veo text-to-video generation.
 *
 * Modeled on renderQueue.ts's enqueue/status/persist pattern, but far simpler:
 * no Lambda/S3, just a direct Gemini API call. `generateVideos` kicks off a
 * long-running operation (11s–6min per Google's docs); we poll it in the
 * background and, once done, download the result to public/veo-output/ so it
 * can be served as a plain static file.
 */

import path from "path";
import { mkdir, rm, readdir, stat } from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import { loadPersistedJobs, persistJobs } from "./jobPersistence";
import { QUALITY_TO_MODEL, type VeoQuality } from "./veoPricing";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const JOBS_FILE = "veo-jobs.json";
const OUTPUT_DIR = path.join(process.cwd(), "public", "veo-output");
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

async function runJob(job: VeoJobState) {
  job.status = "generating";
  scheduleSave();

  try {
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

    await mkdir(OUTPUT_DIR, { recursive: true });
    const outPath = path.join(OUTPUT_DIR, `${job.jobId}.mp4`);
    await genai.files.download({ file: generated.video, downloadPath: outPath });

    job.status = "done";
    job.videoUrl = `/veo-output/${job.jobId}.mp4`;
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
