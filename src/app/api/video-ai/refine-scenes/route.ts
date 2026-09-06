import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { CINEMATOGRAPHY_RULES } from "@/lib/videoPromptCraft";

function buildSceneSchema(per10: boolean) {
  return {
    type: "object",
    properties: {
      sceneNumber: { type: "integer" },
      duration: per10
        ? { type: "integer", enum: [10], description: "Durasi scene WAJIB tepat 10 detik (mode scripting prompt per 10 detik)" }
        : { type: "integer", enum: [5, 10], description: "Durasi scene dalam detik — HARUS salah satu dari 5 atau 10 (batasan AI video engine)" },
      visualPrompt: {
        type: "string",
        description:
          "Prompt video Bahasa Inggris, ditulis MENGALIR dalam satu paragraf (bukan daftar/bullet), mengikuti urutan: [subject + detailed description] + [specific action + EXPLICIT staging/blocking, arah hadap & posisi elemen lain relatif ke subjek] + [location & time] + [camera movement DENGAN tujuan naratif jelas, bukan cuma nama gerakan] + [lighting & mood] + [visual style] + [audio: dialogue/ambience/sound effects]. Deskriptif seperti menceritakan apa yang terlihat, bukan perintah.",
      },
      voiceoverText: { type: "string", description: "Teks voice over Bahasa Indonesia natural, komunikatif, pas dengan durasi — SAMA PERSIS dengan narasi baris storyboard yang jadi sumbernya" },
      cameraMotion: { type: "string", enum: ["zoom-in", "zoom-out", "pan-left", "pan-right", "slow-tilt", "dolly-forward"] },
      transition: { type: "string", enum: ["light-leak", "zoom-blur", "flash-white", "fade-black", "film-burn", "passerby"] },
      overlayTitle: { type: "string", description: "Teks judul/kata kunci singkat penarik perhatian, atau string kosong jika tidak perlu" },
    },
    required: ["sceneNumber", "duration", "visualPrompt", "voiceoverText", "cameraMotion", "transition", "overlayTitle"],
  };
}

function buildResponseSchema(per10: boolean) {
  return {
    type: "object",
    properties: {
      scenes: { type: "array", items: buildSceneSchema(per10) },
    },
    required: ["scenes"],
  };
}

// Rounds UP to the nearest Kling-legal duration (never down) — a clip shorter
// than its narration's actual length would chop the voiceover off mid-word.
function clampToKlingDuration(requested: number): 5 | 10 {
  const options: Array<5 | 10> = [5, 10];
  return options.find((v) => v >= requested) ?? 10;
}

