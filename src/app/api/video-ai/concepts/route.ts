import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const CONCEPT_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string", description: "Judul konsep yang catchy" },
    angle: { type: "string", description: "Sudut pandang/style, misal: Sinematik & Storytelling Emosional" },
    hook: { type: "string", description: "Satu kalimat hook pembuka 3 detik pertama" },
    summary: { type: "string", description: "Ringkasan konsep dalam 2-3 kalimat, jelaskan juga kenapa angle ini menarik/relevan sekarang" },
    targetAudience: { type: "string" },
    vibeTags: { type: "array", items: { type: "string" } },
    recommendedVoice: { type: "string", enum: ["Zephyr", "Puck", "Kore", "Fenrir", "Aoede", "Charon"] },
    recommendedBgm: { type: "string", enum: ["bsl1", "bsl2", "bsl3", "bsl4", "bsl5", "bsl6", "bsl7", "bsl8", "bsl9", "bsl10"] },
    visualStyle: { type: "string" },
    previewScript: { type: "string" },
  },
  required: ["id", "title", "angle", "hook", "summary", "targetAudience", "vibeTags", "recommendedVoice", "recommendedBgm", "visualStyle", "previewScript"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    keywords: { type: "array", items: { type: "string" }, description: "Kata kunci yang kemungkinan besar dipakai orang Indonesia saat mencari topik ini" },
    concepts: { type: "array", minItems: 5, maxItems: 5, items: CONCEPT_SCHEMA, description: "5 angle konten yang lagi relevan" },
    rareConcepts: { type: "array", minItems: 3, maxItems: 3, items: CONCEPT_SCHEMA, description: "3 sudut pandang yang JARANG dipakai kreator lain" },
  },
  required: ["keywords", "concepts", "rareConcepts"],
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspectRatio = "9:16", targetDuration = 30, tone = "kreatif", apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json(
        { error: "API Key Google Gemini belum dikonfigurasi. Silakan masukkan API Key di menu pengaturan." },
        { status: 400 }
      );
    }

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Ide prompt video tidak boleh kosong." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const systemPrompt = `Anda adalah content strategist & Creative Director kelas dunia yang fokus di pasar Indonesia, untuk platform video pendek (TikTok, Instagram Reels, YouTube Shorts).

Ide/Prompt dari User:
"${prompt}"

Parameter Tambahan:
- Aspek Rasio: ${aspectRatio}
- Target Durasi: ${targetDuration} detik
- Gaya / Tone yang diinginkan: ${tone}

Tolong bantu:
1. Berikan kata kunci ("keywords") yang kemungkinan besar dipakai orang Indonesia saat mencari topik ini.
2. Berikan 5 angle konten ("concepts") yang lagi relevan buat topik ini, jelaskan singkat kenapa tiap angle menarik (di field "summary"), lengkap dengan hook 3 detik pertama.
3. Berikan 3 sudut pandang ("rareConcepts") yang JARANG dipakai kreator lain untuk topik ini — tetap harus siap produksi (isi field sama seperti concepts biasa).

Untuk SETIAP concept (baik yang biasa maupun rareConcepts), tentukan juga: target audiens, vibe tags, suara & BGM yang direkomendasikan (dari daftar di bawah), gaya visual, dan contoh naskah pembuka singkat.

Pilihan voice yang tersedia:
- Zephyr (Pria Warm & Energetik)
- Puck (Wanita Soft & Lembut)
- Kore (Wanita Berwibawa)
- Fenrir (Pria Sinematik Deep)
- Aoede (Wanita Ceria Commercial)
- Charon (Pria Santai Vlog)

Pilihan BGM yang tersedia: bsl1, bsl2, bsl3, bsl4, bsl5, bsl6, bsl7, bsl8, bsl9, bsl10.
Pastikan seluruh konten berbahasa Indonesia yang alami, menarik, dan sesuai dengan tren video modern — bukan bahasa iklan yang kaku.`;

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
      throw lastErr || new Error("Gagal menghubungi model Gemini.");
    }

    const parsedData = JSON.parse(responseText);
    const mainConcepts = (parsedData.concepts || []).map((c: any) => ({ ...c, isRareAngle: false }));
    const rareConcepts = (parsedData.rareConcepts || []).map((c: any) => ({ ...c, isRareAngle: true }));

    return NextResponse.json({
      success: true,
      keywords: parsedData.keywords || [],
      concepts: [...mainConcepts, ...rareConcepts],
    });
  } catch (error: any) {
    console.error("Error generating video concepts:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat konsep video." },
      { status: 500 }
    );
  }
}
