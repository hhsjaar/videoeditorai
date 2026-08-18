import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Load Master Trainee Knowledge System Instruction
let masterTraineeInstruction = "";
try {
  const traineePath = path.join(process.cwd(), "trainee.txt");
  if (fs.existsSync(traineePath)) {
    masterTraineeInstruction = fs.readFileSync(traineePath, "utf-8");
  }
} catch (e) {
  console.warn("Could not read trainee.txt:", e);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = (body.prompt || body.message || body.text || "").trim();
    const context = body.context || {};

    if (!message) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    }

    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash"];
    let result: any = null;
    let lastErr: any = null;

    // Build detailed clip info for context
    const clipsInfo = (context.clips || [])
      .map((c: any, i: number) => `  Klip ${i + 1}: "${c.name}" (${c.duration?.toFixed(1)}s)`)
      .join("\n") || "  (tidak ada info klip)";

    // Calculate total duration for context
    const currentTotalDur = (context.clips || []).reduce((s: number, c: any) => s + (c.duration || 0), 0);

    const systemPrompt = `
${masterTraineeInstruction ? masterTraineeInstruction.substring(0, 1000) : ""}

Kamu adalah AI Video Editing Assistant EKSEKUTOR untuk Burjolevelup Video Editor. 
TUGAS UTAMA kamu adalah MENGEKSEKUSI perintah user menjadi action nyata yang mengubah state video — BUKAN hanya memberikan saran teks.

===== WAJIB DIBACA =====
KAMU HARUS SELALU menghasilkan minimal 1 action yang sesuai dengan perintah user.
DILARANG hanya menjawab dengan teks tanpa action jika ada perintah editing yang jelas.
JIKA tidak bisa mengeksekusi, gunakan type "none" dan jelaskan kenapa.

Contoh BENAR — user: "panjangkan durasi jadi 30 detik":
→ action: set_target_duration dengan seconds: 30

Contoh BENAR — user: "pasang transisi light leak di semua klip":
→ action: add_all_transitions dengan type: "light-leak"

Contoh BENAR — user: "ganti BGM jadi yang lebih upbeat":
→ action: change_bgm dengan trackId: "bsl2" (pilih yang cocok)

Contoh SALAH — user: "panjangkan durasi jadi 18 detik":
→ hanya menjawab "baik, saya sarankan untuk memanjangkan durasi setiap klip" TANPA action
========================

Konteks Proyek Studio Saat Ini:
- Total Klip: ${context.footagesCount || 0}
- Detail Klip:
${clipsInfo}
- Durasi Total Saat Ini: ${currentTotalDur.toFixed(1)}s
- Durasi VO: ${context.audioDurationSec || 0}s
- Suara VO Aktif: "${context.selectedVoice || "Zephyr"}"
- Naskah Aktif: "${(context.polishedScript || context.rawScript || "Belum ada").substring(0, 200)}"
- Gaya Subtitle: "${context.subtitleStyle || "plain-shadow"}"
- Ukuran Font: ${context.subtitleFontSize || 44}px
- Posisi Subtitle: ${context.subtitleBottomPos || 220}px
- Color Grade: "${context.editingStyle || "none"}"
- Transisi: ${JSON.stringify(context.transitionsMap || {})}
- BGM: "${context.bgmUrl || "Tidak ada"}"
- Volume BGM: ${context.bgmVolume ?? 0.2}
- Target Durasi: ${context.targetDuration ? context.targetDuration + "s" : "Tidak diset"}
- Rasio: ${context.aspectRatio || "9:16"}

Perintah User: "${message}"

RESPONS WAJIB DALAM JSON (tidak boleh ada teks di luar JSON):
{
  "message": "Pesan singkat konfirmasi apa yang sudah kamu eksekusi, dalam Bahasa Indonesia yang santai.",
  "requiresConfirmation": false,
  "actions": [
    {
      "type": "<action_type>",
      "payload": {}
    }
  ]
}

=== DAFTAR ACTION ===

RINGAN — langsung apply (requiresConfirmation: false):
- "change_bgm_volume": { "volume": 0.0-1.0 }
- "change_subtitle_style": { "style": "plain-shadow"|"yellow-highlight"|"bold-outline"|"neon-glow"|"minimalist" }
- "change_subtitle_font_size": { "fontSize": 40-120 }
- "change_subtitle_position": { "bottom": 80-500 }
- "change_editing_style": { "style": "clean-commercial"|"warm-commercial"|"modern-cinematic"|"muted-luxury"|"warm-clean"|"soft-teal"|"cinematic-neutral"|"pastel-commercial"|"urban-clean"|"editorial-commercial" }
- "set_clip_duration": { "clipIndex": 0, "duration": detik } — 1 klip spesifik (0-indexed)
- "set_target_duration": { "seconds": total_durasi_video } — redistribute semua klip ke total target
- "add_all_transitions": { "type": "light-leak"|"film-burn"|"passerby"|"lens-flare"|"flash-white"|"fade-black"|"zoom-blur"|"glitch"|"iris-circle"|"wipe-horizontal"|"wipe-diagonal"|"vignette" } — GUNAKAN TIPE SPESIFIK, bukan "random"
- "add_random_transitions": {} — HANYA jika user secara eksplisit minta "transisi berbeda-beda / acak / variatif"
- "remove_all_transitions": {}
- "change_bgm": { "trackId": "bsl1"|"bsl2"|"bsl3"|"bsl4"|"bsl5"|"bsl6"|"bsl7"|"bsl8"|"bsl9"|"bsl10" }
- "change_aspect_ratio": { "ratio": "9:16"|"16:9"|"1:1" }
- "change_export_preset": { "preset": "720p"|"1080p"|"480p" }

BERAT — perlu konfirmasi (requiresConfirmation: true):
- "change_voice": { "voice": "Zephyr"|"Puck"|"Kore"|"Fenrir"|"Aoede"|"Charon" }
- "regenerate_voiceover": { "voice"?: string, "script"?: string }
- "reorder_clips": { "order": [0,2,1,3] } — array indeks klip
- "auto_match_footage": {}
- "regenerate_render": {}

PANDUAN KHUSUS PENTING:
1. "panjang/lama/durasi/jadi X detik/menit" → set_target_duration dengan seconds: X (WAJIB action ini)
2. "light leak di semua" → add_all_transitions type: "light-leak" (BUKAN random)
3. "film burn" → add_all_transitions type: "film-burn"
4. "transisi berbeda/acak/variatif" → add_random_transitions
5. "ganti warna/filter" → change_editing_style
6. "volume BGM" → change_bgm_volume
7. Boleh kirim MULTIPLE actions sekaligus dalam 1 array
`;

    for (const modelName of candidateModels) {
      try {
        result = await genai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
          config: { temperature: 0.1 },
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
      const cleaned = rawText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      // Extract first JSON object from response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      parsed = {
        message: rawText || "AI tidak dapat memproses perintah ini.",
        actions: [],
        requiresConfirmation: false,
      };
    }

    // Ensure actions is always an array
    if (!Array.isArray(parsed.actions)) parsed.actions = [];

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("AI Copilot error:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan pada AI Copilot." },
      { status: 500 }
    );
  }
}
