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

function wrapSubtitleText(text: string, maxCharsPerLine = 32): string[] {
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

// Generate SVG & convert to PNG via macOS built-in sips tool using separate <text> elements
async function generateSubtitleOverlayPNGs(
  subtitleText: string,
  voDuration: number,
  tempDir: string,
  subtitleStyle: string,
  subtitleFontSize: number
): Promise<SubtitleSegment[]> {
  const rawPhrases = subtitleText
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawPhrases.length === 0) return [];

  const segmentDuration = voDuration / rawPhrases.length;
  const segments: SubtitleSegment[] = [];

  // Scale font size proportionally for 1080x1920 9:16 vertical canvas (22px preset -> ~63px in 1080p canvas)
  const scaledFontSize = Math.round(subtitleFontSize * 2.85);
  const lineHeight = Math.round(scaledFontSize * 1.3);

  for (let idx = 0; idx < rawPhrases.length; idx++) {
    const text = rawPhrases[idx];
    const start = idx * segmentDuration;
    const end = (idx + 1) * segmentDuration;
    const svgPath = path.join(tempDir, `sub_${idx}.svg`);
    const pngPath = path.join(tempDir, `sub_${idx}.png`);

    // Auto-wrap long phrase into max 32 characters per line (exact 2-line layout like Screenshot 2)
    const wrappedLines = wrapSubtitleText(text, 32);
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

    try {
      await execAsync(`sips -s format png "${svgPath}" --out "${pngPath}"`);
      segments.push({ text, start, end, pngPath });
    } catch (err) {
      console.warn(`Failed to convert SVG to PNG for line ${idx}:`, err);
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

    // Define Pacing Trim Length & Color Grade Filter Graph based on editingStyle
    let targetTrimSec = 1.8;
    let colorEqFilter = "eq=saturation=1.22:contrast=1.1";

    if (editingStyle === "fast-viral") {
      targetTrimSec = 1.2; // Fast 1.2s cuts per clip
      colorEqFilter = "eq=saturation=1.28:contrast=1.14"; // Warm Food Pop
    } else if (editingStyle === "cinematic-aesthetic") {
      targetTrimSec = 3.2; // Slow 3.2s aesthetic cuts
      colorEqFilter = "eq=contrast=1.15:brightness=-0.02:saturation=1.08"; // Vintage Mood
    } else if (editingStyle === "brand-commercial") {
      targetTrimSec = 2.0; // Medium 2.0s commercial cuts
      colorEqFilter = "eq=contrast=1.08:saturation=1.16"; // Clean Commercial
    } else if (editingStyle === "soft-sweet") {
      targetTrimSec = 2.5; // 2.5s soft cuts
      colorEqFilter = "eq=brightness=0.03:saturation=1.12"; // Soft Warm Brightness
    }

    // 2. Process each footage: trim with specific pacing length & apply 9:16 + color grade
    const trimmedClips: string[] = [];
    for (let i = 0; i < footageFiles.length; i++) {
      const inputPath = footageFiles[i];
      const clipDuration = await getDuration(inputPath);

      const trimmedLen = Math.min(targetTrimSec, Math.max(1.0, clipDuration / 2));
      const startTime = Math.max(0, (clipDuration - trimmedLen) / 2);

      const outputPath = path.join(tempDir, `trimmed_${i}.mp4`);

      const filterGraph = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${colorEqFilter},setsar=1[v]`;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(trimmedLen)
          .outputOptions(["-vf", filterGraph, "-an", "-c:v", "libx264", "-preset", "fast"])
          .save(outputPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      trimmedClips.push(outputPath);
    }

    // 3. Concatenate video clips & loop if necessary to match VO duration
    const concatListPath = path.join(tempDir, "concat.txt");
    let concatContent = "";

    let currentLen = 0;
    let clipIndex = 0;
    while (currentLen < voDuration) {
      const clipPath = trimmedClips[clipIndex % trimmedClips.length];
      const duration = await getDuration(clipPath);
      concatContent += `file '${clipPath}'\n`;
      currentLen += duration;
      clipIndex++;
    }
    await writeFile(concatListPath, concatContent);

    const mergedFootagePath = path.join(tempDir, "merged_footage.mp4");
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions(["-c", "copy", "-t", voDuration.toString()])
        .save(mergedFootagePath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    // 4. Create Ending Scene (fade-in dissolve transition into ending logo)
    let finalVideoPath = mergedFootagePath;
    let endingDuration = 0;

    if (endingPath) {
      endingDuration = 2.5; // 2.5 seconds ending logo scene
      const endingVideoPath = path.join(tempDir, "ending_scene.mp4");

      await new Promise<void>((resolve, reject) => {
        ffmpeg(endingPath!)
          .loop(endingDuration)
          .outputOptions([
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fade=t=in:st=0:d=1.0,setsar=1",
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
          ])
          .save(endingVideoPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      // Join main footage + ending scene using concat filter
      const fullVideoPath = path.join(tempDir, "full_video.mp4");

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(mergedFootagePath)
          .input(endingVideoPath)
          .complexFilter([
            "[0:v]setsar=1[v0]",
            "[1:v]setsar=1[v1]",
            "[v0][v1]concat=n=2:v=1:a=0[v]",
          ])
          .outputOptions(["-map", "[v]", "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p"])
          .save(fullVideoPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      finalVideoPath = fullVideoPath;
    }

    // Total target video length (VO duration + 2.5s ending cover scene)
    const totalOutputDuration = voDuration + endingDuration;

    // 5. Generate Subtitle Overlay PNGs (San Francisco Regular + Drop Shadow + Multi-Line Wrapping)
    const subtitleSegments = await generateSubtitleOverlayPNGs(
      subtitleText,
      voDuration,
      tempDir,
      subtitleStyle,
      subtitleFontSize
    );

    // 6. Final Assembly: Video + VO + BGM + Subtitle Burn-in Overlays
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

      // Input 3 (or 2 if no BGM): Subtitle PNGs
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
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
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
    rm(tempDir, { recursive: true, force: true }).catch(() => {});

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
