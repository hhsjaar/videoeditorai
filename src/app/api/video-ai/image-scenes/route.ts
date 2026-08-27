import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const SCENE_SCHEMA = {
  type: "object",
  properties: {
    imageIndex: { type: "integer", description: "Index gambar sumber (0-indexed, sesuai urutan gambar yang dilampirkan)" },
    duration: { type: "integer", enum: [4, 6, 8], description: "Durasi klip — HARUS 4, 6, atau 8 detik" },
    voiceoverText: { type: "string", description: "Narasi VO Bahasa Indonesia natural untuk klip ini, pas dengan durasi, menyambung jadi satu naskah utuh kalau digabung semua klip" },
    visualPrompt: {
      type: "string",
      description: "Prompt Bahasa Inggris untuk AI video engine (image-to-video) — gambar sumbernya SUDAH ada, jadi fokus prompt ini ke: aksi/gerakan yang terjadi, pergerakan kamera, dan audio (dialog/ambience/sound effect). JANGAN deskripsikan ulang tampilan statis gambar secara detail (itu sudah dari foto), cukup sebutkan singkat konteksnya lalu fokus ke motion & audio.",
    },
    cameraMotion: { type: "string", enum: ["zoom-in", "zoom-out", "pan-left", "pan-right", "slow-tilt", "dolly-forward"] },
    transition: { type: "string", enum: ["light-leak", "zoom-blur", "flash-white", "fade-black", "film-burn", "passerby"] },
    overlayTitle: { type: "string", description: "Teks judul/kata kunci singkat, atau string kosong" },
  },
  required: ["imageIndex", "duration", "voiceoverText", "visualPrompt", "cameraMotion", "transition", "overlayTitle"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    videoTitle: { type: "string" },
    clarifyingQuestions: {
      type: "array",
      description: "Pertanyaan klarifikasi untuk gambar yang kontennya kurang jelas/ambigu — kosongkan array ini kalau semua gambar sudah cukup jelas dimengerti.",
      items: {
        type: "object",
        properties: {
          imageIndex: { type: "integer" },
          question: { type: "string", description: "Pertanyaan singkat ke user, Bahasa Indonesia, contoh: 'Foto ke-2 ini gambar apa ya? Kurang jelas kelihatannya menu atau interior.'" },
        },
        required: ["imageIndex", "question"],
      },
    },
    scenes: { type: "array", items: SCENE_SCHEMA, description: "Satu entri per gambar, urutan sesuai imageIndex — tetap isi best-effort walau ada clarifyingQuestions" },
  },
  required: ["videoTitle", "clarifyingQuestions", "scenes"],
};

export async function POST(req: NextRequest) {
  try {
    const { images, userContext, imageHints, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const hintsText = imageHints && Object.keys(imageHints).length > 0
      ? `\nKlarifikasi dari user untuk gambar tertentu:\n${Object.entries(imageHints).map(([idx, ans]) => `- Gambar ${idx}: ${ans}`).join("\n")}\n(Pakai info ini, JANGAN tanya ulang hal yang sama — kalau masih kurang yakin soal hal lain, boleh tetap tanya, tapi buat best-effort scene-nya juga.)`
      : "";

    const parts: any[] = images.map((img: any, i: number) => ({ inlineData: { mimeType: img.mimeType || "image/jpeg", data: img.base64 } }));
    parts.push({
      text: `Anda adalah content strategist + penulis naskah video iklan. Di atas ada ${images.length} gambar (index 0 sampai ${images.length - 1}, urut sesuai lampiran), yang masing-masing akan jadi SATU klip video (dianimasikan dari gambar itu apa adanya, image-to-video).
${userContext ? `Konteks dari user: "${userContext}"` : ""}${hintsText}

Tugas:
1. Untuk SETIAP gambar, tulis satu "scene": narasi VO Bahasa Indonesia natural yang match dengan apa yang terlihat di gambar itu, dan prompt motion/audio Bahasa Inggris untuk video engine (gambar sumbernya sudah ada, prompt cukup fokus ke aksi/gerakan yang mestinya terjadi + kamera + audio).
2. Kalau digabung urut, seluruh narasi VO harus mengalir jadi satu naskah utuh dengan hook di awal dan penutup yang pas di akhir — bukan potongan-potongan lepas.
3. Kalau ada gambar yang isinya kurang jelas/ambigu (susah dipastikan itu gambar apa), tambahkan entry di "clarifyingQuestions" untuk index gambar itu — TAPI tetap isi scene dengan best-effort guess juga (jangan dikosongkan).
4. "duration" tiap scene HARUS 4, 6, atau 8 detik saja.`,
    });

    const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro"];
    let responseText = "";
    let lastErr: any = null;
    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: [{ role: "user", parts }],
          config: { temperature: 0.6, responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA },
        });
        if (response?.text) { responseText = response.text; break; }
      } catch (err) { lastErr = err; }
    }
    if (!responseText) throw lastErr || new Error("Gagal menganalisis gambar.");

    const parsed = JSON.parse(responseText);
    const scenes = (parsed.scenes || [])
      .slice()
      .sort((a: any, b: any) => a.imageIndex - b.imageIndex)
      .map((sc: any, i: number) => {
        const src = images[sc.imageIndex] || images[i];
        return {
          ...sc,
          sceneNumber: i + 1,
          sourceImageBase64: src?.base64,
          sourceImageMimeType: src?.mimeType || "image/jpeg",
        };
      });

    return NextResponse.json({
      success: true,
      clarifyingQuestions: parsed.clarifyingQuestions || [],
      refinedData: {
        videoTitle: parsed.videoTitle || "Video AI Project",
        summary: "",
        aspectRatio: "9:16",
        stylePreset: "cinematic",
        scenes,
      },
    });
  } catch (error: any) {
    console.error("Error generating image scenes:", error);
    return NextResponse.json({ error: error.message || "Gagal menyusun naskah dari gambar." }, { status: 500 });
  }
}
