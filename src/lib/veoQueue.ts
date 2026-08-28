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
import { mkdir, rm, readdir, stat, writeFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { GoogleGenAI } from "@google/genai";
import { fal } from "@fal-ai/client";
import { loadPersistedJobs, persistJobs } from "./jobPersistence";
import { QUALITY_TO_MODEL, providerForQuality, type VeoQuality } from "./veoPricing";
import { getCachedFfmpeg } from "./renderQueue";

const execAsync = promisify(exec);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });

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
  durationSeconds: number; // requested duration
  actualDurationSeconds: number | null; // measured from the downloaded file — Veo doesn't always hit the requested length exactly
  aspectRatio: string;
  // Optional seed frame for image-to-video generation (Video AI's image-upload
  // flow) — Veo animates from this image instead of imagining the scene from
  // text alone, which matters for real/specific reference photos.
  imageBytes: string | null;
  imageMimeType: string | null;
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
  imageBytes?: string;
  imageMimeType?: string;
}): VeoJobState {
  const state: VeoJobState = {
    jobId: params.jobId,
    status: "pending",
    prompt: params.prompt,
    quality: params.quality,
    durationSeconds: params.durationSeconds,
    actualDurationSeconds: null,
    aspectRatio: params.aspectRatio,
    imageBytes: params.imageBytes || null,
    imageMimeType: params.imageMimeType || null,
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
const RATE_LIMIT_RETRY_DELAY_MS = 65_000; // Veo's RPM window is 60s — wait it out, then retry

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

// Veo's free/Tier-1 quota is tight per request-frequency (e.g. 2 requests/min,
// 10/day for Veo Lite) — a burst (several clips generated close together)
// trips this even with plenty of spend remaining. A short wait for the
// per-minute window to roll over often succeeds; a genuinely exhausted daily
// cap won't, but the extra attempt is cheap either way.
function isRateLimitError(message: string): boolean {
  return /RESOURCE_EXHAUSTED|429|exceeded your current quota/i.test(message);
}

// Veo doesn't always hit the exact requested duration (e.g. asked for 6s,
// comes back at 5.7s) — if the timeline trusts the requested length instead
// of the real one, the Sequence window runs past the last actual frame and
// OffthreadVideo just holds/freezes on it, making the cut into the next clip
// look like a stutter. Measuring the real file length keeps the timeline
// honest. Reuses ffmpeg itself (no separate ffprobe dependency): running it
// with no output makes it print "Duration: HH:MM:SS.ss" to stderr and exit
// non-zero, which we parse out of the thrown error's captured output.
async function probeDurationSeconds(filePath: string, ffmpegBin: string): Promise<number | null> {
  try {
    await execAsync(`"${ffmpegBin}" -i "${filePath}" -hide_banner`, { timeout: 15000 });
    return null; // unreachable in practice — ffmpeg with no -c/output always errors
  } catch (err: any) {
    const output: string = err?.stderr || err?.stdout || "";
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const [, hh, mm, ss] = match;
    return parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseFloat(ss);
  }
}

// Writes the generated clip's raw bytes to rawPath — same contract for every
// provider, so everything downstream (faststart remux, duration probe, job
// bookkeeping) stays provider-agnostic.
async function attemptGenerate(job: VeoJobState, rawPath: string): Promise<void> {
  if (providerForQuality(job.quality) === "kling") {
    await attemptGenerateKling(job, rawPath);
    return;
  }

  const model = QUALITY_TO_MODEL[job.quality];
  const source = job.imageBytes
    ? { prompt: job.prompt, image: { imageBytes: job.imageBytes, mimeType: job.imageMimeType || "image/jpeg" } }
    : { prompt: job.prompt };
  let operation = await genai.models.generateVideos({
    model,
    source,
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

  await genai.files.download({ file: generated.video, downloadPath: rawPath });
}

// Kling (via fal.ai) — added alongside Veo, not a replacement, mainly to
// dodge Google's tight Veo Lite rate limit (2 requests/min, 10/day on Tier 1).
// fal.ai uses a concurrency limit instead (scales with spend, no hard daily cap).
async function attemptGenerateKling(job: VeoJobState, rawPath: string): Promise<void> {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY belum dikonfigurasi di server (butuh API key fal.ai untuk pakai Kling).");
  }

  const endpoint = job.imageBytes
    ? "fal-ai/kling-video/v2.5-turbo/pro/image-to-video"
    : "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";

  // Kling only supports 16:9 / 9:16 / 1:1 — same values our aspectRatio
  // already uses, so no mapping needed.
  const input: Record<string, unknown> = {
    prompt: job.prompt,
    duration: String(job.durationSeconds), // Kling wants "5" | "10", not a number
    aspect_ratio: job.aspectRatio,
  };
  if (job.imageBytes) {
    input.image_url = `data:${job.imageMimeType || "image/jpeg"};base64,${job.imageBytes}`;
  }

  // The endpoint string is computed at runtime, so the client's per-model
  // typed-input overloads can't narrow it — cast at the boundary.
  const result: any = await fal.subscribe(endpoint, { input, logs: false } as any);
  const remoteUrl = result?.data?.video?.url;
  if (!remoteUrl) throw new Error("fal.ai tidak mengembalikan video (kemungkinan diblokir filter konten atau prompt ditolak).");

  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Gagal mengunduh hasil video dari fal.ai (HTTP ${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(rawPath, buffer);
}

async function runJob(job: VeoJobState) {
  job.status = "generating";
  scheduleSave();

  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const outPath = path.join(OUTPUT_DIR, `${job.jobId}.mp4`);
    const rawPath = path.join(OUTPUT_DIR, `${job.jobId}.raw.mp4`);

    let succeeded = false;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await attemptGenerate(job, rawPath);
        succeeded = true;
        break;
      } catch (err: any) {
        lastErr = err;
        const msg = err?.message || "";
        const rateLimited = isRateLimitError(msg);
        const retryable = rateLimited || isRetryableError(msg);
        const delay = rateLimited ? RATE_LIMIT_RETRY_DELAY_MS : RETRY_DELAY_MS;
        console.warn(`[veoQueue] Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${job.jobId}${retryable ? `, retrying in ${delay / 1000}s...` : " (not retryable)"}:`, msg);
        if (!retryable || attempt === MAX_ATTEMPTS) {
          if (rateLimited) {
            const rateLimitMsg = providerForQuality(job.quality) === "kling"
              ? "Kena batas concurrency fal.ai (terlalu banyak request Kling berbarengan). Tunggu sebentar lalu coba lagi, atau cek limit di dashboard fal.ai."
              : "Kena rate limit Google (request Veo terlalu sering dalam waktu singkat — Tier 1 cuma bolehin beberapa request per menit/hari). Tunggu 1-2 menit lalu coba lagi, atau cek kuota di ai.dev/rate-limit.";
            throw new Error(rateLimitMsg);
          }
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    if (!succeeded) throw lastErr || new Error("Gagal generate video.");

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

    if (ffmpegBin) {
      job.actualDurationSeconds = await probeDurationSeconds(outPath, ffmpegBin);
      if (job.actualDurationSeconds !== null) {
        console.log(`[veoQueue] ${job.jobId}: requested ${job.durationSeconds}s, actual ${job.actualDurationSeconds.toFixed(2)}s`);
      }
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
