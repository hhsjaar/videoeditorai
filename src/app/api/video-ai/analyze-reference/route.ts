import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";
import { downloadReferenceVideo, cleanupReferenceDownload } from "@/lib/ytDlp";

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)/i.test(url);
}

const TIMESTAMP_SCHEMA = {
  type: "object",
  properties: {
    start: { type: "string", description: "Waktu mulai segmen, format MM:SS" },
    end: { type: "string", description: "Waktu selesai segmen, format MM:SS" },
    description: { type: "string", description: "Apa yang terjadi di segmen ini — visual, aksi, dan audio/dialog, Bahasa Indonesia, cukup detail" },
  },
  required: ["start", "end", "description"],
};

// Same shape as concepts/route.ts's CONCEPT_SCHEMA — reused as-is so the
// remix options here can flow straight into the existing concept-picking UI
// and QA→storyboard pipeline without any new plumbing.
const CONCEPT_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    angle: { type: "string", description: "Sudut pandang remix ini dibanding video asli" },
    hook: { type: "string" },
    summary: { type: "string", description: "Jelaskan remix ini dan seberapa mirip/beda dari video asli" },
    targetAudience: { type: "string" },
    vibeTags: { type: "array", items: { type: "string" } },
    recommendedVoice: { type: "string", enum: ["Zephyr", "Puck", "Kore", "Fenrir", "Aoede", "Charon"] },
    recommendedBgm: { type: "string", enum: ["bsl1", "bsl2", "bsl3", "bsl4", "bsl5", "bsl6", "bsl7", "bsl8", "bsl9", "bsl10"] },
    visualStyle: { type: "string" },
    previewScript: { type: "string" },
  },
  required: ["id", "title", "angle", "hook", "summary", "targetAudience", "vibeTags", "recommendedVoice", "recommendedBgm", "visualStyle", "previewScript"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    videoTitle: { type: "string" },
    sourceDurationSec: { type: "integer" },
    timestamps: { type: "array", items: TIMESTAMP_SCHEMA, description: "Breakdown lengkap video dari awal sampai akhir, per segmen/beat penting" },
    referenceProfile: {
      type: "object",
      description: "Profil gaya video ini — dipakai supaya versi remake tetap konsisten dengan referensi",
      properties: {
        visualStyle: { type: "string", description: "Gaya visual & rendering (lensa, grading warna, pacing shot, dsb)" },
        environment: { type: "string", description: "Setting/lokasi/environment yang dominan di video ini" },
        concept: { type: "string", description: "Konsep/tema besar video ini" },
        tone: { type: "string", description: "Tone/mood keseluruhan" },
        editingPace: { type: "string", description: "Karakter pace editing: cepat/lambat, jumlah cut, gaya transisi" },
      },
      required: ["visualStyle", "environment", "concept", "tone", "editingPace"],
    },
    concepts: { type: "array", minItems: 4, maxItems: 4, items: CONCEPT_SCHEMA, description: "4 opsi remake dari video ini: 1 versi 'serupa/replikasi mirip' + 3 versi angle berbeda" },
  },
  required: ["videoTitle", "sourceDurationSec", "timestamps", "referenceProfile", "concepts"],
};

export async function POST(req: NextRequest) {
  let downloadedPath: string | null = null;
  try {
    const { url, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }
    if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Link video tidak valid." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    let fileUri: string;
    let mimeType: string | undefined;

    if (isYouTubeUrl(url)) {
      // Gemini fetches YouTube videos natively — no download needed.
      fileUri = url;
      mimeType = undefined;
    } else {
      // Instagram/TikTok/etc. — no native support, download via yt-dlp then
      // upload through Gemini's Files API.
      const jobId = randomUUID();
      const { filePath, mimeType: detectedMime } = await downloadReferenceVideo(url, jobId);
      downloadedPath = filePath;

      let uploaded = await ai.files.upload({ file: filePath, config: { mimeType: detectedMime } });
      const name = uploaded.name!;
      const startedAt = Date.now();
      while (uploaded.state === "PROCESSING") {
        if (Date.now() - startedAt > 120000) throw new Error("Gemini terlalu lama memproses video yang diunggah (timeout).");
        await new Promise((r) => setTimeout(r, 3000));
        uploaded = await ai.files.get({ name });
      }
      if (uploaded.state !== "ACTIVE" || !uploaded.uri) {
        throw new Error(`Gagal memproses video di Gemini (status: ${uploaded.state}).`);
      }
      fileUri = uploaded.uri;
      mimeType = uploaded.mimeType;
    }

    const analysisPrompt = `Anda adalah video analyst + content strategist kelas dunia. Tonton video yang dilampirkan ini dari awal sampai akhir dengan teliti.

Tugas:
1. "timestamps": buat breakdown LENGKAP dari awal sampai akhir video — setiap segmen/beat penting (bukan cuma highlight), sebutkan apa yang terlihat & terdengar di tiap segmen, format waktu MM:SS.
2. "referenceProfile": rangkum gaya visual, environment/setting, konsep besar, tone, dan karakter pace editing video ini — ini akan dipakai supaya video remake-nya konsisten dengan gaya video asli.
3. "concepts": berikan 4 opsi remake — opsi pertama "replikasi mirip" (angle & struktur serupa video asli, cuma beda eksekusi/konten spesifik), 3 opsi lainnya angle yang cukup berbeda tapi tetap terinspirasi dari video ini. Isi tiap concept lengkap (title, angle, hook, summary, targetAudience, vibeTags, recommendedVoice, recommendedBgm, visualStyle, previewScript) — summary WAJIB jelasin seberapa mirip/beda remake ini dari video aslinya.
4. Semua teks dalam Bahasa Indonesia yang natural, KECUALI "visualStyle" dan "recommendedVoice"/"recommendedBgm" (enum tetap dalam format aslinya).`;

    const parts: any[] = [
      { fileData: mimeType ? { fileUri, mimeType } : { fileUri } },
      { text: analysisPrompt },
    ];

    const candidateModels = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3-flash-preview"];
    let responseText = "";
    let lastErr: any = null;
    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: [{ role: "user", parts }],
          config: { temperature: 0.4, responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA },
        });
        if (response?.text) { responseText = response.text; break; }
      } catch (err: any) {
        console.warn(`[analyze-reference] failed on ${mName}:`, err?.message?.slice(0, 200));
        lastErr = err;
      }
    }
    if (!responseText) throw lastErr || new Error("Gagal menganalisis video referensi.");

    const parsed = JSON.parse(responseText);
    const concepts = (parsed.concepts || []).map((c: any, i: number) => ({ ...c, isRareAngle: i > 0 }));

    return NextResponse.json({
      success: true,
      videoTitle: parsed.videoTitle,
      sourceDurationSec: parsed.sourceDurationSec,
      timestamps: parsed.timestamps || [],
      referenceProfile: parsed.referenceProfile,
      concepts,
    });
  } catch (error: any) {
    console.error("Error analyzing reference video:", error);
    return NextResponse.json({ error: error.message || "Gagal menganalisis link video." }, { status: 500 });
  } finally {
    if (downloadedPath) await cleanupReferenceDownload(downloadedPath);
  }
}
