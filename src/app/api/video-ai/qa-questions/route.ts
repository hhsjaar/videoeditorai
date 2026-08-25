import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "slug pendek unik untuk pertanyaan ini, contoh: 'karakter_utama', 'lokasi_syuting'" },
          question: { type: "string", description: "Pertanyaan singkat, santai, dalam Bahasa Indonesia" },
          options: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: { type: "string" },
            description: "Pilihan jawaban singkat (maks ~4 kata tiap opsi), cocok jadi label tombol",
          },
        },
        required: ["key", "question", "options"],
      },
    },
  },
  required: ["questions"],
};

export async function POST(req: NextRequest) {
  try {
    const { brief, concept, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }
    if (!brief || !concept) {
      return NextResponse.json({ error: "Brief dan konsep terpilih dibutuhkan." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const systemPrompt = `Anda adalah sutradara/creative director yang akan syuting video pendek berdasarkan brief & konsep di bawah ini. Sebelum mulai bikin storyboard, Anda perlu menanyakan 3-4 hal PALING PENTING ke klien (user) untuk mengunci detail produksi — supaya hasil akhirnya presisi, bukan tebak-tebakan.

Brief awal dari user:
"${brief}"

Konsep yang sudah dipilih user:
${JSON.stringify(concept, null, 2)}

Tugas Anda: tentukan sendiri 3-4 pertanyaan yang PALING relevan & spesifik untuk brief dan konsep INI — jangan pakai template generik yang sama untuk semua topik. Pertimbangkan apa yang benar-benar ambigu/penting untuk topik ini: bisa soal karakter utama, lokasi/setting, gaya visual, cara narasi disampaikan, mood/emosi, detail produk/objek kunci, waktu (siang/malam), atau hal lain yang spesifik untuk konsep ini — pilih yang paling relevan, bukan sekadar keempat kategori itu.

Aturan:
1. Setiap pertanyaan singkat, bahasa santai Indonesia, sesuai gaya bahasa brief user.
2. Tiap pertanyaan punya 3-5 opsi jawaban singkat (maksimal ~4 kata) yang benar-benar berbeda satu sama lain dan relevan ke konteks (bukan opsi generik seperti "cowok 20-an / cewek 20-an" kalau kontennya faceless product review, misalnya).
3. Variasikan kalimat tanya — jangan selalu "Karakter utamanya siapa?" / "Gaya visualnya mau ke mana?" / "Narasinya disampaikan gimana?" seperti template baku. Sesuaikan pertanyaan dengan topik spesifik brief ini.
4. Jangan tanya hal yang jawabannya sudah jelas dari brief/konsep di atas.`;

    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let responseText = "";
    let lastErr: any = null;

    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: systemPrompt,
          config: {
            temperature: 0.9,
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

    if (!responseText) throw lastErr || new Error("Gagal menghubungi model Gemini.");

    const parsedData = JSON.parse(responseText);
    return NextResponse.json({ success: true, questions: parsedData.questions || [] });
  } catch (error: any) {
    console.error("Error generating QA questions:", error);
    return NextResponse.json({ error: error.message || "Gagal menyusun pertanyaan." }, { status: 500 });
  }
}
