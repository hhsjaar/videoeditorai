import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const execAsync = promisify(exec);

const FFMPEG_PATHS = [
  "/opt/homebrew/bin/ffmpeg",  // macOS Apple Silicon (Homebrew)
  "/usr/local/bin/ffmpeg",    // macOS Intel (Homebrew) / Linux
  "/usr/bin/ffmpeg",          // Linux system
  "ffmpeg",                   // fallback: rely on PATH
];

async function findFfmpeg(): Promise<string | null> {
  for (const bin of FFMPEG_PATHS) {
    try {
      await execAsync(`"${bin}" -version`, { timeout: 5000 });
      console.log(`[render-video] ffmpeg found at: ${bin}`);
      return bin;
    } catch { /* try next */ }
  }
  return null;
}

// Pre-trim a video clip to exact duration using ffmpeg.
// This is MORE RELIABLE than relying on Remotion's OffthreadVideo seek,
// especially for long iPhone .MOV / HEVC files.
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
    const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
    return true;
  } catch (err1: any) {
    console.warn(`[render-video] stream-copy failed, trying re-encode:`, err1?.message?.slice(0, 200));
    // Fallback: re-encode (handles HEVC / VFR / non-keyframe issues)
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

export async function POST(req: NextRequest) {
  const tempDir = path.join(process.cwd(), "tmp", `remotion_${Date.now()}`);

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

    const transitionsJson = (formData.get("transitions") as string) || "[]";
    let transitionsList: Array<{ type: string; afterClipIndex: number; duration: number }> = [];
    try {
      transitionsList = JSON.parse(transitionsJson);
    } catch {}

    const clipDurationsJson = (formData.get("clipDurations") as string) || "[]";
    let clipDurationsList: number[] = [];
    try {
      clipDurationsList = JSON.parse(clipDurationsJson);
    } catch {}

    const startFromSecJson = (formData.get("startFromSecList") as string) || "[]";
    let startFromSecList: number[] = [];
    try {
      startFromSecList = JSON.parse(startFromSecJson);
    } catch {}

    if (footageFiles.length === 0) {
      return NextResponse.json({ error: "Minimal upload 1 klip video." }, { status: 400 });
    }

    // 1. Save uploaded footage files to disk inside tempDir
    const savedFootageFilenames: string[] = [];
    for (let i = 0; i < footageFiles.length; i++) {
      const file = footageFiles[i];
      const ext = path.extname(file.name) || ".png";
      const filename = `footage_${i}${ext === "" || file.name.includes("Cover Akhiran") || file.name.includes("ending") ? ".png" : ext}`;
      const filePath = path.join(tempDir, filename);

      if (file.size === 0 || file.name.includes("Cover Akhiran") || file.name.includes("ending")) {
        // Copy real ending cover image file from public/akhiran/ending.png
        try {
          const endingCoverPath = path.join(process.cwd(), "public", "akhiran", "ending.png");
          const endingBuffer = await require("fs/promises").readFile(endingCoverPath);
          await writeFile(filePath, endingBuffer);
        } catch (e) {
          console.error("Failed to copy ending cover image:", e);
        }
      } else {
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
      }
      savedFootageFilenames.push(filename);
    }

    // 2. Save voice over file to disk inside tempDir
    let savedVoFilename: string | null = null;
    if (voiceOverFile && voiceOverFile.size > 0) {
      const buffer = Buffer.from(await voiceOverFile.arrayBuffer());
      savedVoFilename = "voiceover.mp3";
      await writeFile(path.join(tempDir, savedVoFilename), buffer);
    }

    // 3. Save BGM file to disk inside tempDir (Uploaded file or Preset URL)
    let savedBgmFilename: string | null = null;
    if (bgmFile && bgmFile.size > 0) {
      const buffer = Buffer.from(await bgmFile.arrayBuffer());
      savedBgmFilename = "bgm.mp3";
      await writeFile(path.join(tempDir, savedBgmFilename), buffer);
    } else if (bgmUrl && bgmUrl.trim()) {
      try {
        const cleanBgmPath = bgmUrl.startsWith("/") ? bgmUrl.slice(1) : bgmUrl;
        const localBgmPath = path.join(process.cwd(), "public", cleanBgmPath);
        const bgmBuffer = await require("fs/promises").readFile(localBgmPath);
        savedBgmFilename = "bgm.mp3";
        await writeFile(path.join(tempDir, savedBgmFilename), bgmBuffer);
      } catch (err) {
        console.error("Could not read preset BGM file:", err);
      }
    }

    const subtitlesJson = (formData.get("subtitlesJson") as string) || "[]";
    let subtitleChunksList: Array<{ text: string; start: number; end: number }> = [];
    try {
      subtitleChunksList = JSON.parse(subtitlesJson);
    } catch {}

    const footagesMetaJson = (formData.get("footagesMetaJson") as string) || "[]";
    let footagesMetaList: Array<{ duration: number; startFromSec: number; colorGrade: string }> = [];
    try {
      footagesMetaList = JSON.parse(footagesMetaJson);
    } catch {}

    // DEBUG: Log all received data to diagnose preview vs export mismatch
    console.log("[render-video] footageFiles received:", footageFiles.length, footageFiles.map(f => ({ name: f.name, size: f.size })));
    console.log("[render-video] footagesMetaList:", JSON.stringify(footagesMetaList));
    console.log("[render-video] clipDurationsList:", JSON.stringify(clipDurationsList));
    console.log("[render-video] subtitleChunksList count:", subtitleChunksList.length);
    console.log("[render-video] audioDurationSec:", audioDurationSec);

    // 4. Construct composition footages and subtitles with exact studio preview metadata
    const footageItems = savedFootageFilenames.map((fn, i) => {
      const meta = footagesMetaList[i] || {};
      const dur = meta.duration || (clipDurationsList[i] && clipDurationsList[i] > 0 ? clipDurationsList[i] : defaultTrimSec);
      const startSec = meta.startFromSec !== undefined ? meta.startFromSec : (startFromSecList[i] || 0);
      console.log(`[render-video] clip[${i}]: file=${fn}, dur=${dur}s, startFromSec=${startSec}`);
      return {
        url: fn,
        duration: dur,
        startFromSec: startSec,
        colorGrade: meta.colorGrade || editingStyle,
      };
    });

    if (subtitleChunksList.length === 0 && subtitleText.trim()) {
      const textChunks = splitTextIntoAutoCaptionChunks(subtitleText, 3);
      const voDuration = audioDurationSec > 0 ? audioDurationSec : footageItems.reduce((acc, f) => acc + f.duration, 0);
      const chunkDur = voDuration / Math.max(1, textChunks.length);
      for (let i = 0; i < textChunks.length; i++) {
        subtitleChunksList.push({
          text: textChunks[i],
          start: i * chunkDur,
          end: Math.min(voDuration, (i + 1) * chunkDur),
        });
      }
    }

    // ====================================================================
    // PRE-TRIM FOOTAGE WITH FFMPEG
    // Cut each video clip to exact timeline duration BEFORE Remotion renders.
    // Uses explicit path detection to bypass Node.js PATH env var differences.
    // ====================================================================
    const ffmpegBin = await findFfmpeg();

    if (ffmpegBin) {
      console.log(`[render-video] Pre-trimming ${footageItems.length} clips with ffmpeg (sequential to avoid I/O races)...`);

      for (let i = 0; i < footageItems.length; i++) {
        const item = footageItems[i];
        const fn = item.url;

        // Skip images (png, jpg, webp, gif, bmp)
        if (/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(fn)) {
          console.log(`[render-video] clip[${i}] = image, skipping trim: ${fn}`);
          continue;
        }

        const inputPath = path.join(tempDir, fn);
        const trimmedFn = `clip_${i}_trimmed.mp4`;
        const outputPath = path.join(tempDir, trimmedFn);

        console.log(`[render-video] Trimming clip[${i}]: ${fn} → ${trimmedFn} (dur=${item.duration.toFixed(3)}s, start=${(item.startFromSec||0).toFixed(3)}s)`);

        const ok = await preTrimWithFfmpeg(
          ffmpegBin,
          inputPath,
          outputPath,
          item.startFromSec || 0,
          item.duration
        );

        if (ok) {
          footageItems[i] = { ...item, url: trimmedFn, startFromSec: 0 };
          console.log(`[render-video] clip[${i}] ✓ trimmed OK → ${trimmedFn}`);
        } else {
          console.warn(`[render-video] clip[${i}] ✗ trim FAILED, Remotion will use original: ${fn}`);
        }
      }

      console.log("[render-video] === Pre-trim complete ===");
    } else {
      console.warn("[render-video] ffmpeg NOT found at any known path — skipping pre-trim!");
    }

    const exportPreset = (formData.get("exportPreset") as string) || "1080p";
    const aspectRatio = (formData.get("aspectRatio") as string) || "9:16";

    // 5. Bundle Remotion entry point with publicDir serving tempDir files
    const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
    const serveUrl = await bundle({
      entryPoint,
      ignoreRegisterRootWarning: true,
      publicDir: tempDir,
    });

    // 6. Select Remotion composition & input props
    const inputProps = {
      footages: footageItems,
      transitions: transitionsList,
      subtitles: subtitleChunksList,
      voiceOverUrl: savedVoFilename || undefined,
      bgmUrl: savedBgmFilename || undefined,
      bgmVolume: bgmVolume,
      subtitleStyle: subtitleStyle,
      subtitleFontSize: subtitleFontSize,
      subtitleBottomPos: subtitleBottomPos,
      clipDuration: defaultTrimSec,
    };

    const composition = await selectComposition({
      serveUrl,
      id: "MainComposition",
      inputProps,
    });

    // Determine target width, height, and fps based on preset & aspect ratio
    let targetWidth = 1080;
    let targetHeight = 1920;
    let targetFps = 60;

    if (exportPreset === "720p") {
      targetFps = 30;
      if (aspectRatio === "9:16") { targetWidth = 720; targetHeight = 1280; }
      else if (aspectRatio === "16:9") { targetWidth = 1280; targetHeight = 720; }
      else { targetWidth = 720; targetHeight = 720; }
    } else if (exportPreset === "480p") {
      targetFps = 30;
      if (aspectRatio === "9:16") { targetWidth = 480; targetHeight = 854; }
      else if (aspectRatio === "16:9") { targetWidth = 854; targetHeight = 480; }
      else { targetWidth = 480; targetHeight = 480; }
    } else {
      // 1080p FHD (60 FPS) default
      targetFps = 60;
      if (aspectRatio === "9:16") { targetWidth = 1080; targetHeight = 1920; }
      else if (aspectRatio === "16:9") { targetWidth = 1920; targetHeight = 1080; }
      else { targetWidth = 1080; targetHeight = 1080; }
    }

    composition.width = targetWidth;
    composition.height = targetHeight;
    composition.fps = targetFps;

    // Compute total composition frames using EXACT same integer accumulation as VideoTracks.tsx
    // This prevents any clip boundary drift between preview and render
    let totalFrames = 0;
    for (const f of footageItems) {
      const durationSec = f.duration || defaultTrimSec || 3;
      totalFrames += Math.max(1, Math.round(durationSec * targetFps));
    }
    composition.durationInFrames = Math.max(targetFps, totalFrames);
    console.log(`[render-video] composition: totalFrames=${totalFrames}, fps=${targetFps}, duration=${(totalFrames/targetFps).toFixed(2)}s`);

    // 7. Render MP4 video via Remotion renderer (Optimized for 2 vCPU VPS)
    const finalVideoPath = path.join(tempDir, "final_export.mp4");
    console.log(`[render-video] Starting Chromium rendering for ${composition.durationInFrames} frames...`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: finalVideoPath,
      inputProps,
      concurrency: 2, // Manfaatkan 2 vCPU untuk render 2x lebih cepat
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
      onProgress: ({ renderedFrames }) => {
        const percent = Math.round((renderedFrames / composition.durationInFrames) * 100);
        if (renderedFrames % 60 === 0 || renderedFrames === composition.durationInFrames) {
          console.log(`[render-video] 🎬 Rendering: ${percent}% (${renderedFrames}/${composition.durationInFrames} frames)`);
        }
      },
    });
    console.log(`[render-video] ✓ Render finished successfully! Sending MP4 file to client.`);

    const videoBuffer = await require("fs/promises").readFile(finalVideoPath);

    // Cleanup temp directory in background
    rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="AutoVideo_${Date.now()}.mp4"`,
      },
    });
  } catch (error: any) {
    console.error("Remotion video render error:", error);
    rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json(
      { error: error.message || "Gagal merender video ekspor Remotion." },
      { status: 500 }
    );
  }
}
