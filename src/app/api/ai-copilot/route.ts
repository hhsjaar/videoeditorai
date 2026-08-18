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

    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let result: any = null;
    let lastErr: any = null;

    // Build detailed clip info for context
    const clipsInfo = (context.clips || [])
      .map((c: any, i: number) => `  Klip ${i + 1}: "${c.name}" (${c.duration?.toFixed(1)}s)`)
      .join("\n") || "  (tidak ada info klip)";

    const systemPrompt = `
${masterTraineeInstruction || "Kamu adalah AI Video Editing Assistant yang cerdas untuk Burjolevelup Video Editor."}

Konteks Proyek Studio Saat Ini:
- Total Klip: ${context.footagesCount || 0}
- Detail Klip:
${clipsInfo}
- Durasi Total Video: ${context.totalDuration || 0}s
- Durasi VO: ${context.audioDurationSec || 0}s
- Suara VO Aktif: "${context.selectedVoice || "Zephyr"}"
- Naskah Aktif: "${(context.polishedScript || context.rawScript || "Belum ada naskah").substring(0, 300)}"
- Gaya Subtitle: "${context.subtitleStyle || "plain-shadow"}"
- Ukuran Font Subtitle: ${context.subtitleFontSize || 44}px
- Posisi Subtitle: ${context.subtitleBottomPos || 220}px dari bawah
- Preset Color Grade Filter: "${context.editingStyle || "none"}"
- Transisi Terpasang: ${JSON.stringify(context.transitionsMap || {})}
- BGM URL: "${context.bgmUrl || "Tidak ada BGM"}"
- Volume BGM: ${context.bgmVolume !== undefined ? context.bgmVolume : 0.2}
- Target Durasi: ${context.targetDuration ? context.targetDuration + "s" : "Tidak diset"}
- Rasio Aspek: ${context.aspectRatio || "9:16"}
- Export Preset: ${context.exportPreset || "720p"}

Perintah Pengguna: "${message}"

Berikan respons JSON dalam format berikut (wajib valid JSON):
{
  "message": "Penjelasan/rekomendasi kreatif profesional dari perspektif Creative Director & Video Editor dalam Bahasa Indonesia yang santai, solutif, dan aksi yang sudah dieksekusi.",
  "requiresConfirmation": false,
  "actions": [
    {
      "type": "action_type",
      "payload": {}
    }
  ]
}

Field "requiresConfirmation": set true HANYA untuk action berat (regenerate_voiceover, reorder_clips, regenerate_render). Untuk action ringan, set false.

=== TIPE ACTION LENGKAP ===

ACTION RINGAN (langsung apply, requiresConfirmation: false):
- "change_bgm_volume": payload: { "volume": number (0.0-1.0) }
- "change_subtitle_style": payload: { "style": "plain-shadow"|"yellow-highlight"|"bold-outline"|"neon-glow"|"minimalist" }
- "change_subtitle_font_size": payload: { "fontSize": number (40-120) }
- "change_subtitle_position": payload: { "bottom": number (80-500) }
- "change_editing_style": payload: { "style": string (misal: "clean-commercial","warm-commercial","modern-cinematic","muted-luxury","warm-clean","soft-teal","cinematic-neutral","pastel-commercial","urban-clean","editorial-commercial") }
- "change_clip_duration": payload: { "duration": number } — ubah durasi default semua klip
- "set_clip_duration": payload: { "clipIndex": number, "duration": number } — ubah durasi klip tertentu (0-indexed)
- "add_all_transitions": payload: { "type": "light-leak"|"film-burn"|"passerby"|"lens-flare"|"flash-white"|"fade-black"|"zoom-blur"|"glitch"|"iris-circle"|"wipe-horizontal"|"wipe-diagonal"|"vignette"|"random" }
- "add_random_transitions": payload: {} — pasang transisi berbeda di setiap klip
- "remove_all_transitions": payload: {}
- "change_bgm": payload: { "trackId": "bsl1"|"bsl2"|"bsl3"|"bsl4"|"bsl5"|"bsl6"|"bsl7"|"bsl8"|"bsl9"|"bsl10" }
- "change_aspect_ratio": payload: { "ratio": "9:16"|"16:9"|"1:1" }
- "change_export_preset": payload: { "preset": "720p"|"1080p"|"480p" }
- "set_target_duration": payload: { "seconds": number } — set target total durasi video

ACTION BERAT (requiresConfirmation: true, perlu konfirmasi user):
- "change_voice": payload: { "voice": "Zephyr"|"Puck"|"Kore"|"Fenrir"|"Aoede"|"Charon" } — ganti suara VO
- "regenerate_voiceover": payload: { "voice"?: string, "script"?: string } — generate ulang VO (dan script jika ada)
- "reorder_clips": payload: { "order": number[] } — susun ulang klip (array index baru, 0-indexed)
- "auto_match_footage": payload: {} — jalankan AI semantic matching klip ke VO
- "regenerate_render": payload: {} — render ulang video

ACTION KHUSUS:
- "none": tidak ada aksi, hanya saran/panduan kreatif

=== PANDUAN KONTEKS ===
- Jika user minta "buat lebih pendek/panjang" → gunakan set_target_duration
- Jika user minta ganti suara → gunakan change_voice (requiresConfirmation: true)
- Jika user minta render ulang / finalisasi video → regenerate_render (requiresConfirmation: true)
- Jika user minta susun ulang klip → reorder_clips (requiresConfirmation: true)
- Jika user minta sinkronkan footage dengan narasi → auto_match_footage (requiresConfirmation: true)
- Kamu boleh memberikan MULTIPLE actions sekaligus (misal: ganti filter + ganti transisi + ubah volume BGM)
`;

    for (const modelName of candidateModels) {
      try {
        result = await genai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [{ text: systemPrompt }],
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
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        message: rawText || "AI tidak dapat memproses perintah ini.",
        actions: [],
        requiresConfirmation: false,
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
