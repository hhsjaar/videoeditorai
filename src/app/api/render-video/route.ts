import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

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
    const subtitleText = (formData.get("subtitleText") as string) || "";
    const editingStyle = (formData.get("editingStyle") as string) || "fast-viral";
    const subtitleStyle = (formData.get("subtitleStyle") as string) || "plain-shadow";
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

    if (footageFiles.length === 0) {
      return NextResponse.json({ error: "Minimal upload 1 klip video." }, { status: 400 });
    }

    // 1. Save uploaded footage files to disk
    const savedFootagePaths: string[] = [];
    for (let i = 0; i < footageFiles.length; i++) {
      const file = footageFiles[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name) || ".mp4";
      const filePath = path.join(tempDir, `footage_${i}${ext}`);
      await writeFile(filePath, buffer);
      savedFootagePaths.push(filePath);
    }

    // 2. Save Voice Over & BGM audio files
    let savedVoPath = "";
    if (voiceOverFile) {
      const buffer = Buffer.from(await voiceOverFile.arrayBuffer());
      savedVoPath = path.join(tempDir, "voiceover.mp3");
      await writeFile(savedVoPath, buffer);
    }

    let savedBgmPath = "";
    if (bgmFile) {
      const buffer = Buffer.from(await bgmFile.arrayBuffer());
      savedBgmPath = path.join(tempDir, "bgm.mp3");
      await writeFile(savedBgmPath, buffer);
    }

    // 3. Build footage items array for Remotion
    const footageItems = savedFootagePaths.map((fPath, idx) => {
      const customDur = clipDurationsList[idx] && clipDurationsList[idx] > 0 ? clipDurationsList[idx] : defaultTrimSec;
      return {
        url: fPath,
        duration: customDur,
        colorGrade: editingStyle,
      };
    });

    // 4. Build subtitle chunks array for Remotion
    const subtitleChunksList: Array<{ text: string; start: number; end: number }> = [];
    if (subtitleText.trim()) {
      const textChunks = splitTextIntoAutoCaptionChunks(subtitleText, 3);
      const totalSec = footageItems.reduce((acc, f) => acc + f.duration, 0);
      const chunkDur = totalSec / Math.max(1, textChunks.length);
      for (let i = 0; i < textChunks.length; i++) {
        subtitleChunksList.push({
          text: textChunks[i],
          start: i * chunkDur,
          end: (i + 1) * chunkDur,
        });
      }
    }

    // 5. Bundle Remotion entry point
    const entryPoint = path.join(process.cwd(), "src/remotion/Root.tsx");
    const serveUrl = await bundle({
      entryPoint,
    });

    // 6. Select Remotion composition & input props
    const inputProps = {
      footages: footageItems,
      transitions: transitionsList,
      subtitles: subtitleChunksList,
      voiceOverUrl: savedVoPath || undefined,
      bgmUrl: savedBgmPath || undefined,
      bgmVolume: bgmVolume,
      subtitleStyle: subtitleStyle,
      clipDuration: defaultTrimSec,
    };

    const composition = await selectComposition({
      serveUrl,
      id: "MainComposition",
      inputProps,
    });

    // 7. Render high-quality MP4 video via Remotion renderer
    const finalVideoPath = path.join(tempDir, "final_export.mp4");
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: finalVideoPath,
      inputProps,
    });

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
