import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { rawScript, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json(
        { error: "API Key Google Gemini belum diisi!" },
        { status: 400 }
      );
    }

    if (!rawScript || rawScript.trim().length === 0) {
      return NextResponse.json(
        { error: "Teks script tidak boleh kosong." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const prompt = `Anda adalah seorang ahli penulis naskah video pendek (TikTok/Reels/Shorts 30-60 detik). 
Tugas Anda adalah merapikan naskah mentah berikut menjadi teks Voice Over yang natural, komunikatif, dan menarik.

Aturan Penting:
1. Perbaiki kata-kata tidak baku menjadi kalimat yang mengalir enak didengar saat dibacakan (natural).
2. Tambahkan tanda baca koma dan titik secara tepat untuk jeda pernapasan VO.
3. Hapus instruksi visual atau catatan dalam kurung (hanya sisakan teks yang benar-benar akan dibaca oleh Voice Over).
4. Jangan menambahkan kata pembuka seperti "Tentu, ini naskah Anda:" atau sejenisnya. LANGSUNG BERIKAN HASIL NASKAHNYA SAJA.

Naskah Mentah:
"${rawScript}"`;

    const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let response: any = null;
    let lastErr: any = null;

    for (const mName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: mName,
          contents: prompt,
        });
        if (response && response.text) break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!response) throw lastErr || new Error("Gagal memanggil model Gemini.");

    const polishedText = response.text?.trim() || rawScript;

    return NextResponse.json({ polishedScript: polishedText });
  } catch (error: any) {
    console.error("Error polishing script:", error);
    return NextResponse.json(
      { error: error.message || "Gagal merapikan script." },
      { status: 500 }
    );
  }
}
