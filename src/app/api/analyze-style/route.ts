import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, videoDescription } = await req.json();

    if (!videoUrl && !videoDescription) {
      return NextResponse.json(
        { error: "Masukkan link video Instagram/TikTok atau deskripsi video referensi." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY belum dikonfigurasi di file .env.local" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Anda adalah seorang Master Video Editor & Viral Content Strategist kelas dunia khusus untuk konten Instagram Reels & TikTok F&B/Brand.
Tugas Anda adalah menganalisis gaya editing, tipografi subtitle, mood BGM, dan ritme pemotongan dari link/deskripsi video berikut:

Link/Deskripsi Video Referensi: "${videoUrl || videoDescription}"

Berikan analisis mendalam dan hasilkan respon berformat JSON murni tanpa markdown triple backticks dengan struktur persis seperti berikut:
{
  "styleName": "Nama gaya editing (misal: Viral Aesthetic Cafe & Food Vlog)",
  "pace": "Tempo pemotongan clip (misal: Cepat 1.5 detik per potong)",
  "subtitleStyle": "plain-shadow",
  "subtitleFontSize": 24,
  "recommendedBgmId": "fnb-modern-cafe",
  "recommendedBgmTitle": "Modern Cafe & Aesthetic Chill",
  "colorMood": "Tone warna (misal: Warm & Creamy Aesthetic)",
  "hookAnalysis": "Analisis daya tarik 3 detik pertama (hook)",
  "editingTips": [
    "Tips konkret 1",
    "Tips konkret 2",
    "Tips konkret 3"
  ]
}

Aturan penentuan subtitleStyle & recommendedBgmId:
- subtitleStyle HARUS bernilai salah satu dari: 'plain-shadow', 'yellow', 'white', 'neon', 'box'
- recommendedBgmId HARUS bernilai salah satu dari: 'fnb-modern-cafe', 'fnb-trendy-bistro', 'fnb-premium-gourmet', 'fnb-streetfood-viral', 'fnb-bakery-sweet', 'fnb-drink-refreshing', 'fnb-brand-commercial', 'fnb-night-bar'`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const responseText = result.text || "";

    // Clean JSON response string
    const cleanedJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(cleanedJson);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Error analyzing style:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menganalisis gaya video." },
      { status: 500 }
    );
  }
}
