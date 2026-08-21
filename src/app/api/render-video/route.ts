import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { enqueueJob, getCachedFfmpeg } from "@/lib/renderQueue";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

// ─── ffmpeg pre-trim helper ───────────────────────────────────────────────────
async function preTrimWithFfmpeg(
  ffmpegBin: string,
  inputPath: string,
  outputPath: string,
  startFromSec: number,
  durationSec: number
): Promise<boolean> {
  const ssArg = startFromSec > 0.01 ? `-ss ${startFromSec.toFixed(3)}` : "";
  const tArg = `-t ${durationSec.toFixed(3)}`;

  // Try stream-copy first (fast, no re-encode)
  try {
    const cmd = `"${ffmpegBin}" -y ${ssArg} -i "${inputPath}" ${tArg} -c copy -avoid_negative_ts make_zero "${outputPath}"`;
    console.log(`[render-video] ffmpeg cmd: ${cmd}`);
    await execAsync(cmd, { timeout: 60000 });
    return true;
  } catch (err1: any) {
    console.warn(`[render-video] stream-copy failed, trying re-encode:`, err1?.message?.slice(0, 200));
    try {
      await execAsync(
        `"${ffmpegBin}" -y ${ssArg} -i "${inputPath}" ${tArg} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -ar 44100 "${outputPath}"`,
        { timeout: 120000 }
      );
      return true;
    } catch (err2: any) {
      console.error(`[render-video] ffmpeg trim FAILED for ${path.basename(inputPath)}:`, err2?.message?.slice(0, 300));
      return false;
    }
  }
}

