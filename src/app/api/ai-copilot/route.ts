import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import fs from "fs";
import path from "path";
import { FONT_REGISTRY } from "@/remotion/fonts";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const CANDIDATE_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
const MAX_LOOP_TURNS = 5; // safety cap against runaway tool-call chains
const FONT_IDS = FONT_REGISTRY.map((f) => f.id);

let masterTraineeInstruction = "";
try {
  const traineePath = path.join(process.cwd(), "trainee.txt");
  if (fs.existsSync(traineePath)) masterTraineeInstruction = fs.readFileSync(traineePath, "utf-8");
} catch { /* optional */ }

// ─── Actions that mutate real editor state — MUST be executed client-side ─────
// (requiresConfirmation = true means the client shows a confirm dialog before applying)
const CLIENT_TOOLS: Array<{ decl: FunctionDeclaration; requiresConfirmation: boolean }> = [
  { requiresConfirmation: false, decl: {
    name: "change_bgm_volume",
    description: "Ubah volume BGM (background music).",
    parametersJsonSchema: { type: "object", properties: { volume: { type: "number", description: "0.0 - 1.0" } }, required: ["volume"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "change_subtitle_style",
    description: "Ganti gaya visual subtitle/caption.",
    parametersJsonSchema: { type: "object", properties: { style: { type: "string", enum: ["plain-shadow", "yellow-highlight", "bold-outline", "neon-glow", "minimalist"] } }, required: ["style"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "change_subtitle_font_size",
    description: "Ubah ukuran font subtitle.",
    parametersJsonSchema: { type: "object", properties: { fontSize: { type: "number", description: "40-120px" } }, required: ["fontSize"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "change_subtitle_position",
    description: "Ubah posisi vertikal subtitle dari bawah layar.",
    parametersJsonSchema: { type: "object", properties: { bottom: { type: "number", description: "80-500px dari bawah" } }, required: ["bottom"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "change_editing_style",
    description: "Ganti color grade/filter warna untuk seluruh video.",
    parametersJsonSchema: { type: "object", properties: { style: { type: "string", enum: ["clean-commercial", "warm-commercial", "modern-cinematic", "soft-teal", "muted-luxury", "warm-clean", "cinematic-neutral", "pastel-commercial", "urban-clean", "editorial-commercial"] } }, required: ["style"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_clip_duration",
    description: "Atur durasi 1 klip spesifik (0-indexed).",
    parametersJsonSchema: { type: "object", properties: { clipIndex: { type: "integer" }, duration: { type: "number", description: "detik" } }, required: ["clipIndex", "duration"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_target_duration",
    description: "Atur total durasi video — semua klip (kecuali cover akhiran) diperpanjang/dipendekkan proporsional.",
    parametersJsonSchema: { type: "object", properties: { seconds: { type: "number" } }, required: ["seconds"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "delete_clip",
    description: "Hapus 1 klip video spesifik dari timeline (0-indexed).",
    parametersJsonSchema: { type: "object", properties: { clipIndex: { type: "integer" } }, required: ["clipIndex"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "add_all_transitions",
    description: "Pasang 1 jenis transisi spesifik di antara SEMUA klip.",
    parametersJsonSchema: { type: "object", properties: { type: { type: "string", enum: ["light-leak", "film-burn", "passerby", "lens-flare", "flash-white", "fade-black", "zoom-blur", "glitch", "iris-circle", "wipe-horizontal", "wipe-diagonal", "vignette"] } }, required: ["type"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_transition_at",
    description: "Pasang transisi di antara 2 klip spesifik saja (setelah clipIndex tertentu), bukan semua.",
    parametersJsonSchema: { type: "object", properties: { afterClipIndex: { type: "integer", description: "index klip SEBELUM transisi (0-indexed)" }, type: { type: "string", enum: ["light-leak", "film-burn", "passerby", "lens-flare", "flash-white", "fade-black", "zoom-blur", "glitch", "iris-circle", "wipe-horizontal", "wipe-diagonal", "vignette"] } }, required: ["afterClipIndex", "type"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "add_random_transitions",
    description: "Pasang transisi acak/bervariasi di semua klip. Hanya jika user eksplisit minta variatif/acak.",
    parametersJsonSchema: { type: "object", properties: {} },
  }},
  { requiresConfirmation: false, decl: {
    name: "remove_all_transitions",
    description: "Hapus semua transisi antar klip.",
    parametersJsonSchema: { type: "object", properties: {} },
  }},
  { requiresConfirmation: false, decl: {
    name: "change_bgm",
    description: "Ganti lagu BGM ke salah satu dari 10 track preset yang tersedia.",
    parametersJsonSchema: { type: "object", properties: { trackId: { type: "string", enum: ["bsl1", "bsl2", "bsl3", "bsl4", "bsl5", "bsl6", "bsl7", "bsl8", "bsl9", "bsl10"] } }, required: ["trackId"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "change_aspect_ratio",
    description: "Ubah rasio aspek output video.",
    parametersJsonSchema: { type: "object", properties: { ratio: { type: "string", enum: ["9:16", "16:9", "1:1"] } }, required: ["ratio"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "change_export_preset",
    description: "Ubah preset kualitas export.",
    parametersJsonSchema: { type: "object", properties: { preset: { type: "string", enum: ["480p", "720p", "1080p"] } }, required: ["preset"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "toggle_title",
    description: "Nyalakan/matikan tampilan judul opening di video.",
    parametersJsonSchema: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_title_text",
    description: "Ubah isi teks judul opening (baris 1 = judul utama, baris 2 = aksen, baris 3 = subtitle/handle).",
    parametersJsonSchema: { type: "object", properties: { line1: { type: "string" }, line2: { type: "string" }, subtitle: { type: "string" } } },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_title_position",
    description: "Pindahkan posisi judul di kanvas video (persentase, 0=kiri/atas, 100=kanan/bawah).",
    parametersJsonSchema: { type: "object", properties: { positionX: { type: "number", description: "0-100, horizontal" }, positionY: { type: "number", description: "0-100, vertikal" } }, required: ["positionX", "positionY"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_title_scale",
    description: "Ubah ukuran (skala) judul. 1.0 = normal, lebih besar dari itu = lebih besar.",
    parametersJsonSchema: { type: "object", properties: { scale: { type: "number", description: "0.3 - 3.0" } }, required: ["scale"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_title_duration",
    description: "Atur berapa lama judul muncul di layar, dan kapan mulai muncul.",
    parametersJsonSchema: { type: "object", properties: { durationSec: { type: "number" }, startSec: { type: "number" } }, required: ["durationSec"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_title_style",
    description: "Ubah gaya visual & animasi masuk/keluar judul.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        style: { type: "string", enum: ["reel-aesthetic", "bold-impact", "chic-luxury", "neon-glow", "pill-badge"] },
        animationIn: { type: "string", enum: ["spring-pop", "kinetic-zoom", "slide-up", "stagger-cascade", "mask-reveal", "neon-flash", "flip-drop", "blur-fade"] },
        animationOut: { type: "string", enum: ["blur-dissolve", "slide-up-out", "slide-down-out", "scale-fade", "zoom-explode", "flip-out"] },
        fontFamily: { type: "string", enum: FONT_IDS, description: "Jenis font judul." },
      },
    },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_overlay_position",
    description: "Ubah posisi 1 overlay (logo/watermark/stiker) spesifik di kanvas (0-indexed sesuai urutan overlay yang diupload).",
    parametersJsonSchema: { type: "object", properties: { overlayIndex: { type: "integer" }, position: { type: "string", enum: ["topleft", "topright", "bottomleft", "bottomright", "center"] } }, required: ["overlayIndex", "position"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "set_overlay_size",
    description: "Ubah ukuran 1 overlay spesifik.",
    parametersJsonSchema: { type: "object", properties: { overlayIndex: { type: "integer" }, sizePercent: { type: "number", description: "10-80" } }, required: ["overlayIndex", "sizePercent"] },
  }},
  { requiresConfirmation: false, decl: {
    name: "remove_overlay",
    description: "Hapus 1 overlay spesifik dari video.",
    parametersJsonSchema: { type: "object", properties: { overlayIndex: { type: "integer" } }, required: ["overlayIndex"] },
  }},
  { requiresConfirmation: true, decl: {
    name: "change_voice",
    description: "Ganti suara AI voice-over (belum generate ulang audionya).",
    parametersJsonSchema: { type: "object", properties: { voice: { type: "string", enum: ["Zephyr", "Puck", "Kore", "Fenrir", "Aoede", "Charon"] } }, required: ["voice"] },
  }},
  { requiresConfirmation: true, decl: {
    name: "regenerate_voiceover",
    description: "Generate ulang audio voice-over (proses berat, memakan waktu & kuota).",
    parametersJsonSchema: { type: "object", properties: { voice: { type: "string" }, script: { type: "string" } } },
  }},
  { requiresConfirmation: true, decl: {
    name: "reorder_clips",
    description: "Susun ulang urutan semua klip video.",
    parametersJsonSchema: { type: "object", properties: { order: { type: "array", items: { type: "integer" }, description: "array index klip urutan baru, misal [2,0,1]" } }, required: ["order"] },
  }},
  { requiresConfirmation: true, decl: {
    name: "auto_match_footage",
    description: "Jalankan AI auto-match: cocokkan otomatis urutan klip video dengan naskah voice-over (proses berat).",
    parametersJsonSchema: { type: "object", properties: {} },
  }},
  { requiresConfirmation: true, decl: {
    name: "regenerate_render",
    description: "Mulai render ulang video final (proses berat, memakan resource Lambda).",
    parametersJsonSchema: { type: "object", properties: {} },
  }},
];

// ─── Read-only analysis tools — safe to execute directly on the server ────────
const SERVER_TOOLS: FunctionDeclaration[] = [
  {
    name: "analyze_reference_style",
    description: "Analisis gaya editing dari link/deskripsi video referensi (Instagram/TikTok) — hasilnya berisi rekomendasi color grade, gaya subtitle, dan BGM yang cocok. Panggil ini dulu jika user minta 'samain gaya kayak video ini' sebelum menerapkan perubahan.",
    parametersJsonSchema: { type: "object", properties: { videoUrl: { type: "string" }, videoDescription: { type: "string" } } },
  },
  {
    name: "recommend_bgm",
    description: "Minta rekomendasi BGM paling cocok berdasarkan naskah/skrip video (dari 10 track preset). Panggil ini jika user minta BGM yang 'cocok' / 'pas' tanpa nyebut track spesifik.",
    parametersJsonSchema: { type: "object", properties: { scriptText: { type: "string" } }, required: ["scriptText"] },
  },
];

const CLIENT_TOOL_NAMES = new Set(CLIENT_TOOLS.map((t) => t.decl.name));
const CONFIRM_REQUIRED_NAMES = new Set(CLIENT_TOOLS.filter((t) => t.requiresConfirmation).map((t) => t.decl.name));
const ALL_TOOLS: FunctionDeclaration[] = [...CLIENT_TOOLS.map((t) => t.decl), ...SERVER_TOOLS];

function buildSystemInstruction(context: any): string {
  const clipsInfo = (context.clips || [])
    .map((c: any, i: number) => `  [${i}] "${c.name}" (${c.duration?.toFixed(1)}s)`)
    .join("\n") || "  (tidak ada klip)";
  const overlaysInfo = (context.overlays || [])
    .map((o: any, i: number) => `  [${i}] "${o.name}" posisi=${o.position} ukuran=${o.sizePercent}%`)
    .join("\n") || "  (tidak ada overlay)";

  return `${masterTraineeInstruction ? masterTraineeInstruction.substring(0, 1000) + "\n\n" : ""}Kamu adalah AI Video Editing Copilot untuk Burjolevelup Video Editor — asisten yang benar-benar MENGEKSEKUSI perubahan lewat tools, bukan cuma memberi saran teks.

ATURAN:
1. Kalau user minta perubahan yang jelas, WAJIB panggil tool yang sesuai — jangan hanya menjawab teks.
2. Kalau permintaan majemuk (beberapa hal sekaligus), panggil beberapa tools — boleh satu per satu di beberapa giliran, kamu akan melihat hasil tiap tool sebelum lanjut ke langkah berikutnya.
3. Kalau butuh informasi/analisis dulu sebelum bisa memutuskan (misal "samain gaya kayak video X" atau "cariin BGM yang cocok"), panggil tool analisis (analyze_reference_style / recommend_bgm) DULU, lihat hasilnya, baru panggil tool perubahan berdasarkan hasil itu.
4. Index klip/overlay itu 0-indexed dan HARUS sesuai daftar di bawah — jangan menebak index yang tidak ada.
5. Kalau user cuma ngobrol/nanya tanpa minta perubahan, jawab teks biasa tanpa panggil tool.
6. Kalau semua tool sudah dipanggil dan tugas selesai, beri ringkasan singkat dalam Bahasa Indonesia santai — JANGAN panggil tool lagi di giliran itu.
7. "panjang/lama/durasi jadi X detik" → set_target_duration.
8. "geser/pindah judul" → set_title_position. "besarkan/kecilkan judul" → set_title_scale.
9. "hapus klip ke-N" → delete_clip dengan clipIndex = N-1 (user bicara 1-indexed, tool 0-indexed).

KONTEKS PROYEK SAAT INI:
- Total Klip: ${context.footagesCount || 0}
${clipsInfo}
- Overlay:
${overlaysInfo}
- Durasi Total: ${(context.totalDuration || 0).toFixed?.(1) ?? context.totalDuration}s
- Durasi VO: ${context.audioDurationSec || 0}s
- Suara VO: "${context.selectedVoice || "Zephyr"}"
- Naskah: "${(context.polishedScript || context.rawScript || "Belum ada").substring(0, 200)}"
- Gaya Subtitle: "${context.subtitleStyle || "plain-shadow"}", Font: ${context.subtitleFontSize || 44}px, Posisi: ${context.subtitleBottomPos || 220}px
- Color Grade: "${context.editingStyle || "none"}"
- Judul: enabled=${context.titleConfig?.enabled}, teks="${context.titleConfig?.line1 || ""} ${context.titleConfig?.line2 || ""}", font=${context.titleConfig?.fontFamily ?? "inter"}, posisi=(${context.titleConfig?.positionX ?? 50}, ${context.titleConfig?.positionY ?? 40}), scale=${context.titleConfig?.scale ?? 1}
- Transisi: ${JSON.stringify(context.transitionsMap || {})}
- BGM: "${context.bgmUrl || "Tidak ada"}", Volume: ${context.bgmVolume ?? 0.2}
- Rasio: ${context.aspectRatio || "9:16"}, Preset: ${context.exportPreset || "720p"}`;
}

async function runServerTool(name: string, args: Record<string, unknown>, origin: string): Promise<unknown> {
  try {
    if (name === "analyze_reference_style") {
      const res = await fetch(`${origin}/api/analyze-style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return await res.json();
    }
    if (name === "recommend_bgm") {
      const res = await fetch(`${origin}/api/select-bgm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return await res.json();
    }
    return { error: `Unknown server tool: ${name}` };
  } catch (err: any) {
    return { error: err?.message || "Server tool failed" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message: string | undefined = body.message || body.prompt;
    const context = body.context || {};
    const history: Content[] = Array.isArray(body.history) ? body.history : [];
    // Results the client already computed for a previous batch of client-tool calls.
    const clientResults: Array<{ name: string; id?: string; response: unknown }> = Array.isArray(body.clientResults) ? body.clientResults : [];

    const contents: Content[] = [...history];

    if (clientResults.length > 0) {
      contents.push({
        role: "user",
        parts: clientResults.map((r) => ({ functionResponse: { name: r.name, id: r.id, response: { result: r.response } } })),
      });
    } else if (message) {
      contents.push({ role: "user", parts: [{ text: message }] });
    } else {
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    }

    const systemInstruction = buildSystemInstruction(context);
    const origin = req.nextUrl.origin;

    let finalText: string | null = null;
    let pendingClientActions: Array<{ id: string; type: string; payload: any; requiresConfirmation: boolean }> = [];

    for (let turn = 0; turn < MAX_LOOP_TURNS; turn++) {
      let result: any = null;
      let lastErr: any = null;
      for (const modelName of CANDIDATE_MODELS) {
        try {
          result = await genai.models.generateContent({
            model: modelName,
            contents,
            config: {
              temperature: 0.2,
              systemInstruction,
              tools: [{ functionDeclarations: ALL_TOOLS }],
            },
          });
          if (result) break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!result) throw lastErr || new Error("Gagal menghubungi model Gemini.");

      const calls = result.functionCalls || [];

      if (calls.length === 0) {
        const text: string = result.text || "Baik.";
        finalText = text;
        contents.push({ role: "model", parts: [{ text }] });
        break;
      }

      // Record the model's tool-call turn in history.
      contents.push({ role: "model", parts: calls.map((c: any) => ({ functionCall: c })) });

      const serverCalls = calls.filter((c: any) => !CLIENT_TOOL_NAMES.has(c.name));
      const clientCalls = calls.filter((c: any) => CLIENT_TOOL_NAMES.has(c.name));

      // Server-side (read-only) tools resolve immediately, in-loop, no client round-trip.
      if (serverCalls.length > 0) {
        const responseParts: Part[] = [];
        for (const call of serverCalls) {
          const toolResult = await runServerTool(call.name!, call.args || {}, origin);
          responseParts.push({ functionResponse: { name: call.name, id: call.id, response: { result: toolResult } } });
        }
        contents.push({ role: "user", parts: responseParts });
      }

      // Client (state-mutating) tools must be executed by the browser — hand them off.
      if (clientCalls.length > 0) {
        pendingClientActions = clientCalls.map((c: any) => ({
          id: c.id || `${c.name}_${Math.random().toString(36).slice(2)}`,
          type: c.name,
          payload: c.args || {},
          requiresConfirmation: CONFIRM_REQUIRED_NAMES.has(c.name),
        }));
        break; // return to client now; it will call back with clientResults to continue
      }

      // Only server tools were called this turn — loop again so the model can react to their results.
    }

    if (finalText === null && pendingClientActions.length === 0) {
      finalText = "Sudah saya proses, tapi butuh langkah lebih lanjut — coba pertegas maksudmu ya.";
    }

    return NextResponse.json({
      history: contents,
      message: pendingClientActions.length > 0 ? null : finalText,
      actions: pendingClientActions,
      done: pendingClientActions.length === 0,
    });
  } catch (err: any) {
    console.error("AI Copilot error:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan pada AI Copilot." },
      { status: 500 }
    );
  }
}