export async function POST(req: NextRequest) {
  try {
    const {
      storyboard,
      aspectRatio = "9:16",
      voice = "Zephyr",
      bgmId = "bsl1",
      clipDurationSec,
      apiKey,
    } = await req.json();

    const per10 = clipDurationSec === 10;

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }
    if (!storyboard || !Array.isArray(storyboard.rows) || storyboard.rows.length === 0) {
      return NextResponse.json({ error: "Storyboard tidak ditemukan." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    const profile = storyboard.consistencyProfile || {};
    const hasCharacter = !!(profile.character && profile.character.trim());

    const rowsText = storyboard.rows
      .map(
        (r: any, i: number) =>
          `Baris ${i + 1} (id ${r.id}, durasi ${Math.max(1, r.endSec - r.startSec)} detik):\n- Visual (ID): ${r.visual}\n- Narasi (ID): ${r.narration}\n- Emosi: ${r.emotion}`
      )
      .join("\n\n");

    const systemPrompt = `Anda adalah sutradara + penulis prompt AI video engine kelas dunia. Ubah setiap baris storyboard di bawah ini jadi satu prompt video Bahasa Inggris, satu scene per baris storyboard (jangan digabung, jangan dipecah lagi).

PROFIL KONSISTENSI (WAJIB dipakai identik di SETIAP scene yang relevan — ini kunci supaya semua klip terasa satu video utuh saat dirangkai):
- Karakter utama: ${hasCharacter ? profile.character : "(tidak ada — video ini faceless/b-roll, jangan sebut karakter manusia tetap)"}
- Gaya visual: ${profile.visualStyle || "cinematic, photorealistic"}
- Environment/lokasi: ${profile.environment || "(ikuti konteks tiap baris)"}
- Pencahayaan & mood: ${profile.lighting || "(ikuti konteks tiap baris)"}
- Bahasa kamera: ${profile.cameraLanguage || "(bebas, sesuai aksi tiap baris)"}
- Aspek rasio output: ${aspectRatio}

Storyboard (sumber, Bahasa Indonesia):
${rowsText}

Aturan WAJIB untuk tiap "visualPrompt":
1. Bahasa Inggris, ditulis MENGALIR dalam satu paragraf utuh (bukan bullet/list), dengan urutan: [subjek + deskripsi detail] + [aksi spesifik] + [lokasi & waktu] + [pergerakan kamera] + [pencahayaan & mood] + [gaya visual] + [audio: dialog/ambience/sound effect].
2. Deskriptif, seolah menceritakan apa yang terlihat — bukan kalimat perintah ("show", "generate", dsb dilarang).
3. ${hasCharacter ? "WAJIB buka paragraf dengan deskripsi karakter di atas KATA-PER-KATA sama (boleh diterjemahkan ke Inggris tapi detail & urutannya harus identik) di SETIAP scene yang menampilkan karakter — jangan sampai deskripsi berubah antar scene." : "Video ini faceless — jangan munculkan karakter manusia tetap yang sama, fokus ke objek/environment/b-roll."}
4. Gaya visual (visualStyle di atas) HARUS disebut dengan istilah yang sama/konsisten di SETIAP scene (lensa, grain, color grade, dsb) supaya terasa satu video.
5. Sertakan audio: dialog (kalau ada, kutip voiceoverText baris itu dalam Bahasa Indonesia APA ADANYA di dalam narasi audio — JANGAN diterjemahkan ke Inggris, sama seperti mode default), ambience lokasi, dan sound effect yang relevan.
6. Jangan pakai nama orang asli/tokoh terkenal.
7. "voiceoverText" HARUS sama persis dengan narasi baris storyboard sumbernya (jangan diubah).
8. ${per10 ? '"duration" WAJIB tepat 10 detik untuk setiap scene. Tiap scene mewakili satu blok 10 detik penuh, jadi visualPrompt boleh memuat beberapa beat aksi yang mengalir dalam 10 detik itu.' : '"duration" harus salah satu dari 5 atau 10 detik — pilih yang paling dekat dengan durasi baris storyboard sumbernya.'}
9. Urutan "scenes" HARUS sama dengan urutan baris storyboard di atas, sceneNumber mulai dari 1${per10 ? ", jumlah scene HARUS sama dengan jumlah baris storyboard" : ""}.

Aturan sinematografi tambahan (WAJIB, ini yang paling sering bikin hasil video AI kelihatan "kosong" secara emosional kalau dilewatkan):
${CINEMATOGRAPHY_RULES}`;

    const candidateModels = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3-flash-preview"];
    let responseText = "";
    let lastErr: any = null;

    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: systemPrompt,
          config: {
            temperature: 0.5,
            responseMimeType: "application/json",
            responseJsonSchema: buildResponseSchema(per10),
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

    if (!responseText) throw lastErr || new Error("Gagal mengolah breakdown scene Gemini.");

    const parsedData = JSON.parse(responseText);
    const scenes = (parsedData.scenes || []).map((sc: any, i: number) => ({
      ...sc,
      sceneNumber: i + 1,
      duration: per10 ? 10 : clampToKlingDuration(sc.duration || 5),
    }));

    return NextResponse.json({
      success: true,
      refinedData: {
        videoTitle: storyboard.videoTitle,
        summary: storyboard.concept30s?.takeawayFeeling || "",
        concept30s: storyboard.concept30s,
        characterDescription: profile.character || "",
        consistencyProfile: profile,
        aspectRatio,
        stylePreset: profile.visualStyle || "cinematic",
        voice,
        bgmId,
        totalDuration: storyboard.rows.reduce((acc: number, r: any) => acc + Math.max(1, r.endSec - r.startSec), 0),
        scenes,
      },
    });
  } catch (error: any) {
    console.error("Error refining video scenes:", error);
    return NextResponse.json({ error: error.message || "Gagal menyusun naskah adegan video." }, { status: 500 });
  }
}
