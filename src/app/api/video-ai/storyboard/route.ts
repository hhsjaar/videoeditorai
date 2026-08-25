import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ROW_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "Nomor urut baris/klip, contoh '1', '2', '3'" },
    durationSec: { type: "integer", enum: [4, 6, 8], description: "Durasi klip ini dalam detik — HARUS salah satu dari 4, 6, atau 8 (batasan teknis AI video engine, TIDAK BOLEH nilai lain seperti 5 atau 10)" },
    startSec: { type: "integer", description: "Detik mulai klip ini relatif ke keseluruhan video (kumulatif dari durasi klip-klip sebelumnya)" },
    endSec: { type: "integer", description: "startSec + durationSec" },
    visual: {
      type: "string",
      description: "Deskripsi Indonesia detail apa yang terlihat di layar. Kalau video ini punya karakter utama, WAJIB buka dengan deskripsi karakter (umur, pakaian, rambut, ciri khas) PERSIS SAMA KATA-PER-KATA seperti di consistencyProfile.character, lalu lanjutkan dengan aksi spesifik di baris ini.",
    },
    narration: {
      type: "string",
      description: "Narasi/dialog Bahasa Indonesia yang natural (bukan bahasa iklan). PANJANGNYA HARUS PAS untuk durationSec klip ini berdasarkan kecepatan bicara natural (~2.5-3 kata per detik) — jangan sampai kepanjangan (suara kepotong pas video berakhir) atau kependekan (banyak jeda diam).",
    },
    emotion: { type: "string", description: "Emosi/mood singkat, contoh: 'Netral, tenang' atau 'Sadar, agak kaget'" },
  },
  required: ["id", "durationSec", "startSec", "endSec", "visual", "narration", "emotion"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    videoTitle: { type: "string" },
    concept30s: {
      type: "object",
      properties: {
        problemHook: { type: "string" },
        turningPoint: { type: "string" },
        takeawayFeeling: { type: "string" },
      },
      required: ["problemHook", "turningPoint", "takeawayFeeling"],
    },
    consistencyProfile: {
      type: "object",
      description: "Detail yang HARUS identik di seluruh klip video supaya nyambung jadi satu kesatuan saat dirangkai",
      properties: {
        character: { type: "string", description: "Deskripsi karakter utama lengkap (umur, etnis/kulit, rambut, wajah, pakaian dari atas ke bawah, aksesoris) — string KOSONG kalau video ini faceless/b-roll tanpa karakter tetap" },
        visualStyle: { type: "string", description: "Gaya visual & rendering yang konsisten dipakai di semua klip, contoh: 'cinematic vertical 9:16, 35mm lens, shallow depth of field, natural film grain, muted warm color grade, photorealistic'" },
        environment: { type: "string", description: "Deskripsi lokasi/environment tetap yang dipakai berulang di seluruh klip (tempat, properti, waktu hari)" },
        lighting: { type: "string", description: "Pencahayaan & mood warna yang konsisten di semua klip" },
        cameraLanguage: { type: "string", description: "Gaya pergerakan kamera yang jadi ciri khas video ini (dipakai sebagai basis, bisa divariasikan sedikit tiap klip)" },
      },
      required: ["character", "visualStyle", "environment", "lighting", "cameraLanguage"],
    },
    rows: { type: "array", minItems: 3, items: ROW_SCHEMA, description: "Baris-baris storyboard — tiap baris adalah SATU klip AI video yang berdiri sendiri, durasinya langsung salah satu dari 4/6/8 detik" },
  },
  required: ["videoTitle", "concept30s", "consistencyProfile", "rows"],
};

export async function POST(req: NextRequest) {
  try {
    const {
      concept,
      userPrompt,
      qaAnswers,
      targetDuration = 30,
      apiKey,
    } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const answersText = Object.entries(qaAnswers || {})
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n") || "(tidak ada, ikuti konsep apa adanya)";

    const numRows = Math.max(3, Math.round(targetDuration / 6));

    const systemPrompt = `Anda adalah sutradara + penulis naskah untuk video pendek AI-generated.

Konsep video hasil riset:
- Ide awal: "${userPrompt || ""}"
- Konsep terpilih: ${JSON.stringify(concept || {}, null, 2)}
- Jawaban klarifikasi dari user:
${answersText}

Tugas: Buatkan storyboard untuk video total ${targetDuration} detik, berisi sekitar ${numRows} baris/klip berurutan. SETIAP baris = SATU klip AI video yang nanti langsung di-generate apa adanya (tidak dipecah/digabung lagi), jadi durasinya HARUS pas.

Aturan WAJIB:
1. Isi dulu "concept30s": masalah yang dirasain penonton di detik-detik pertama, titik balik ceritanya, dan perasaan yang harus dibawa pulang penonton.
2. Isi "consistencyProfile" SATU KALI di awal — ini kunci supaya semua klip terasa satu kesatuan saat dirangkai. Kalau videonya punya karakter utama, deskripsikan karakter itu SANGAT detail (umur, kulit, rambut, wajah, pakaian lengkap, aksesoris) karena deskripsi ini akan dipakai ulang PERSIS SAMA di setiap baris. Kalau faceless/b-roll, kosongkan field character.
3. Setiap baris "visual": kalau ada karakter utama, buka deskripsi baris itu dengan deskripsi karakter PERSIS SAMA KATA-PER-KATA seperti di consistencyProfile.character (jangan diringkas/diubah sedikit pun), baru lanjut ke aksi spesifik & environment baris itu (juga konsisten dengan consistencyProfile.environment).
4. Tulis narasi dalam Bahasa Indonesia yang natural mengalir seperti orang cerita, BUKAN bahasa iklan yang kaku. Kalau digabung semua baris, narasinya harus mengalir jadi satu naskah utuh dengan hook di awal dan penutup yang pas di akhir.
5. "emotion" singkat, 2-4 kata, sesuai momen di baris itu.
6. "durationSec" tiap baris HARUS salah satu dari 4, 6, atau 8 detik — TIDAK BOLEH nilai lain (bukan 5, bukan 10). DEFAULT ke 6 detik untuk sebagian besar baris (lebih lega buat narasi & gerakan kamera), pakai 4 detik hanya untuk beat cepat/transisi singkat, dan 8 detik hanya untuk momen yang butuh napas lebih panjang. Total durasi semua baris harus mendekati ${targetDuration} detik.
7. "startSec" dan "endSec" HARUS kumulatif akurat: baris pertama startSec=0, baris berikutnya startSec = endSec baris sebelumnya, dan endSec = startSec + durationSec.
8. PALING PENTING: panjang "narration" tiap baris harus PAS kalau diucapkan dalam durationSec baris itu (kecepatan bicara natural ~2.5-3 kata/detik) — misal baris 6 detik idealnya sekitar 15-18 kata. JANGAN menulis narasi yang lebih panjang dari itu, karena nanti suaranya akan kepotong di video hasil generate. Lebih baik narasi sedikit lebih pendek/ada jeda natural daripada kepanjangan.`;

    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let responseText = "";
    let lastErr: any = null;

    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: systemPrompt,
          config: {
            temperature: 0.7,
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
    return NextResponse.json({ success: true, storyboard: parsedData });
  } catch (error: any) {
    console.error("Error generating storyboard:", error);
    return NextResponse.json({ error: error.message || "Gagal menyusun storyboard." }, { status: 500 });
  }
}