function splitTextIntoAutoCaptionChunks(text: string, wordsPerChunk = 3): string[] {
  const words = text
    .replace(/[.!?\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}

// ─── POST /api/render-video ───────────────────────────────────────────────────
// Returns { jobId } immediately. Render runs in background.
// Poll GET /api/render-status/[jobId] for progress.
// Download via GET /api/render-download/[jobId] when done.
export async function POST(req: NextRequest) {
  const jobId = randomUUID();
  // Use tmp/ dir — media files are served to Remotion via a per-job mini HTTP
  // server started inside renderQueue.ts. No need for public/ or file:// URLs.
  const tempDir = path.join(process.cwd(), "tmp", `remotion_${jobId}`);
  // Filenames only — renderQueue will prepend the mini server baseUrl
  const toFilename = (filename: string) => filename;

  try {
    await mkdir(tempDir, { recursive: true });
    const formData = await req.formData();

    const footageFiles = formData.getAll("footages") as File[];
    const voiceOverFile = formData.get("voiceOver") as File | null;
    const bgmFile = formData.get("bgm") as File | null;
    const bgmUrl = (formData.get("bgmUrl") as string) || "";
    const audioDurationSec = parseFloat((formData.get("audioDurationSec") as string) || "0");
    const subtitleText = (formData.get("subtitleText") as string) || "";
    const editingStyle = (formData.get("editingStyle") as string) || "fast-viral";
    const subtitleStyle = (formData.get("subtitleStyle") as string) || "plain-shadow";
    const subtitleFontSize = parseInt((formData.get("subtitleFontSize") as string) || "44");
    const subtitleBottomPos = parseInt((formData.get("subtitleBottomPos") as string) || "220");
    const bgmVolume = parseFloat((formData.get("bgmVolume") as string) || "0.2");
    const defaultTrimSec = parseFloat((formData.get("clipDuration") as string) || "3.0");
    const exportPreset = (formData.get("exportPreset") as string) || "720p";
    const aspectRatio = (formData.get("aspectRatio") as string) || "9:16";
    const targetDuration = parseFloat((formData.get("targetDuration") as string) || "0"); // 0 = no target

    let transitionsList: Array<{ type: string; afterClipIndex: number; duration: number }> = [];
    try { transitionsList = JSON.parse((formData.get("transitions") as string) || "[]"); } catch { }

    let clipDurationsList: number[] = [];
    try { clipDurationsList = JSON.parse((formData.get("clipDurations") as string) || "[]"); } catch { }

    let startFromSecList: number[] = [];
    try { startFromSecList = JSON.parse((formData.get("startFromSecList") as string) || "[]"); } catch { }

    let subtitleChunksList: Array<{ text: string; start: number; end: number }> = [];
    try { subtitleChunksList = JSON.parse((formData.get("subtitlesJson") as string) || "[]"); } catch { }

    let footagesMetaList: Array<{ duration: number; startFromSec: number; colorGrade: string; isImage?: boolean }> = [];
    try { footagesMetaList = JSON.parse((formData.get("footagesMetaJson") as string) || "[]"); } catch { }

    let titleConfig: any = undefined;
    try {
      const rawTitle = formData.get("titleConfigJson") as string;
      if (rawTitle) titleConfig = JSON.parse(rawTitle);
    } catch { }

    // Overlay files and their metadata
    const overlayFiles = formData.getAll("overlayFiles") as File[];
    let overlayMetaList: Array<{ position: string; sizePercent: number; opacity: number; startSec: number; endSec: number; isVideo: boolean; x?: number; y?: number }> = [];
    try { overlayMetaList = JSON.parse((formData.get("overlayMetaJson") as string) || "[]"); } catch { }

    if (footageFiles.length === 0) {
      return NextResponse.json({ error: "Minimal upload 1 klip video." }, { status: 400 });
    }

    // 1. Save footage files to tempDir
    const savedFootageFilenames: string[] = [];
    for (let i = 0; i < footageFiles.length; i++) {
      const file = footageFiles[i];
      const ext = path.extname(file.name) || ".png";
      const isEnding = file.size === 0 || file.name.includes("Cover Akhiran") || file.name.includes("ending");
      const filename = `footage_${i}${isEnding ? ".png" : ext}`;
      const filePath = path.join(tempDir, filename);

      if (isEnding) {
        try {
          const { readFile } = await import("fs/promises");
          const endingBuffer = await readFile(path.join(process.cwd(), "public", "akhiran", "ending.png"));
          await writeFile(filePath, endingBuffer);
        } catch (e) {
          console.error("Failed to copy ending cover image:", e);
        }
      } else {
        await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
      }
      savedFootageFilenames.push(filename);
    }

    // 2. Save voiceover
    let savedVoFilename: string | null = null;
    if (voiceOverFile && voiceOverFile.size > 0) {
      savedVoFilename = "voiceover.mp3";
      await writeFile(path.join(tempDir, savedVoFilename), Buffer.from(await voiceOverFile.arrayBuffer()));
    }

    // 3. Save BGM
    let savedBgmFilename: string | null = null;
    if (bgmFile && bgmFile.size > 0) {
      savedBgmFilename = "bgm.mp3";
      await writeFile(path.join(tempDir, savedBgmFilename), Buffer.from(await bgmFile.arrayBuffer()));
    } else if (bgmUrl && bgmUrl.trim()) {
      try {
        const { readFile } = await import("fs/promises");
        const cleanPath = bgmUrl.startsWith("/") ? bgmUrl.slice(1) : bgmUrl;
        const bgmBuffer = await readFile(path.join(process.cwd(), "public", cleanPath));
        savedBgmFilename = "bgm.mp3";
        await writeFile(path.join(tempDir, savedBgmFilename), bgmBuffer);
      } catch (err) {
        console.error("Could not read preset BGM file:", err);
      }
    }

    // 4. Build footageItems — store filename only, renderQueue constructs full http URLs
    const footageItems = savedFootageFilenames.map((fn, i) => {
      const meta = footagesMetaList[i] || {};
      const dur = meta.duration || (clipDurationsList[i] > 0 ? clipDurationsList[i] : defaultTrimSec);
      const startSec = meta.startFromSec !== undefined ? meta.startFromSec : (startFromSecList[i] || 0);
      const isImg = meta.isImage ?? /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(fn);
      return {
        url: fn,
        duration: dur,
        startFromSec: startSec,
        colorGrade: meta.colorGrade || editingStyle,
        isImage: isImg,
      };
    });

    // 5. Apply targetDuration: extend main clips only (never touch Cover Akhiran)
    if (targetDuration > 0 && audioDurationSec > 0) {
      if (targetDuration > audioDurationSec + 0.5) {
        const extraTime = targetDuration - audioDurationSec;

        // Identify main clips (exclude ending cover: .png files with "akhiran/ending" OR generic ending cover)
        const isEndingCover = (item: typeof footageItems[0], filename: string) =>
          /\.(png|jpe?g|webp)$/i.test(item.url) &&
          /akhiran|ending|cover/i.test(filename);

        const mainIndices = footageItems.map((item, i) => {
          const fname = savedFootageFilenames[i] || item.url;
          return isEndingCover(item, fname) ? -1 : i;
        }).filter(i => i !== -1);

        const mainTotal = mainIndices.reduce((s, i) => s + footageItems[i].duration, 0);

        if (mainTotal > 0 && mainIndices.length > 0) {
          mainIndices.forEach(i => {
            const ratio = footageItems[i].duration / mainTotal;
            footageItems[i] = {
              ...footageItems[i],
              duration: parseFloat((footageItems[i].duration + ratio * extraTime).toFixed(2)),
            };
          });
          console.log(`[render-video] Target: ${targetDuration}s, extended ${mainIndices.length} main clips by ${extraTime.toFixed(1)}s total`);
        }
      } else if (targetDuration < audioDurationSec - 0.5) {
        console.warn(`[render-video] targetDuration (${targetDuration}s) < VO (${audioDurationSec}s) — ignored`);
      }
    }


    // 6. Auto-generate subtitles from text if none provided
    if (subtitleChunksList.length === 0 && subtitleText.trim()) {
      const textChunks = splitTextIntoAutoCaptionChunks(subtitleText, 3);
      const voDuration = audioDurationSec > 0 ? audioDurationSec : footageItems.reduce((acc, f) => acc + f.duration, 0);
      const chunkDur = voDuration / Math.max(1, textChunks.length);
      for (let i = 0; i < textChunks.length; i++) {
        subtitleChunksList.push({ text: textChunks[i], start: i * chunkDur, end: Math.min(voDuration, (i + 1) * chunkDur) });
      }
    }

    // 6. Pre-process clips with ffmpeg
    const ffmpegBin = await getCachedFfmpeg();
    if (ffmpegBin) {
      for (let i = 0; i < footageItems.length; i++) {
        const item = footageItems[i];
        const isImage = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(item.url);

        if (isImage) {
          // Convert all images to standard JPEG so Remotion/Chromium can render them
          // This fixes HEIC (iPhone), AVIF, and any format Chromium doesn't support natively
          const inputFilename = item.url.split("/").pop()!;
          const inputPath = path.join(tempDir, inputFilename);
          const outputFn = `footage_${i}.jpg`;
          const outputPath = path.join(tempDir, outputFn);

          // Skip conversion if already a standard JPEG/PNG with correct name
          if (inputFilename === outputFn) continue;

          try {
            // -vf scale=-2:1920 keeps aspect ratio and ensures even width for Remotion
            await execAsync(
              `"${ffmpegBin}" -y -i "${inputPath}" -vf "scale=iw:ih" -q:v 2 "${outputPath}"`,
              { timeout: 30000 }
            );
            footageItems[i] = { ...item, url: outputFn, startFromSec: 0 };
            console.log(`[render-video] image[${i}] ✓ converted → ${outputFn}`);
          } catch (convErr: any) {
            console.warn(`[render-video] image convert failed for ${inputFilename}:`, convErr?.message?.slice(0, 100));
            // Keep original — Remotion will try its best
          }
          continue; // Skip video trim for images
        }

        // Video: pre-trim with ffmpeg
        const filename = item.url.split("/").pop()!;
        const inputPath = path.join(tempDir, filename);
        const trimmedFn = `clip_${i}_trimmed.mp4`;
        const outputPath = path.join(tempDir, trimmedFn);

        console.log(`[render-video] Trimming clip[${i}]: dur=${item.duration.toFixed(3)}s, start=${(item.startFromSec || 0).toFixed(3)}s`);
        const ok = await preTrimWithFfmpeg(ffmpegBin, inputPath, outputPath, item.startFromSec || 0, item.duration);
        if (ok) {
          footageItems[i] = { ...item, url: trimmedFn, startFromSec: 0 };
          console.log(`[render-video] clip[${i}] ✓ trimmed → ${trimmedFn}`);
        }
      }
    }


    // 7a. Save overlay files to tempDir
    const overlayItems: Array<{ url: string; position: string; sizePercent: number; opacity: number; startSec: number; endSec: number; isVideo: boolean; x?: number; y?: number }> = [];
    for (let i = 0; i < overlayFiles.length; i++) {
      const file = overlayFiles[i];
      const meta = overlayMetaList[i] || {};
      if (!file || file.size === 0) continue;
      const ext = path.extname(file.name) || ".png";
      const filename = `overlay_${i}${ext}`;
      await writeFile(path.join(tempDir, filename), Buffer.from(await file.arrayBuffer()));
      // Convert image overlays to JPEG if needed
      const isImage = /\.(png|jpe?g|webp|heic|heif|avif)$/i.test(filename);
      let finalFn = filename;
      if (isImage && ffmpegBin) {
        const jpgFn = `overlay_${i}.jpg`;
        try {
          await execAsync(`"${ffmpegBin}" -y -i "${path.join(tempDir, filename)}" -q:v 2 "${path.join(tempDir, jpgFn)}"`, { timeout: 15000 });
          finalFn = jpgFn;
        } catch { /* keep original */ }
      }
      overlayItems.push({
        url: finalFn,
        position: (meta.position as any) || "topright",
        sizePercent: meta.sizePercent ?? 20,
        opacity: meta.opacity ?? 1.0,
        startSec: meta.startSec ?? 0,
        endSec: meta.endSec ?? -1,
        isVideo: meta.isVideo ?? !isImage,
        x: meta.x,
        y: meta.y,
      });
    }

    // 7b. Enqueue job — returns immediately, render happens in background
    enqueueJob(jobId, {
      tempDir,
      footageItems,
      transitionsList,
      subtitleChunksList,
      overlayItems,
      titleConfig,
      voiceOverUrl: savedVoFilename ?? undefined,
      bgmUrl: savedBgmFilename ?? undefined,
      bgmVolume,
      subtitleStyle,
      subtitleFontSize,
      subtitleBottomPos,
      defaultTrimSec,
      exportPreset,
      aspectRatio,
    });

    console.log(`[render-video] Job enqueued: ${jobId}`);

    return NextResponse.json({
      jobId,
      message: "Render job diterima! Polling /api/render-status/" + jobId + " untuk progress.",
    });

  } catch (error: any) {
    console.error("[render-video] Failed to enqueue job:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memulai render job." },
      { status: 500 }
    );
  }
}
