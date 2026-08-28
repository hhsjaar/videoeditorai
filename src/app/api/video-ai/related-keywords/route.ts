import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      items: { type: "string" },
      description: "TEPAT 10 kata kunci turunan/lebih spesifik dari kata kunci yang diberikan, dalam Bahasa Indonesia, yang kemungkinan besar dipakai orang saat mencari topik ini",
    },
  },
  required: ["keywords"],
};

export async function POST(req: NextRequest) {
  try {
    const { keyword, path, originalPrompt, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }
    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json({ error: "Kata kunci tidak ditemukan." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const trail = Array.isArray(path) && path.length > 0 ? path.join(" → ") : keyword;
    const systemPrompt = `Anda adalah content strategist yang ahli riset kata kunci untuk video pendek Indonesia (TikTok/Reels/Shorts).
${originalPrompt ? `Ide awal user: "${originalPrompt}"` : ""}
Jejak eksplorasi sejauh ini: ${trail}

Tugas: berikan TEPAT 10 kata kunci yang lebih SPESIFIK/turunan dari "${keyword}" — sub-topik, angle, atau pertanyaan spesifik yang orang Indonesia kemungkinan besar cari terkait "${keyword}" ini. Jangan cuma sinonim, harus benar-benar mempersempit/mengembangkan topiknya ke arah yang lebih konkret. Bahasa Indonesia natural, singkat (maks 4-5 kata per keyword).`;

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
        console.warn(`[related-keywords] failed on ${mName}:`, err?.message?.slice(0, 200));
        lastErr = err;
      }
    }
    if (!responseText) throw lastErr || new Error("Gagal mencari kata kunci terkait.");

    const parsed = JSON.parse(responseText);
    return NextResponse.json({ success: true, keywords: parsed.keywords || [] });
  } catch (error: any) {
    console.error("Error generating related keywords:", error);
    return NextResponse.json({ error: error.message || "Gagal mencari kata kunci terkait." }, { status: 500 });
  }
}
