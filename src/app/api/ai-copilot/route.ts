import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = (body.prompt || body.message || body.text || "").trim();
    const context = body.context || {};

    if (!message) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    }

    const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let result: any = null;
    let lastErr: any = null;

    for (const modelName of candidateModels) {
      try {
        result = await genai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Kamu adalah AI Copilot untuk aplikasi Auto Video Editor berbasis web. 
Kamu membantu pengguna memodifikasi proyek video mereka menggunakan bahasa natural.

Konteks proyek saat ini:
${JSON.stringify(context || {}, null, 2)}

Perintah pengguna: "${message}"

Berikan respons dalam format JSON:
{
  "message": "Penjelasan singkat dalam Bahasa Indonesia tentang apa yang akan dilakukan atau sudah dilakukan",
  "actions": [
    {
      "type": "action_type",
      "payload": {}
    }
  ]
}

Tipe action yang tersedia:
- "change_bgm_volume": payload: { volume: number (0.0-1.0) }
- "change_subtitle_style": payload: { style: "plain-shadow"|"yellow"|"white"|"neon"|"box" }
- "change_subtitle_font_size": payload: { size: number }
- "change_editing_style": payload: { style: "fast-viral"|"cinematic-aesthetic"|"brand-commercial"|"soft-sweet" }
- "change_clip_duration": payload: { duration: number (in seconds) }
- "add_transition": payload: { type: "light-leak"|"passerby"|"dissolve-fade"|"zoom-blur"|"glitch"|"cross-fade", afterClipIndex: number, duration: number }
- "add_all_transitions": payload: { type: "light-leak"|"passerby"|"dissolve-fade"|"zoom-blur"|"glitch"|"cross-fade" } (Gunakan ini jika pengguna minta tambahkan/pasang transisi ke semua/seluruh klip)
- "remove_transition": payload: { afterClipIndex: number }
- "remove_all_transitions": payload: {}
- "update_script": payload: { script: string }
- "polish_script": payload: {}
- "generate_vo": payload: {}
- "select_bgm_ai": payload: {}
- "render_video": payload: {}
- "zoom_timeline": payload: { direction: "in"|"out" }
- "none": tidak ada perubahan, hanya jawab pertanyaan

Panduan Pencocokan Perintah Bahasa Indonesia:
1. Pacing & Durasi:
   - "percepat klip" / "buat lebih cepat" / "pacing fast" → change_clip_duration { duration: 1.0 } atau change_editing_style { style: "fast-viral" }
   - "perlambat klip" / "cinematic slow" → change_clip_duration { duration: 3.2 } atau change_editing_style { style: "cinematic-aesthetic" }
   - "set durasi klip 2 detik" → change_clip_duration { duration: 2.0 }
2. BGM & Musik:
   - "volume BGM 30%" / "pelankan musik" → change_bgm_volume { volume: 0.3 }
   - "matikan BGM" / "mute musik" → change_bgm_volume { volume: 0.0 }
   - "pilih BGM otomatis" / "carikan musik" → select_bgm_ai {}
3. Subtitle & Teks:
   - "subtitle lebih besar" / "perbesar teks" → change_subtitle_font_size { size: 30 }
   - "subtitle kecil" / "perkecil teks" → change_subtitle_font_size { size: 16 }
   - "ganti subtitle kuning" / "yellow punch" → change_subtitle_style { style: "yellow" }
   - "ganti subtitle neon" / "neon cyan" → change_subtitle_style { style: "neon" }
   - "ganti subtitle box hitam" → change_subtitle_style { style: "box" }
   - "ganti subtitle polos" → change_subtitle_style { style: "plain-shadow" }
4. Transisi:
   - "tambahkan semua klip transisi" / "tambah transisi ke semua klip" → add_all_transitions { type: "dissolve-fade" }
   - "tambah transisi light leak ke semua" → add_all_transitions { type: "light-leak" }
   - "tambah transisi glitch ke semua" → add_all_transitions { type: "glitch" }
   - "tambah transisi zoom blur ke semua" → add_all_transitions { type: "zoom-blur" }
   - "tambah transisi passerby ke semua" → add_all_transitions { type: "passerby" }
   - "hapus semua transisi" → remove_all_transitions {}
5. Alur & Proses:
   - "rapikan naskah" / "polish script" → polish_script {}
   - "buat suara AI" / "generate VO" → generate_vo {}
   - "render video" / "re-render" → render_video {}
   - "zoom in timeline" → zoom_timeline { direction: "in" }
   - "zoom out timeline" → zoom_timeline { direction: "out" }

Jika perintah tidak spesifik, gunakan "none" dan berikan penjelasan singkat serta opsi yang bisa dicoba.
Balas HANYA dengan JSON yang valid, tidak perlu markdown code block.`,
            },
          ],
        },
      ],
    });
    if (result && result.text) break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!result) {
      throw lastErr || new Error("Gagal menghubungkan ke model Gemini.");
    }

    const rawText = result.text || "{}";
    let parsed;
    try {
      // Strip markdown code blocks if present
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        message: rawText || "AI tidak dapat memproses perintah ini.",
        actions: [],
      };
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("AI Copilot error:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan pada AI Copilot." },
      { status: 500 }
    );
  }
}
