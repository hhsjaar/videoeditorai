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

    const systemPrompt = `
${masterTraineeInstruction || "Kamu adalah AI Video Editing Assistant yang cerdas untuk Burjolevelup Video Editor."}

Konteks Proyek Studio Saat Ini:
- Total Klip: ${context.footagesCount || 0}
- Durasi Total Video: ${context.totalDuration || 0}s
- Suara VO Aktif: "${context.selectedVoice || "Zephyr"}"
- Naskah Aktif: "${context.rawScript || context.polishedScript || "Belum ada naskah"}"
- Gaya Subtitle: "${context.subtitleStyle || "plain-shadow"}"
- Preset Color Grade Filter: "${context.editingStyle || "none"}"
- Transisi Terpasang: ${JSON.stringify(context.transitionsMap || {})}
- BGM URL: "${context.bgmUrl || "Tidak ada BGM"}"
- Volume BGM: ${context.bgmVolume !== undefined ? context.bgmVolume : 0.2}

Perintah Pengguna: "${message}"

Berikan respons JSON dalam format berikut:
{
  "message": "Penjelasan atau rekomendasi kreatif profesional dari perspektif Creative Director & Video Editor dalam Bahasa Indonesia yang santai dan solutif.",
  "actions": [
    {
      "type": "action_type",
      "payload": {}
    }
  ]
}

Tipe Action yang dapat disarankan dan dieksekusi:
- "change_bgm_volume": payload: { volume: number (0.0 - 1.0) }
- "change_subtitle_style": payload: { style: "plain-shadow"|"yellow-highlight"|"bold-outline"|"neon-glow"|"minimalist" }
- "change_subtitle_font_size": payload: { fontSize: number (misal 40, 56, 72, 88) }
- "change_subtitle_position": payload: { bottom: number (misal 140, 220, 340, 460) }
- "change_editing_style": payload: { style: string (misal: "clean-commercial", "warm-commercial", "modern-cinematic", "muted-luxury", "warm-clean", "soft-teal", "cinematic-neutral", "pastel-commercial", "urban-clean", "editorial-commercial") }
- "change_clip_duration": payload: { duration: number (in seconds) }
- "add_all_transitions": payload: { type: "light-leak"|"film-burn"|"passerby"|"lens-flare"|"flash-white"|"fade-black"|"zoom-blur"|"glitch"|"iris-circle"|"wipe-horizontal"|"wipe-diagonal"|"vignette"|"random" }
- "add_random_transitions": payload: {} (Gunakan ini jika pengguna meminta transisi yang berbeda-beda / variatif di setiap klip!)
- "remove_all_transitions": payload: {}
- "none": tidak ada aksi otomatis, hanya memberikan panduan/saran kreatif
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
