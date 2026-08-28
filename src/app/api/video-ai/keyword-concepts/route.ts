import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Same shape as concepts/route.ts's CONCEPT_SCHEMA — kept identical so these
// cards render with the existing ConceptCard component and flow straight
// into the existing pick-concept -> QA -> storyboard pipeline unchanged.
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
    concepts: { type: "array", minItems: 10, maxItems: 10, items: CONCEPT_SCHEMA, description: "TEPAT 10 angle konten yang spesifik untuk kata kunci ini" },
  },
  required: ["concepts"],
};

export async function POST(req: NextRequest) {
  try {
    const { keyword, originalPrompt, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }
    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json({ error: "Kata kunci tidak ditemukan." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const systemPrompt = `Anda adalah content strategist & Creative Director kelas dunia untuk pasar Indonesia, platform video pendek (TikTok, Reels, Shorts).
${originalPrompt ? `Ide awal user: "${originalPrompt}"` : ""}
Kata kunci yang dipilih user untuk dieksplorasi lebih dalam: "${keyword}"

Tugas: berikan TEPAT 10 angle konten yang SPESIFIK untuk kata kunci "${keyword}" ini (bukan angle generik yang bisa dipakai buat kata kunci lain) — variasikan sudut pandang, format, dan hook-nya. Untuk tiap concept, isi lengkap: title, angle, hook, summary (jelaskan kenapa angle ini menarik/relevan sekarang untuk kata kunci ini), targetAudience, vibeTags, recommendedVoice, recommendedBgm, visualStyle, previewScript. Bahasa Indonesia yang natural, menarik, sesuai tren video modern — bukan bahasa iklan kaku.`;

    const candidateModels = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3-flash-preview"];
    let responseText = "";
    let lastErr: any = null;
    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: systemPrompt,
          config: { temperature: 0.8, responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA },
        });
        if (response?.text) { responseText = response.text; break; }
      } catch (err: any) {
        console.warn(`[keyword-concepts] failed on ${mName}:`, err?.message?.slice(0, 200));
        lastErr = err;
      }
    }
    if (!responseText) throw lastErr || new Error("Gagal menyusun konsep untuk kata kunci ini.");

    const parsed = JSON.parse(responseText);
    return NextResponse.json({ success: true, concepts: parsed.concepts || [] });
  } catch (error: any) {
    console.error("Error generating keyword concepts:", error);
    return NextResponse.json({ error: error.message || "Gagal menyusun konsep." }, { status: 500 });
  }
}
