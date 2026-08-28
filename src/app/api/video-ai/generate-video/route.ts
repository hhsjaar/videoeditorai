import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { enqueueVeoJob, type VeoQuality } from "@/lib/veoQueue";

const VALID_QUALITIES: VeoQuality[] = ["lite", "fast", "standard", "kling"];
const VALID_DURATIONS = [4, 6, 8];
const VALID_KLING_DURATIONS = [5, 10];

// Rounds UP to the nearest provider-legal duration (never down) — a clip
// shorter than its narration's actual length would chop the voiceover off
// mid-word. Veo allows 4/6/8s; Kling (fal.ai) only allows 5/10s.
function clampToVeoDuration(requested: number): 4 | 6 | 8 {
  return (VALID_DURATIONS.find((v) => v >= requested) ?? 8) as 4 | 6 | 8;
}
function clampToKlingDuration(requested: number): 5 | 10 {
  return (VALID_KLING_DURATIONS.find((v) => v >= requested) ?? 10) as 5 | 10;
}

// Deterministic fallback seed (fits Veo's int32-ish range) for refinedData
// that never had an explicit one — same title always hashes to the same
// number, so scenes fired as separate per-clip requests still share a seed.
function hashSeed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2147483647;
}

export async function POST(req: NextRequest) {
  try {
    const {
      refinedData,
      generationMode = "veo-video", // 'storyboard-motion' (image-only preview) or 'veo-video' (real Veo generation)
      quality = "lite",
      apiKey,
    } = await req.json();

    const veoQuality: VeoQuality = VALID_QUALITIES.includes(quality) ? quality : "lite";

    if (veoQuality === "kling") {
      if (!process.env.FAL_KEY) {
        return NextResponse.json({ error: "API Key fal.ai (FAL_KEY) belum dikonfigurasi di server." }, { status: 400 });
      }
    } else {
      const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeApiKey) {
        return NextResponse.json(
          { error: "API Key Google Gemini belum dikonfigurasi." },
          { status: 400 }
        );
      }
    }

    if (!refinedData || !refinedData.scenes || refinedData.scenes.length === 0) {
      return NextResponse.json(
        { error: "Data adegan video tidak ditemukan." },
        { status: 400 }
      );
    }

    const scenes = refinedData.scenes;

    // Ensure public output dir exists for generated assets
    const publicGenDir = path.join(process.cwd(), "public", "generated-ai");
    if (!fs.existsSync(publicGenDir)) {
      await mkdir(publicGenDir, { recursive: true });
    }

    const generatedScenes: any[] = [];
    const timestamp = Date.now();

    // 1. Process each scene: build a placeholder poster (covers the player
    // while the real Veo job is in flight) and kick off generation.
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const visualPrompt = sc.visualPrompt || `Cinematic scene ${i + 1} for ${refinedData.videoTitle || "Video"}`;
      let visualUrl = "";

      // Scenes anchored to a reference/storyboard image already have a real
      // photo to show as the poster — no need to generate one.
      if (sc.sourceImageBase64) {
        const ext = sc.sourceImageMimeType === "image/png" ? "png" : "jpg";
        const filename = `scene_src_${timestamp}_${i + 1}.${ext}`;
        await writeFile(path.join(publicGenDir, filename), Buffer.from(sc.sourceImageBase64, "base64"));
        visualUrl = `/generated-ai/${filename}`;
      }

      // Otherwise, generate a stylized SVG placeholder locally (free, instant —
      // no external image-gen call on the critical path).
      if (!visualUrl) {
        const colors = [
          ["#1e1b4b", "#4338ca", "#06b6d4"],
          ["#311042", "#831843", "#f43f5e"],
          ["#042f2e", "#0d9488", "#2dd4bf"],
          ["#18181b", "#27272a", "#3b82f6"],
          ["#451a03", "#b45309", "#fbbf24"],
        ];
        const colorSet = colors[i % colors.length];

        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
          <defs>
            <radialGradient id="bgGrad_${i}" cx="50%" cy="40%" r="80%">
              <stop offset="0%" stop-color="${colorSet[1]}" />
              <stop offset="50%" stop-color="${colorSet[0]}" />
              <stop offset="100%" stop-color="#09090b" />
            </radialGradient>
            <linearGradient id="glow_${i}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${colorSet[2]}" stop-opacity="0.8" />
              <stop offset="100%" stop-color="${colorSet[1]}" stop-opacity="0.2" />
            </linearGradient>
            <filter id="blur_${i}">
              <feGaussianBlur stdDeviation="60" />
            </filter>
          </defs>
          <rect width="1080" height="1920" fill="url(#bgGrad_${i})" />
          <circle cx="540" cy="700" r="380" fill="url(#glow_${i})" filter="url(#blur_${i})" opacity="0.6" />
          <circle cx="200" cy="1200" r="280" fill="${colorSet[2]}" filter="url(#blur_${i})" opacity="0.3" />
          <rect x="80" y="80" width="920" height="1760" rx="32" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
          <g transform="translate(540, 680)" text-anchor="middle">
            <circle cx="0" cy="0" r="90" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" stroke-width="3" />
            <text x="0" y="16" font-family="system-ui, sans-serif" font-size="52" fill="#ffffff" font-weight="900">SCENE ${i + 1}</text>
          </g>
          <g transform="translate(540, 880)" text-anchor="middle">
            <rect x="-380" y="-40" width="760" height="80" rx="40" fill="rgba(0,0,0,0.5)" stroke="${colorSet[2]}" stroke-width="2" />
            <text x="0" y="14" font-family="system-ui, sans-serif" font-size="34" fill="#ffffff" font-weight="bold">${sc.overlayTitle || `Scene ${i + 1}`}</text>
          </g>
          <foreignObject x="120" y="1000" width="840" height="600">
            <div xmlns="http://www.w3.org/1999/xhtml" style="color: rgba(255,255,255,0.85); font-family: system-ui, sans-serif; font-size: 32px; line-height: 1.5; text-align: center; background: rgba(0,0,0,0.4); padding: 32px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 16px 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; color: ${colorSet[2]};">🎥 Visual Prompt</p>
              <p style="margin: 0; font-size: 28px; font-style: italic;">"${visualPrompt.substring(0, 180)}..."</p>
            </div>
          </foreignObject>
        </svg>`;

        const svgFilename = `scene_visual_${timestamp}_${i + 1}.svg`;
        const svgPath = path.join(publicGenDir, svgFilename);
        await writeFile(svgPath, svgContent, "utf-8");
        visualUrl = `/generated-ai/${svgFilename}`;
      }

      // Kick off REAL Veo video generation for this scene (async — don't await).
      // The placeholder visualUrl above covers the player while this is in flight.
      let veoJobId: string | null = null;
      let veoStatus: "generating" | "skipped" = "skipped";
      if (generationMode === "veo-video") {
        veoJobId = randomUUID();
        veoStatus = "generating";
        enqueueVeoJob({
          jobId: veoJobId,
          prompt: visualPrompt,
          quality: veoQuality,
          durationSeconds: veoQuality === "kling" ? clampToKlingDuration(sc.duration || 5) : clampToVeoDuration(sc.duration || 8),
          aspectRatio: refinedData.aspectRatio === "16:9" ? "16:9" : "9:16",
          // When this scene came from an uploaded/storyboard reference image,
          // Veo animates FROM that photo instead of imagining it from text —
          // keeps real places/products faithful instead of hallucinated.
          imageBytes: sc.sourceImageBase64 || undefined,
          imageMimeType: sc.sourceImageMimeType || undefined,
          // Kling has no native audio — narration gets generated separately
          // via TTS and muxed in (see veoQueue.ts). Unused for Veo, which
          // already speaks its dialogue baked into visualPrompt/prompt.
          voiceoverText: veoQuality === "kling" ? (sc.voiceoverText || undefined) : undefined,
          voiceName: refinedData.voice || undefined,
          // Reused across every scene in this project so Veo's clips actually
          // look like the same shoot instead of each rolling a fresh random
          // look — falls back to a deterministic hash of the title so scenes
          // fired in separate requests (one per clip) still land on the same
          // seed even for older refinedData that never set one explicitly.
          seed: typeof refinedData.seed === "number" ? refinedData.seed : hashSeed(refinedData.videoTitle || "video-ai"),
        });
      }

      generatedScenes.push({
        id: `scene-${i + 1}`,
        sceneNumber: i + 1,
        duration: sc.duration || 5,
        visualUrl: visualUrl,
        visualPrompt: visualPrompt,
        voiceoverText: sc.voiceoverText || "",
        cameraMotion: sc.cameraMotion || "zoom-in",
        transition: sc.transition || "light-leak",
        overlayTitle: sc.overlayTitle || "",
        veoJobId,
        veoStatus,
        videoUrl: null as string | null,
      });
    }

    // 2. Combine full voiceover text
    const fullScript = generatedScenes.map((s) => s.voiceoverText).filter(Boolean).join(" ");

    return NextResponse.json({
      success: true,
      data: {
        videoTitle: refinedData.videoTitle || "Video AI Project",
        summary: refinedData.summary || "",
        aspectRatio: refinedData.aspectRatio || "9:16",
        stylePreset: refinedData.stylePreset || "cinematic",
        voice: refinedData.voice || "Zephyr",
        bgmId: refinedData.bgmId || "bsl1",
        fullScript: fullScript,
        scenes: generatedScenes,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in generate-video route:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses pembuatan video AI." },
      { status: 500 }
    );
  }
}
