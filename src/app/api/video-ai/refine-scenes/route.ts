import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const SCENE_SCHEMA = {
  type: "object",
  properties: {
    sceneNumber: { type: "integer" },
    duration: { type: "integer", enum: [4, 6, 8], description: "Durasi scene dalam detik — HARUS salah satu dari 4, 6, atau 8 (batasan AI video engine)" },
    visualPrompt: { type: "string", description: "Prompt visual Bahasa Inggris yang sangat deskriptif untuk AI video engine — HARUS menyebutkan characterDescription persis sama jika scene menampilkan karakter utama" },
    voiceoverText: { type: "string", description: "Teks voice over Bahasa Indonesia natural, komunikatif, pas dengan durasi" },
    cameraMotion: { type: "string", enum: ["zoom-in", "zoom-out", "pan-left", "pan-right", "slow-tilt", "dolly-forward"] },
    transition: { type: "string", enum: ["light-leak", "zoom-blur", "flash-white", "fade-black", "film-burn", "passerby"] },
    overlayTitle: { type: "string", description: "Teks judul/kata kunci singkat penarik perhatian, atau string kosong jika tidak perlu" },
  },
  required: ["sceneNumber", "duration", "visualPrompt", "voiceoverText", "cameraMotion", "transition", "overlayTitle"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    videoTitle: { type: "string" },
    summary: { type: "string" },
    characterDescription: {
      type: "string",
      description: "Deskripsi karakter utama (umur, pakaian, rambut, ciri khas) yang HARUS dipakai identik di setiap scene yang menampilkan karakter — string kosong jika video ini faceless/tanpa karakter tetap.",
    },
    scenes: { type: "array", minItems: 4, maxItems: 6, items: SCENE_SCHEMA },
  },
  required: ["videoTitle", "summary", "characterDescription", "scenes"],
};

export async function POST(req: NextRequest) {
  try {
    const {
      concept,
      userPrompt,
      customInstructions,
      aspectRatio = "9:16",
      stylePreset = "cinematic",
      voice = "Zephyr",
      bgmId = "bsl1",
      targetDuration = 30,
      apiKey,
    } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json(
        { error: "API Key Google Gemini belum dikonfigurasi." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const systemPrompt = `Anda adalah Lead Director & AI Video Cinematographer.
Tugas Anda adalah merombak dan mematangkan Konsep Video terpilih menjadi naskah breakdown scene-by-scene yang sangat terstruktur, visual-rich, dan siap digenerate oleh AI Video Engine.

Detail Input:
- Ide Awal: "${userPrompt || ""}"
- Konsep Terpilih: ${JSON.stringify(concept || {}, null, 2)}
- Catatan Tambahan dari User: "${customInstructions || "Optimalkan untuk engagement maksimal"}"
- Aspek Rasio: ${aspectRatio}
- Style Visual Preset: ${stylePreset}
- Suara Voice Over: ${voice}
- BGM Track: ${bgmId}
- Target Total Durasi: ${targetDuration} detik (buat antara 4 sampai 6 adegan/scene, total durasi mendekati target)

Aturan Penting:
1. Buat antara 4 sampai 6 scenes. Setiap scene HARUS bisa berdiri sendiri secara visual.
2. Kalau konsep video ini menampilkan karakter utama (bukan video faceless/b-roll murni), tentukan SATU "characterDescription" (umur, pakaian, rambut, ciri khas) di awal. Setiap "visualPrompt" scene yang menampilkan karakter itu WAJIB merujuk deskripsi yang SAMA PERSIS — supaya karakternya konsisten dari scene ke scene, bukan berubah-ubah. Kalau videonya faceless, kosongkan characterDescription dan jangan sebut karakter di visualPrompt manapun.
3. "duration" tiap scene HARUS salah satu dari 4, 6, atau 8 detik saja (batasan teknis AI video engine) — jangan nilai lain.
4. "visualPrompt": Bahasa Inggris, sangat deskriptif, fotorealistik/sinematik (sebutkan subjek+deskripsi detail, aksi spesifik, lokasi & waktu, pergerakan kamera, pencahayaan & mood, gaya visual, 8k resolution, photorealistic cinematic film).
5. "voiceoverText": Bahasa Indonesia yang natural, komunikatif, bukan bahasa iklan kaku, pas dengan durasi.
6. Seluruh naskah voiceover jika digabungkan harus mengalir enak didengar dan memiliki hook, isi yang padat, dan call-to-action di akhir.`;

    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let responseText = "";
    let lastErr: any = null;

    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: systemPrompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: RESPONSE_SCHEMA,
          },
        });
        if (response && response.text) {
          responseText = response.text;
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!responseText) {
      throw lastErr || new Error("Gagal mengolah breakdown scene Gemini.");
    }

    const parsedData = JSON.parse(responseText);
    return NextResponse.json({
      success: true,
      refinedData: {
        ...parsedData,
        aspectRatio,
        stylePreset,
        voice,
        bgmId,
        totalDuration: targetDuration,
      },
    });
  } catch (error: any) {
    console.error("Error refining video scenes:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menyusun naskah adegan video." },
      { status: 500 }
    );
  }
}
