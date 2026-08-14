import { NextRequest, NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Helper to get video/audio duration via ffprobe
function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration || 0;
      resolve(duration);
    });
  });
}

interface SubtitleSegment {
  text: string;
  start: number;
  end: number;
  pngPath: string;
}

function wrapSubtitleText(text: string, maxCharsPerLine = 18): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
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

async function convertSvgToPng(svgPath: string, pngPath: string): Promise<boolean> {
  // 1. Try macOS built-in sips tool
  try {
    await execAsync(`sips -s format png "${svgPath}" --out "${pngPath}"`);
    return true;
  } catch {}

  // 2. Try ImageMagick (convert / magick) on Linux VPS
  try {
    await execAsync(`convert -background none "${svgPath}" "${pngPath}"`);
    return true;
  } catch {}
  try {
    await execAsync(`magick -background none "${svgPath}" "${pngPath}"`);
    return true;
  } catch {}

  // 3. Try rsvg-convert on Linux
  try {
    await execAsync(`rsvg-convert -f png -o "${pngPath}" "${svgPath}"`);
    return true;
  } catch {}

  return false;
}

// Generate SVG & convert to PNG via sips or ImageMagick using separate <text> elements
async function generateSubtitleOverlayPNGs(
  subtitleText: string,
  voDuration: number,
  tempDir: string,
  subtitleStyle: string,
  subtitleFontSize: number
): Promise<SubtitleSegment[]> {
  const rawPhrases = splitTextIntoAutoCaptionChunks(subtitleText, 3);

  if (rawPhrases.length === 0) return [];

  const totalChars = rawPhrases.reduce((acc, p) => acc + p.length, 0);
  let currentStart = 0;
  const segments: SubtitleSegment[] = [];

  // Scale font size proportionally for 1080x1920 9:16 vertical canvas (matches Program Monitor ratio 1:1)
  const scaledFontSize = Math.round(subtitleFontSize * 3.5);
  const lineHeight = Math.round(scaledFontSize * 1.32);

  for (let idx = 0; idx < rawPhrases.length; idx++) {
    const text = rawPhrases[idx];
    const ratio = totalChars > 0 ? text.length / totalChars : 1 / rawPhrases.length;
    const segDur = Math.max(0.5, ratio * voDuration);
    const start = currentStart;
    const end = Math.min(voDuration, start + segDur);
    currentStart = end;

    const svgPath = path.join(tempDir, `sub_${idx}.svg`);
    const pngPath = path.join(tempDir, `sub_${idx}.png`);

    // Auto-wrap phrase matching Program Monitor wrapping ratio
    const wrappedLines = wrapSubtitleText(text, 22);
    const startY = 70;
    const totalSvgHeight = startY + wrappedLines.length * lineHeight + 40;

    let fillHex = "#ffffff";
    let backgroundRect = "";

    if (subtitleStyle === "yellow") {
      fillHex = "#fbbf24";
    } else if (subtitleStyle === "neon") {
      fillHex = "#22d3ee";
    } else if (subtitleStyle === "box") {
      fillHex = "#ffffff";
      const boxHeight = wrappedLines.length * lineHeight + 40;
      backgroundRect = `<rect x="40" y="20" width="1000" height="${boxHeight}" rx="20" fill="rgba(0,0,0,0.88)" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>`;
    } else if (subtitleStyle === "white") {
      fillHex = "#000000";
      const boxHeight = wrappedLines.length * lineHeight + 40;
      backgroundRect = `<rect x="40" y="20" width="1000" height="${boxHeight}" rx="20" fill="#ffffff"/>`;
    }

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    let shadowTexts = "";
    let mainTexts = "";

    wrappedLines.forEach((lineText, lIdx) => {
      const yPos = startY + lIdx * lineHeight;
      const escaped = escapeXml(lineText);
      // Soft, subtle, elegant drop shadow offset
      shadowTexts += `<text x="541.5" y="${yPos + 2.5}" class="subShadow">${escaped}</text>\n`;
      mainTexts += `<text x="540" y="${yPos}" class="subMain">${escaped}</text>\n`;
    });

    const svgContent = `<svg width="1080" height="${totalSvgHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .subShadow {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "San Francisco", Helvetica, Arial, sans-serif;
      font-size: ${scaledFontSize}px;
      font-weight: 400;
      fill: rgba(0, 0, 0, 0.45);
      text-anchor: middle;
      stroke: rgba(0, 0, 0, 0.45);
      stroke-width: 4px;
      stroke-linejoin: round;
    }
    .subMain {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "San Francisco", Helvetica, Arial, sans-serif;
      font-size: ${scaledFontSize}px;
      font-weight: 400;
      fill: ${fillHex};
      text-anchor: middle;
      stroke: rgba(0, 0, 0, 0.3);
      stroke-width: 1px;
      stroke-linejoin: round;
    }
  </style>
  ${backgroundRect}
  ${shadowTexts}
  ${mainTexts}
</svg>`;

    await writeFile(svgPath, svgContent);

    const converted = await convertSvgToPng(svgPath, pngPath);
    if (converted) {
      segments.push({ text, start, end, pngPath });
    } else {
      console.warn(`Could not convert SVG to PNG for segment ${idx}`);
    }
  }

  return segments;
}

