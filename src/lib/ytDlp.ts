/**
 * ytDlp.ts — Thin wrapper around the yt-dlp binary for downloading a
 * reference video from non-YouTube platforms (Instagram, TikTok, etc.).
 *
 * YouTube doesn't need this at all — Gemini accepts YouTube URLs natively
 * via fileData.fileUri (see analyze-reference/route.ts). This is only for
 * platforms Gemini can't fetch directly, so we download once locally and
 * hand the bytes to Gemini's Files API instead.
 *
 * Downloading from Instagram/TikTok this way sits in each platform's ToS
 * gray area (yt-dlp is a third-party tool, not an official API) — this is
 * the deliberate scope the user chose over YouTube-only.
 */
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { mkdir, readdir, stat, rm } from "fs/promises";

const execAsync = promisify(exec);

const YT_DLP_PATHS = [
  process.env.HOME ? path.join(process.env.HOME, "Library/Python/3.9/bin/yt-dlp") : "",
  "/usr/local/bin/yt-dlp",
  "/opt/homebrew/bin/yt-dlp",
  "/usr/bin/yt-dlp",
  "yt-dlp",
].filter(Boolean);

let _cachedBin: string | null | undefined = undefined;

async function findYtDlp(): Promise<string | null> {
  for (const bin of YT_DLP_PATHS) {
    try {
      await execAsync(`"${bin}" --version`, { timeout: 5000 });
      return bin;
    } catch { /* try next */ }
  }
  return null;
}

export async function getCachedYtDlp(): Promise<string | null> {
  if (_cachedBin !== undefined) return _cachedBin;
  _cachedBin = await findYtDlp();
  return _cachedBin;
}

export const DOWNLOAD_DIR = path.join(process.cwd(), "data", "ref-downloads");

/**
 * Downloads a video from a URL (Instagram, TikTok, or anything yt-dlp
 * supports) to DOWNLOAD_DIR. Returns the local file path + detected mime
 * type. Caps at 720p / a reasonable file size so a long/heavy source clip
 * doesn't blow past Gemini's upload limits or take forever.
 */
export async function downloadReferenceVideo(url: string, id: string): Promise<{ filePath: string; mimeType: string }> {
  const bin = await getCachedYtDlp();
  if (!bin) {
    throw new Error("yt-dlp tidak tersedia di server — instal dulu (pip install yt-dlp) untuk menganalisis link non-YouTube.");
  }

  await mkdir(DOWNLOAD_DIR, { recursive: true });
  const outputTemplate = path.join(DOWNLOAD_DIR, `${id}.%(ext)s`);

  await execAsync(
    `"${bin}" -f "bv*[height<=720]+ba/b[height<=720]/best" --no-playlist -o "${outputTemplate}" "${url}"`,
    { timeout: 180000, maxBuffer: 1024 * 1024 * 20 }
  );

  const files = await readdir(DOWNLOAD_DIR);
  const match = files.find((f) => f.startsWith(`${id}.`));
  if (!match) throw new Error("yt-dlp selesai tapi file hasil unduhan tidak ditemukan.");

  const filePath = path.join(DOWNLOAD_DIR, match);
  const info = await stat(filePath);
  if (info.size === 0) throw new Error("File hasil unduhan kosong — link mungkin private/tidak valid.");

  const ext = path.extname(match).toLowerCase();
  const mimeType = ext === ".webm" ? "video/webm" : ext === ".mkv" ? "video/x-matroska" : "video/mp4";
  return { filePath, mimeType };
}

export async function cleanupReferenceDownload(filePath: string): Promise<void> {
  await rm(filePath, { force: true }).catch(() => {});
}
