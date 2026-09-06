import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { enqueueVeoJob } from "@/lib/veoQueue";
import { auth } from "@/lib/auth";
import { chargeVideoCredits, getBalances, InsufficientCreditsError } from "@/lib/credits";

const VALID_KLING_DURATIONS = [5, 10];

// Rounds UP to the nearest provider-legal duration (never down) — a clip
// shorter than its narration's actual length would chop the voiceover off
// mid-word. This commercial build only ever generates on Kling (5/10s).
function clampToKlingDuration(requested: number): 5 | 10 {
  return (VALID_KLING_DURATIONS.find((v) => v >= requested) ?? 10) as 5 | 10;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
    }
    const userId = session.user.id;

    const { hasVideoPackage } = await getBalances(userId);
    if (!hasVideoPackage) {
      return NextResponse.json(
        { error: "Fitur generate video butuh paket Rp999.000.", code: "NEEDS_PACKAGE" },
        { status: 403 }
      );
    }

    const { refinedData, generationMode = "veo-video" } = await req.json();

    // This commercial build always renders on Kling — the client never
    // chooses a provider, and any client-sent value is ignored here too.
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "API Key fal.ai (FAL_KEY) belum dikonfigurasi di server." }, { status: 400 });
    }

    if (!refinedData || !refinedData.scenes || refinedData.scenes.length === 0) {
      return NextResponse.json(
        { error: "Data adegan video tidak ditemukan." },
        { status: 400 }
      );
    }

    const scenes = refinedData.scenes;

    // Pre-check the whole batch's cost against the balance before enqueueing
    // anything — cheaper to fail the whole request up front than to enqueue
    // some scenes and then run out of balance partway through the loop.
    if (generationMode === "veo-video") {
      const totalNeeded = scenes.reduce((acc: number, sc: any) => acc + clampToKlingDuration(sc.duration || 5), 0);
      const { videoCreditsBalance } = await getBalances(userId);
      if (videoCreditsBalance < totalNeeded) {
        return NextResponse.json(
          { error: `Kredit video tidak cukup (butuh ${totalNeeded}, tersisa ${videoCreditsBalance}).`, code: "INSUFFICIENT_CREDITS" },
          { status: 402 }
        );
      }
    }

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

      // Kick off REAL video generation for this scene (async — don't await).
      // The placeholder visualUrl above covers the player while this is in flight.
      // Always Kling — this commercial build never exposes Veo to end users.
      let veoJobId: string | null = null;
      let veoStatus: "generating" | "skipped" | "error" = "skipped";
      if (generationMode === "veo-video") {
        veoJobId = randomUUID();
        veoStatus = "generating";
        const durationSeconds = clampToKlingDuration(sc.duration || 5);

        try {
          await chargeVideoCredits(userId, durationSeconds, veoJobId, "video_generation_charge");
        } catch (err: any) {
          if (err instanceof InsufficientCreditsError) {
            generatedScenes.push({
              id: `scene-${i + 1}`,
              sceneNumber: i + 1,
              duration: sc.duration || 5,
              visualUrl,
              visualPrompt,
              voiceoverText: sc.voiceoverText || "",
              cameraMotion: sc.cameraMotion || "zoom-in",
              transition: sc.transition || "light-leak",
              overlayTitle: sc.overlayTitle || "",
              veoJobId: null,
              veoStatus: "error",
              veoError: "Kredit video tidak cukup.",
              videoUrl: null as string | null,
            });
            continue;
          }
          throw err;
        }

        enqueueVeoJob({
          jobId: veoJobId,
          userId,
          prompt: visualPrompt,
          quality: "kling",
          durationSeconds,
          aspectRatio: refinedData.aspectRatio === "16:9" ? "16:9" : "9:16",
          // When this scene came from an uploaded/storyboard reference image,
          // Kling animates FROM that photo instead of imagining it from text —
          // keeps real places/products faithful instead of hallucinated.
          imageBytes: sc.sourceImageBase64 || undefined,
          imageMimeType: sc.sourceImageMimeType || undefined,
          // Kling has no native audio — narration gets generated separately
          // via TTS and muxed in (see veoQueue.ts).
          voiceoverText: sc.voiceoverText || undefined,
          voiceName: refinedData.voice || undefined,
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