export async function POST(req: NextRequest) {
  const tempDir = path.join(process.cwd(), "tmp", `render_${Date.now()}`);

  try {
    await mkdir(tempDir, { recursive: true });

    const formData = await req.formData();
    const voiceoverFile = formData.get("voiceover") as File;
    const bgmFile = formData.get("bgm") as File | null;
    const endingFile = formData.get("endingLogo") as File | null;
    const subtitleText = (formData.get("subtitleText") as string) || "";
    const bgmVolume = parseFloat((formData.get("bgmVolume") as string) || "0.2");
    const subtitleStyle = (formData.get("subtitleStyle") as string) || "plain-shadow";
    const subtitleFontSize = parseInt((formData.get("subtitleFontSize") as string) || "22", 10);
    const editingStyle = (formData.get("editingStyle") as string) || "fast-viral";

    if (!voiceoverFile) {
      return NextResponse.json({ error: "File voice over wajib diunggah." }, { status: 400 });
    }

    // Save Voiceover file
    const voPath = path.join(tempDir, "vo.mp3");
    const voBuffer = Buffer.from(await voiceoverFile.arrayBuffer());
    await writeFile(voPath, voBuffer);

    // Save Footages
    const footageFiles: string[] = [];
    let idx = 0;
    while (formData.has(`footage_${idx}`)) {
      const file = formData.get(`footage_${idx}`) as File;
      const fPath = path.join(tempDir, `footage_${idx}.mp4`);
      await writeFile(fPath, Buffer.from(await file.arrayBuffer()));
      footageFiles.push(fPath);
      idx++;
    }

    if (footageFiles.length === 0) {
      return NextResponse.json({ error: "Minimal 1 video footage wajib diunggah." }, { status: 400 });
    }

    // Save BGM file if provided
    let bgmPath: string | null = null;
    if (bgmFile && bgmFile.size > 0) {
      bgmPath = path.join(tempDir, "bgm.mp3");
      await writeFile(bgmPath, Buffer.from(await bgmFile.arrayBuffer()));
    }

    // Save Ending Logo Image if provided or fallback to burjolevelup attached cover
    let endingPath: string | null = null;
    if (endingFile && endingFile.size > 0) {
      endingPath = path.join(tempDir, "ending.png");
      await writeFile(endingPath, Buffer.from(await endingFile.arrayBuffer()));
    } else {
      const customCoverPath = path.join(process.cwd(), "akhiran", "Cover Akhiran Video burjolevelup.png");
      const defaultEndingLogo = path.join(process.cwd(), "public", "ending-logo.png");
      if (require("fs").existsSync(customCoverPath)) {
        endingPath = customCoverPath;
      } else if (require("fs").existsSync(defaultEndingLogo)) {
        endingPath = defaultEndingLogo;
      }
    }

    // 1. Calculate VO duration
    const voDuration = await getDuration(voPath);
    console.log(`Voice over duration: ${voDuration}s`);

    const clipDurationsJson = (formData.get("clipDurations") as string) || "[]";
    let clipDurationsList: number[] = [];
    try {
      clipDurationsList = JSON.parse(clipDurationsJson);
    } catch {}

    // Define Pacing Trim Length & Color Grade Filter Graph based on editingStyle
    let defaultTrimSec = parseFloat((formData.get("clipDuration") as string) || "3.0");
    let colorEqFilter = "eq=saturation=1.22:contrast=1.1";

    if (editingStyle === "fast-viral") {
      colorEqFilter = "eq=saturation=1.28:contrast=1.14"; // Warm Food Pop
    } else if (editingStyle === "cinematic-aesthetic") {
      colorEqFilter = "eq=contrast=1.15:brightness=-0.02:saturation=1.08"; // Vintage Mood
    } else if (editingStyle === "brand-commercial") {
      colorEqFilter = "eq=contrast=1.08:saturation=1.16"; // Clean Commercial
    } else if (editingStyle === "soft-sweet") {
      colorEqFilter = "eq=brightness=0.03:saturation=1.12"; // Soft Warm Brightness
    }

    // 2. Process each footage: trim with specific per-clip length & apply 9:16 + color grade
    const trimmedClips: string[] = [];
    for (let i = 0; i < footageFiles.length; i++) {
      const inputPath = footageFiles[i];
      const actualFileDuration = await getDuration(inputPath);
      const targetSec = (clipDurationsList[i] && clipDurationsList[i] > 0) ? clipDurationsList[i] : defaultTrimSec;

      const trimmedLen = Math.min(targetSec, Math.max(0.5, actualFileDuration));
      const startTime = Math.max(0, (actualFileDuration - trimmedLen) / 2);

      const outputPath = path.join(tempDir, `trimmed_${i}.mp4`);

      const filterGraph = `[0:v]fps=60,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,${colorEqFilter},setsar=1[v]`;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(trimmedLen)
          .outputOptions([
            "-vf", filterGraph,
            "-r", "60",
            "-threads", "0",
            "-an",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "14",
            "-pix_fmt", "yuv420p"
          ])
          .save(outputPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      trimmedClips.push(outputPath);
    }

    const transitionsJson = (formData.get("transitions") as string) || "[]";
    let transitionsList: Array<{ type: string; afterClipIndex: number; duration: number }> = [];
    try {
      transitionsList = JSON.parse(transitionsJson);
    } catch {}

    // 3. Concatenate video clips with FFmpeg xfade transitions
    const clipsToConcat: string[] = [];
    let currentLen = 0;
    let clipIndex = 0;

    while (currentLen < voDuration) {
      const clipPath = trimmedClips[clipIndex % trimmedClips.length];
      const duration = await getDuration(clipPath);
      clipsToConcat.push(clipPath);
      currentLen += duration;
      clipIndex++;
    }

    const mergedFootagePath = path.join(tempDir, "merged_footage.mp4");

    if (clipsToConcat.length === 1) {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(clipsToConcat[0])
          .outputOptions(["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-t", voDuration.toString()])
          .save(mergedFootagePath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });
    } else {
      // Map frontend UI transition names to standard cross-platform FFmpeg xfade transition names
      const xfadeMap: Record<string, string> = {
        "light-leak": "fadewhite",
        "passerby": "slideleft",
        "dissolve-fade": "dissolve",
        "zoom-blur": "dissolve",
        "glitch": "wipeleft",
        "cross-fade": "fade",
        "flash-white": "fadewhite",
        "fade-black": "fadeblack",
        "iris-circle": "circlecrop",
        "wipe-horizontal": "wipeleft",
        "wipe-diagonal": "wipeleft",
        "film-burn": "fadeblack",
        "wipe-fade": "wipeleft",
        "lens-flare": "fadewhite",
        "vignette": "fadeblack",
        "color-split": "slideleft",
        "slow-shutter": "fadeblack",
      };

      if (transitionsList.length === 0) {
        // Pure seamless concatenation for all clips (100% reliable, zero missing clips)
        const filterInputs = clipsToConcat.map((_, idx) => `[${idx}:v]fps=60,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v${idx}]`).join("; ");
        const filterConcat = clipsToConcat.map((_, idx) => `[v${idx}]`).join("") + `concat=n=${clipsToConcat.length}:v=1:a=0[vmerged_final]`;

        await new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg();
          clipsToConcat.forEach((cPath) => cmd.input(cPath));
          cmd
            .complexFilter(`${filterInputs}; ${filterConcat}`)
            .outputOptions([
              "-map", "[vmerged_final]",
              "-r", "60",
              "-threads", "0",
              "-c:v", "libx264",
              "-preset", "superfast",
              "-crf", "16",
              "-pix_fmt", "yuv420p"
            ])
            .save(mergedFootagePath)
            .on("end", () => resolve())
            .on("error", (err: any) => reject(err));
        });
      } else {
        // Concatenate with user transitions via native FFmpeg xfade with resilient fallback
        const tryXfadeRender = async (transMap: Record<string, string>): Promise<void> => {
          const formattedInputs = clipsToConcat.map((_, idx) => `[${idx}:v]fps=60,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,setsar=1[f${idx}]`).join("; ");
          let currentV = "f0";
          const filterChain: string[] = [formattedInputs];
          let accumOffset = 0;

          for (let i = 0; i < clipsToConcat.length - 1; i++) {
            const clipDur = await getDuration(clipsToConcat[i]);
            const customT = transitionsList.find((t) => t.afterClipIndex === (i % trimmedClips.length));
            const tName = customT ? (transMap[customT.type] || "dissolve") : "dissolve";
            const tDur = customT ? Math.min(clipDur * 0.4, Math.max(0.1, customT.duration || 0.6)) : 0.4;

            accumOffset += clipDur - tDur;
            const nextV = i === clipsToConcat.length - 2 ? "vmerged_final" : `vxf_${i}`;
            filterChain.push(`[${currentV}][f${i + 1}]xfade=transition=${tName}:duration=${tDur.toFixed(2)}:offset=${Math.max(0, accumOffset).toFixed(2)}[${nextV}]`);
            currentV = nextV;
          }

          const cmd = ffmpeg();
          clipsToConcat.forEach((cPath) => cmd.input(cPath));

          return new Promise<void>((resolve, reject) => {
            cmd
              .complexFilter(filterChain.join("; "))
              .outputOptions([
                "-map", `[${currentV}]`,
                "-r", "60",
                "-threads", "0",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "14",
                "-pix_fmt", "yuv420p"
              ])
              .save(mergedFootagePath)
              .on("end", () => resolve())
              .on("error", (err) => reject(err));
          });
        };

        try {
          await tryXfadeRender(xfadeMap);
        } catch (xfadeErr) {
          console.warn("Primary xfade transitions failed on FFmpeg, trying fallback dissolve transitions:", xfadeErr);
          try {
            const fallbackMap: Record<string, string> = {};
            transitionsList.forEach((t) => (fallbackMap[t.type] = "dissolve"));
            await tryXfadeRender(fallbackMap);
          } catch (dissolveErr) {
            console.warn("Dissolve fallback failed, performing seamless concat fallback:", dissolveErr);
            const filterInputs = clipsToConcat.map((_, idx) => `[${idx}:v]fps=60,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v${idx}]`).join("; ");
            const filterConcat = clipsToConcat.map((_, idx) => `[v${idx}]`).join("") + `concat=n=${clipsToConcat.length}:v=1:a=0[vmerged_final]`;

            await new Promise<void>((resolve, reject) => {
              const cmd = ffmpeg();
              clipsToConcat.forEach((cPath) => cmd.input(cPath));
              cmd
                .complexFilter(`${filterInputs}; ${filterConcat}`)
                .outputOptions([
                  "-map", "[vmerged_final]",
                  "-r", "60",
                  "-threads", "0",
                  "-c:v", "libx264",
                  "-preset", "superfast",
                  "-crf", "16",
                  "-pix_fmt", "yuv420p"
                ])
                .save(mergedFootagePath)
                .on("end", () => resolve())
                .on("error", (err) => reject(err));
            });
          }
        }
      }
    }

    // 4. Create Ending Scene (fade-in dissolve transition into ending logo)
    let finalVideoPath = mergedFootagePath;
    let endingDuration = parseFloat((formData.get("endingDuration") as string) || "2.5");

    if (endingPath) {
      const endingVideoPath = path.join(tempDir, "ending_scene.mp4");

      await new Promise<void>((resolve, reject) => {
        ffmpeg(endingPath!)
          .loop(endingDuration)
          .outputOptions([
            "-vf",
            "fps=60,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fade=t=in:st=0:d=0.8,setsar=1",
            "-r",
            "60",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
          ])
          .save(endingVideoPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      // Join main footage + ending scene using synchronized concat filter graph
      const fullVideoPath = path.join(tempDir, "full_video.mp4");

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(mergedFootagePath)
          .input(endingVideoPath)
          .complexFilter([
            "[0:v]fps=60,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v0]",
            "[1:v]fps=60,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v1]",
            "[v0][v1]concat=n=2:v=1:a=0[v]",
          ])
          .outputOptions([
            "-map", "[v]",
            "-r", "60",
            "-threads", "0",
            "-c:v", "libx264",
            "-preset", "superfast",
            "-crf", "16",
            "-pix_fmt", "yuv420p"
          ])
          .save(fullVideoPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      finalVideoPath = fullVideoPath;
    }

    // Total target video length (EXACT length of assembled finalVideoPath to prevent any black screen or cut-off ending)
    const totalOutputDuration = await getDuration(finalVideoPath);

    // 5. Generate Subtitle Overlay PNGs & Transition FX Overlay PNGs
    const subtitleSegments = await generateSubtitleOverlayPNGs(
      subtitleText,
      voDuration,
      tempDir,
      subtitleStyle,
      subtitleFontSize
    );

    // 6. Final Assembly: Video + VO + BGM + Subtitle Overlays
    const outputFinalPath = path.join(tempDir, "output_final.mp4");

    await new Promise<void>((resolve, reject) => {
      // Input 0: Main Video
      const command = ffmpeg(finalVideoPath);
      // Input 1: Voiceover Audio
      command.input(voPath);

      // Input 2: BGM Audio (if provided)
      if (bgmPath) {
        command.input(bgmPath).inputOptions(["-stream_loop", "-1"]);
      }

      // Subtitle inputs start index
      const baseSubtitleInputIndex = bgmPath ? 3 : 2;
      subtitleSegments.forEach((seg) => {
        command.input(seg.pngPath);
      });

      const complexFilters: string[] = ["[0:v]setsar=1[v0]"];
      let currentVideoLabel = "v0";

      // Overlay subtitle PNG images sequentially based on speech timestamps
      subtitleSegments.forEach((seg, index) => {
        const inputIndex = baseSubtitleInputIndex + index;
        const nextVideoLabel = `vsub_${index}`;
        complexFilters.push(
          `[${currentVideoLabel}][${inputIndex}:v]overlay=x=0:y=H-h-220:enable='between(t,${seg.start.toFixed(
            2
          )},${seg.end.toFixed(2)})'[${nextVideoLabel}]`
        );
        currentVideoLabel = nextVideoLabel;
      });

      complexFilters.push(`[${currentVideoLabel}]null[vout]`);

      // Audio Filter (VO + BGM mix with pad for ending scene)
      if (bgmPath) {
        complexFilters.push(`[1:a]apad=pad_dur=${endingDuration + 1}[vo]`);
        complexFilters.push(`[2:a]volume=${bgmVolume}[bgm]`);
        complexFilters.push(`[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
      } else {
        complexFilters.push(`[1:a]apad=pad_dur=${endingDuration + 1}[aout]`);
      }

      command.complexFilter(complexFilters.join(";"));

      const outputOptions = [
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-r",
        "60",
        "-threads",
        "0",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "14",
        "-c:a",
        "aac",
        "-b:a",
        "256k",
        "-t",
        totalOutputDuration.toFixed(2),
      ];

      command
        .outputOptions(outputOptions)
        .save(outputFinalPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    // Read final output file into response buffer
    const finalBuffer = await require("fs").promises.readFile(outputFinalPath);

    // Clean up temporary files asynchronously
    rm(tempDir, { recursive: true, force: true }).catch(() => { });

    return new NextResponse(finalBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="auto_video_9x16.mp4"',
      },
    });
  } catch (error: any) {
    console.error("Error rendering video:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses dan memotong video." }, { status: 500 });
  }
}
