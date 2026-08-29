"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Check, RefreshCw, Sparkles, Copy } from "lucide-react";
import { QUALITY_PRICE_PER_SEC, QUALITY_LABELS, type VeoQuality } from "@/lib/veoPricing";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Concept {
  id: string;
  title: string;
  angle: string;
  hook: string;
  summary: string;
  vibeTags: string[];
  recommendedVoice: string;
  recommendedBgm: string;
  isRareAngle?: boolean;
}

interface Scene {
  sceneNumber: number;
  duration: number;
  visualPrompt: string;
  voiceoverText: string;
  overlayTitle?: string;
  veoJobId?: string | null;
  veoStatus?: "generating" | "done" | "error";
  veoError?: string | null;
  videoUrl?: string | null;
  // Present when this scene comes from the image-upload flow — Veo animates
  // FROM this photo (image-to-video) instead of imagining it from text alone.
  sourceImageBase64?: string;
  sourceImageMimeType?: string;
}

interface UploadedRefImage {
  id: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
  name: string;
}

interface StoryboardShot {
  shotNumber: number;
  shotType: string;
  cameraAngle: string;
  action: string;
  lighting: string;
  mood: string;
  imageUrl: string | null;
  imageBase64: string | null;
  imageMimeType: string | null;
  error?: string;
}

interface ImageStoryboardData {
  videoTitle: string;
  consistencyProfile: { subject: string; visualStyle: string };
  shots: StoryboardShot[];
}

interface ClarifyingQuestion {
  imageIndex: number;
  question: string;
}

interface ReferenceTimestamp {
  start: string;
  end: string;
  description: string;
}

interface ReferenceProfile {
  visualStyle: string;
  environment: string;
  concept: string;
  tone: string;
  editingPace: string;
}

interface ReferenceAnalysis {
  videoTitle: string;
  sourceDurationSec: number;
  timestamps: ReferenceTimestamp[];
  referenceProfile: ReferenceProfile;
  concepts: Concept[];
}

interface ConsistencyProfile {
  character: string;
  visualStyle: string;
  environment: string;
  lighting: string;
  cameraLanguage: string;
}

interface StoryboardRow {
  id: string;
  startSec: number;
  endSec: number;
  visual: string;
  narration: string;
  emotion: string;
}

interface StoryboardIndoData {
  videoTitle: string;
  concept30s: { problemHook: string; turningPoint: string; takeawayFeeling: string };
  consistencyProfile: ConsistencyProfile;
  rows: StoryboardRow[];
}

interface RefinedData {
  videoTitle: string;
  summary: string;
  concept30s?: { problemHook: string; turningPoint: string; takeawayFeeling: string };
  characterDescription?: string;
  aspectRatio: string;
  voice?: string;
  bgmId?: string;
  scenes: Scene[];
}

interface QAStep {
  key: string;
  question: string;
  options: string[];
}

const CUSTOM_OPTION = "Lainnya, aku tulis sendiri";

interface ChatMsg {
  id: string;
  sender: "ai" | "user";
  kind:
    | "text"
    | "loading"
    | "keywords-concepts"
    | "quick-replies"
    | "storyboard-id"
    | "storyboard"
    | "duration-choice"
    | "scenes-generate"
    | "user-images"
    | "image-choice"
    | "image-storyboard-grid"
    | "image-clarify"
    | "reference-analysis";
  text?: string;
  keywords?: string[];
  concepts?: Concept[];
  qaKey?: string;
  qaOptions?: string[];
  answered?: boolean;
  storyboardIndo?: StoryboardIndoData;
  refinedData?: RefinedData;
  images?: UploadedRefImage[];
  imageStoryboard?: ImageStoryboardData;
  clarifyingQuestions?: ClarifyingQuestion[];
  referenceAnalysis?: ReferenceAnalysis;
}

let idCounter = 0;
const nextId = () => `m${++idCounter}_${Date.now()}`;

const MAX_REF_IMAGES = 5;

// Downscales+recompresses an uploaded image client-side before it goes into a
// JSON request body — keeps payloads small (5 uploads x multi-MB phone
// photos would otherwise be a multi-MB POST) and avoids proxy body-size limits.
function compressImageFile(file: File, maxDim = 1280, quality = 0.85): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak didukung."));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ dataUrl, base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface VideoAIChatProps {
  apiKey?: string;
  onSendToKlipAI?: (projectData: any) => void | Promise<void>;
}

export const VideoAIChat: React.FC<VideoAIChatProps> = ({ apiKey, onSendToKlipAI }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: nextId(),
      sender: "ai",
      kind: "text",
      text: "Halo! 👋 Aku content strategist & sutradara AI kamu. Ceritain mau bikin video apa — topiknya apa, buat platform mana (Shorts/Reels/TikTok/YouTube), dan target penontonnya siapa. Boleh ditulis santai dalam satu kalimat aja.",
    },
  ]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<
    | "brief"
    | "duration-choice"
    | "duration-custom"
    | "concepts"
    | "qa"
    | "qa-custom"
    | "storyboard"
    | "done"
    | "image-choice"
    | "image-clarify"
  >("brief");
  // When true, the whole run is prompt-only: clips are grouped per 10s and the
  // final output is just English prompts — no video generate/merge/download.
  const [promptOnlyMode, setPromptOnlyMode] = useState(false);
  const [customTotalDuration, setCustomTotalDuration] = useState<number | null>(null);
  const [pendingImages, setPendingImages] = useState<UploadedRefImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageScenesRef = useRef<{ images: Array<{ base64: string; mimeType: string }> } | null>(null);
  const clarifyAnswersRef = useRef<Record<number, string>>({});
  const referenceProfileRef = useRef<ReferenceProfile | null>(null);
  const [qaSteps, setQaSteps] = useState<QAStep[]>([]);
  const [qaIndex, setQaIndex] = useState(0);
  const [qaAnswers, setQaAnswers] = useState<Record<string, string>>({});
  const [pendingCustomKey, setPendingCustomKey] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [briefText, setBriefText] = useState("");
  const [quality, setQuality] = useState<VeoQuality>("lite");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function pushMsg(msg: Omit<ChatMsg, "id">) {
    setMessages((prev) => [...prev, { ...msg, id: nextId() }]);
  }

  function updateMsg(id: string, patch: Partial<ChatMsg>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function pushLoading(text: string): string {
    const id = nextId();
    setMessages((prev) => [...prev, { id, sender: "ai", kind: "loading", text }]);
    return id;
  }

  function removeMsg(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function callApi(path: string, body: any) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || "Terjadi kesalahan.");
    return data;
  }

  // ─── Step 1: brief → concepts ────────────────────────────────────────────
  async function handleSendBrief() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    pushMsg({ sender: "user", kind: "text", text });
    setBriefText(text);
    referenceProfileRef.current = null; // reset — set again below only if this brief is a reference link

    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      await handleAnalyzeReference(urlMatch[0]);
      return;
    }

    // Before researching topics: ask default duration vs custom-per-10s.
    // Custom-per-10s switches the whole run into prompt-only mode (no video).
    setPromptOnlyMode(false);
    setCustomTotalDuration(null);
    pushMsg({
      sender: "ai",
      kind: "duration-choice",
      text:
        "Sebelum lanjut, video ini mau dibuat dengan durasi default, atau custom durasi per 10 detik?\n\n• Default — alur biasa: riset topik → storyboard → prompt → generate video.\n• Custom durasi per 10 detik — kamu tentukan total durasi (kelipatan 10), breakdown & naskahnya dikelompokkan per 10 detik. Mode ini HANYA menghasilkan prompt Bahasa Inggris (tanpa generate video, edit, atau download).",
    });
    setPhase("duration-choice");
  }

  // Shared step 1b: kick off topic/keyword research (used by both duration modes).
  async function runConcepts(text: string) {
    const loadingId = pushLoading("Lagi riset angle & keyword yang relevan...");
    try {
      const data = await callApi("/api/video-ai/concepts", { prompt: text, aspectRatio: "9:16", targetDuration: 30, tone: "kreatif", apiKey });
      removeMsg(loadingId);
      pushMsg({
        sender: "ai",
        kind: "keywords-concepts",
        keywords: data.keywords || [],
        concepts: data.concepts || [],
        text: "Ini hasil risetnya 👇 Klik salah satu angle yang paling cocok buat lanjut.",
      });
      setPhase("concepts");
    } catch (err: any) {
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "text", text: `Maaf, gagal riset ide: ${err.message}` });
    }
  }

  function handleDurationDefault(msgId: string) {
    updateMsg(msgId, { answered: true });
    setPromptOnlyMode(false);
    setCustomTotalDuration(null);
    pushMsg({ sender: "user", kind: "text", text: "Durasi default" });
    runConcepts(briefText);
  }

  function handleDurationCustom(msgId: string) {
    updateMsg(msgId, { answered: true });
    pushMsg({ sender: "user", kind: "text", text: "Custom durasi per 10 detik" });
    pushMsg({
      sender: "ai",
      kind: "text",
      text: "Oke — mode prompt-only (tanpa video). Ketik total durasi video yang kamu mau dalam detik, HARUS kelipatan 10 (contoh: 10, 20, 100, 120). Kalau bukan kelipatan 10, aku tolak.",
    });
    setPhase("duration-custom");
  }

  function handleCustomDurationSubmit() {
    const raw = input.trim();
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 10 || n % 10 !== 0) {
      setInput("");
      pushMsg({ sender: "user", kind: "text", text: raw });
      pushMsg({
        sender: "ai",
        kind: "text",
        text: `"${raw}" bukan kelipatan 10 yang valid. Masukkan angka kelipatan 10 (minimal 10), contoh: 10, 20, 100, 120.`,
      });
      return;
    }
    setInput("");
    setPromptOnlyMode(true);
    setCustomTotalDuration(n);
    pushMsg({ sender: "user", kind: "text", text: `${n} detik` });
    pushMsg({
      sender: "ai",
      kind: "text",
      text: `Siap — total ${n} detik = ${n / 10} klip @ 10 detik. Output akhir: prompt Bahasa Inggris per klip, tanpa generate video.`,
    });
    runConcepts(briefText);
  }

  // ─── Reference-video-link flow ───────────────────────────────────────────
  async function handleAnalyzeReference(url: string) {
    const loadingId = pushLoading("Nonton & menganalisis video referensi (bisa beberapa menit buat video panjang)...");
    try {
      const data = await callApi("/api/video-ai/analyze-reference", { url, apiKey });
      removeMsg(loadingId);
      referenceProfileRef.current = data.referenceProfile || null;
      pushMsg({
        sender: "ai",
        kind: "reference-analysis",
        referenceAnalysis: {
          videoTitle: data.videoTitle,
          sourceDurationSec: data.sourceDurationSec,
          timestamps: data.timestamps || [],
          referenceProfile: data.referenceProfile,
          concepts: data.concepts || [],
        },
        text: `Udah aku tonton & analisis! "${data.videoTitle}" (${data.sourceDurationSec}s). Cek breakdown-nya, terus pilih mau dibuat serupa atau versi lain.`,
      });
      setPhase("concepts");
    } catch (err: any) {
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "text", text: `Maaf, gagal menganalisis link video: ${err.message}` });
    }
  }

  // ─── Image upload flow ────────────────────────────────────────────────────
  async function handleImageFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_REF_IMAGES - pendingImages.length;
    if (room <= 0) {
      pushMsg({ sender: "ai", kind: "text", text: `Maksimal ${MAX_REF_IMAGES} foto ya, udah penuh nih.` });
      return;
    }
    const toAdd = Array.from(files).slice(0, room);
    try {
      const compressed = await Promise.all(toAdd.map((f) => compressImageFile(f)));
      const newImages: UploadedRefImage[] = compressed.map((c, i) => ({
        id: `img_${Date.now()}_${i}`,
        dataUrl: c.dataUrl,
        base64: c.base64,
        mimeType: c.mimeType,
        name: toAdd[i].name,
      }));
      setPendingImages((prev) => [...prev, ...newImages]);
    } catch (err: any) {
      pushMsg({ sender: "ai", kind: "text", text: `Gagal memproses gambar: ${err.message}` });
    }
  }

  function handleRemovePendingImage(id: string) {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handleSendImages() {
    if (pendingImages.length === 0) return;
    const caption = input.trim();
    setInput("");
    const images = pendingImages;
    setPendingImages([]);
    setBriefText(caption);

    pushMsg({ sender: "user", kind: "user-images", text: caption, images });

    if (images.length > 1) {
      pushMsg({
        sender: "ai",
        kind: "image-choice",
        text: `Aku lihat kamu upload ${images.length} foto. Mau aku buatin storyboard dulu (6-8 shot baru yang photorealistic, konsisten sama salah satu foto ini), atau langsung generate video pakai tiap foto apa adanya (${images.length} klip, 1 klip per foto)?`,
        images,
      });
    } else {
      pushMsg({
        sender: "ai",
        kind: "image-choice",
        text: "Mau aku buatin storyboard dulu dari foto ini (6-8 shot baru yang photorealistic), atau langsung generate video pakai foto ini apa adanya?",
        images,
      });
    }
    setPhase("image-choice");
  }

  async function handleImageChoiceStoryboard(msgId: string, chosenImage: UploadedRefImage) {
    updateMsg(msgId, { answered: true });
    pushMsg({ sender: "user", kind: "text", text: `Buatkan storyboard dari: ${chosenImage.name}` });

    const loadingId = pushLoading("Menganalisis foto & menyusun 6-8 shot storyboard, lalu generate gambarnya...");
    try {
      const data = await callApi("/api/video-ai/image-storyboard", {
        imageBase64: chosenImage.base64,
        imageMimeType: chosenImage.mimeType,
        userContext: briefText,
        apiKey,
      });
      removeMsg(loadingId);
      pushMsg({
        sender: "ai",
        kind: "image-storyboard-grid",
        imageStoryboard: data.storyboard,
        text: "Nih storyboard-nya! Cek dulu tiap shot-nya, kalau udah oke tinggal lanjut ke generate video.",
      });
    } catch (err: any) {
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "text", text: `Maaf, gagal bikin storyboard: ${err.message}` });
      setPhase("image-choice");
    }
  }

  async function handleImageChoiceDirect(msgId: string, images: UploadedRefImage[]) {
    updateMsg(msgId, { answered: true });
    pushMsg({ sender: "user", kind: "text", text: "Langsung generate aja, pakai foto apa adanya." });
    await runImageScenes(
      images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
      {}
    );
  }

  async function handleConfirmImageStoryboard(storyboard: ImageStoryboardData) {
    const usable = storyboard.shots.filter((s) => s.imageBase64);
    if (usable.length === 0) {
      pushMsg({ sender: "ai", kind: "text", text: "Maaf, semua shot gagal digenerate gambarnya — coba lagi dari awal ya." });
      return;
    }
    await runImageScenes(
      usable.map((s) => ({ base64: s.imageBase64!, mimeType: s.imageMimeType || "image/jpeg" })),
      {}
    );
  }

  async function runImageScenes(images: Array<{ base64: string; mimeType: string }>, imageHints: Record<string, string>) {
    const loadingId = pushLoading("Menganalisis tiap gambar & menulis naskah voice over...");
    try {
      const data = await callApi("/api/video-ai/image-scenes", {
        images,
        userContext: briefText,
        imageHints,
        apiKey,
      });
      removeMsg(loadingId);

      if (data.clarifyingQuestions && data.clarifyingQuestions.length > 0 && Object.keys(imageHints).length === 0) {
        // Only ask once — store the pending refinedData + images so we can
        // finalize immediately after the user answers (or skips).
        pendingImageScenesRef.current = { images };
        pushMsg({
          sender: "ai",
          kind: "image-clarify",
          clarifyingQuestions: data.clarifyingQuestions,
          text: "Sebelum aku tuliskan naskahnya, ada beberapa gambar yang kurang jelas — boleh dijelasin dikit?",
        });
        setPhase("image-clarify");
        return;
      }

      pushMsg({
        sender: "ai",
        kind: "storyboard",
        refinedData: data.refinedData,
        text: "Nih hasilnya! Naskah & prompt video siap generate, konsisten sama foto yang kamu kasih.",
      });
      setPhase("done");
    } catch (err: any) {
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "text", text: `Maaf, gagal menyusun naskah: ${err.message}` });
    }
  }

  async function handleImageClarifySubmit(msgId: string, questions: ClarifyingQuestion[]) {
    updateMsg(msgId, { answered: true });
    const pending = pendingImageScenesRef.current;
    if (!pending) return;
    const hints: Record<string, string> = {};
    questions.forEach((q) => {
      const val = clarifyAnswersRef.current[q.imageIndex];
      if (val && val.trim()) hints[String(q.imageIndex)] = val.trim();
    });
    pushMsg({ sender: "user", kind: "text", text: Object.keys(hints).length > 0 ? "Oke, ini penjelasannya." : "(Skip, langsung aja)" });
    clarifyAnswersRef.current = {};
    setPhase("done");
    await runImageScenes(pending.images, hints);
  }

  // ─── Step 2: pick concept → fetch contextual Q&A ─────────────────────────
  async function handlePickConcept(concept: Concept) {
    if (phase !== "concepts") return;
    setSelectedConcept(concept);
    pushMsg({ sender: "user", kind: "text", text: `Aku pilih: "${concept.title}"` });

    const loadingId = pushLoading("Menyiapkan pertanyaan yang relevan buat konsep ini...");
    try {
      const data = await callApi("/api/video-ai/qa-questions", { brief: briefText, concept, apiKey });
      removeMsg(loadingId);
      const steps: QAStep[] = data.questions && data.questions.length > 0
        ? data.questions
        : [{ key: "arahan_tambahan", question: "Ada arahan tambahan yang mau kamu tentuin sebelum lanjut?", options: ["Bebas, kamu pilihin"] }];
      setQaSteps(steps);
      setQaAnswers({});
      setPhase("qa");
      setQaIndex(0);
      askQA(steps, 0);
    } catch (err: any) {
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "text", text: `Maaf, gagal nyiapin pertanyaan: ${err.message}` });
      setPhase("concepts");
    }
  }

  function askQA(steps: QAStep[], index: number) {
    const step = steps[index];
    pushMsg({ sender: "ai", kind: "quick-replies", qaKey: step.key, qaOptions: step.options, text: step.question });
  }

  function advanceQA(index: number) {
    const nextIndex = index + 1;
    if (nextIndex < qaSteps.length) {
      setQaIndex(nextIndex);
      askQA(qaSteps, nextIndex);
    } else {
      buildStoryboardIndo(qaAnswers);
    }
  }

  function handleQAAnswer(msgId: string, key: string, value: string) {
    if (value === CUSTOM_OPTION) {
      updateMsg(msgId, { answered: true });
      setPendingCustomKey(key);
      setPhase("qa-custom");
      return;
    }
    const nextAnswers = { ...qaAnswers, [key]: value };
    setQaAnswers(nextAnswers);
    updateMsg(msgId, { answered: true });
    pushMsg({ sender: "user", kind: "text", text: value });
    advanceQA(qaIndex);
  }

  function handleQASkip(msgId: string, key: string) {
    updateMsg(msgId, { answered: true });
    pushMsg({ sender: "user", kind: "text", text: "(Skip)" });
    advanceQA(qaIndex);
  }

  function handleCustomQASubmit() {
    const text = input.trim();
    if (!text || !pendingCustomKey) return;
    setInput("");
    setQaAnswers((prev) => ({ ...prev, [pendingCustomKey]: text }));
    pushMsg({ sender: "user", kind: "text", text });
    setPendingCustomKey(null);
    setPhase("qa");
    advanceQA(qaIndex);
  }

  // ─── Step 3: build Indonesian storyboard table (review checkpoint) ──────
  async function buildStoryboardIndo(answers: Record<string, string>) {
    if (!selectedConcept) return;
    setPhase("storyboard");
    const loadingId = pushLoading("Aku susun konsep & storyboard-nya dulu ya, biar bisa kamu cek sebelum jadi prompt final...");
    try {
      const data = await callApi("/api/video-ai/storyboard", {
        concept: selectedConcept,
        userPrompt: briefText,
        qaAnswers: answers,
        targetDuration: promptOnlyMode && customTotalDuration ? customTotalDuration : 30,
        clipDurationSec: promptOnlyMode ? 10 : undefined,
        referenceProfile: referenceProfileRef.current || undefined,
        apiKey,
      });
      removeMsg(loadingId);
      pushMsg({
        sender: "ai",
        kind: "storyboard-id",
        storyboardIndo: data.storyboard,
        text: "Nih storyboard-nya! Cek dulu narasi & konsistensi karakternya, kalau udah oke tinggal klik lanjut buat generate prompt video Bahasa Inggris.",
      });
    } catch (err: any) {
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "text", text: `Maaf, gagal nyusun storyboard: ${err.message}` });
      setPhase("qa");
    }
  }

  // ─── Step 4: Indonesian storyboard confirmed → final English prompts ────
  async function handleConfirmStoryboard(storyboard: StoryboardIndoData) {
    if (!selectedConcept) return;
    const loadingId = pushLoading("Oke, aku ubah tiap baris storyboard jadi prompt video Bahasa Inggris ya, konsisten karakter & gaya visualnya...");
    try {
      const data = await callApi("/api/video-ai/refine-scenes", {
        storyboard,
        aspectRatio: "9:16",
        voice: selectedConcept.recommendedVoice || "Zephyr",
        bgmId: selectedConcept.recommendedBgm || "bsl1",
        clipDurationSec: promptOnlyMode ? 10 : undefined,
        apiKey,
      });
      removeMsg(loadingId);
      pushMsg({
        sender: "ai",
        kind: "storyboard",
        refinedData: data.refinedData,
        text: promptOnlyMode
          ? "Nih hasilnya! Prompt Bahasa Inggris per klip 10 detik — tinggal salin. (Mode prompt-only, tanpa generate video.)"
          : "Nih hasilnya! Prompt video Bahasa Inggris siap generate, konsisten karakter & gaya visualnya di semua klip.",
      });
      setPhase("done");
    } catch (err: any) {
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "text", text: `Maaf, gagal bikin prompt final: ${err.message}` });
    }
  }

  // ─── Step 4: generate video per scene ────────────────────────────────────
  async function handleGenerateScene(msgId: string, sceneNumber: number) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.refinedData) return m;
        return {
          ...m,
          refinedData: {
            ...m.refinedData,
            scenes: m.refinedData.scenes.map((s) => (s.sceneNumber === sceneNumber ? { ...s, veoStatus: "generating" as const } : s)),
          },
        };
      })
    );

    try {
      const msg = messages.find((m) => m.id === msgId);
      const scene = msg?.refinedData?.scenes.find((s) => s.sceneNumber === sceneNumber);
      if (!scene) return;

      const res = await fetch("/api/video-ai/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refinedData: { ...msg!.refinedData, scenes: [scene] },
          generationMode: "veo-video",
          quality,
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Gagal memulai generate video.");
      const jobId = data.data.scenes[0]?.veoJobId;
      if (!jobId) throw new Error("Job ID tidak ditemukan.");
      // Must be written into state — "Gabungkan & Download" reads scene.veoJobId
      // to know which files to stitch, and this was the only place it could be set.
      patchScene(msgId, sceneNumber, { veoJobId: jobId });
      pollScene(msgId, sceneNumber, jobId);
    } catch (err: any) {
      patchScene(msgId, sceneNumber, { veoStatus: "error", veoError: err.message });
    }
  }

  async function handleGenerateAllScenes(msgId: string) {
    const msg = messages.find((m) => m.id === msgId);
    const pending = (msg?.refinedData?.scenes || []).filter((s) => !s.veoStatus);
    for (let i = 0; i < pending.length; i++) {
      handleGenerateScene(msgId, pending[i].sceneNumber);
      // Google's Veo Lite quota on Tier 1 is 2 requests/minute — firing kickoffs
      // back-to-back blows past that instantly (works fine one at a time because
      // manual clicks are naturally spaced out). ~32s keeps any rolling 60s
      // window to at most 2 requests. Skip the wait after the last one.
      if (i < pending.length - 1) await new Promise((resolve) => setTimeout(resolve, 32000));
    }
  }

  function patchScene(msgId: string, sceneNumber: number, patch: Partial<Scene>) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.refinedData) return m;
        return {
          ...m,
          refinedData: {
            ...m.refinedData,
            scenes: m.refinedData.scenes.map((s) => (s.sceneNumber === sceneNumber ? { ...s, ...patch } : s)),
          },
        };
      })
    );
  }

  function pollScene(msgId: string, sceneNumber: number, jobId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video-ai/status/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal cek status.");
        if (data.status === "done" || data.status === "error") {
          clearInterval(interval);
          patchScene(msgId, sceneNumber, {
            veoStatus: data.status,
            videoUrl: data.videoUrl || null,
            veoError: data.error || null,
            // Veo doesn't always land exactly on the requested duration — use the
            // measured length so the timeline doesn't freeze-pad a short clip.
            ...(typeof data.actualDurationSeconds === "number" ? { duration: data.actualDurationSeconds } : {}),
          });
        }
      } catch (err: any) {
        clearInterval(interval);
        patchScene(msgId, sceneNumber, { veoStatus: "error", veoError: err.message });
      }
    }, 6000);
  }

  function handleSend() {
    if (phase === "brief" && pendingImages.length > 0) handleSendImages();
    else if (phase === "brief") handleSendBrief();
    else if (phase === "duration-custom") handleCustomDurationSubmit();
    else if (phase === "qa-custom") handleCustomQASubmit();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center shadow">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-xs font-black flex items-center gap-1.5">
            Video AI Strategist
            <span className="text-[8px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">Active</span>
          </h3>
          <p className="text-[10px] text-slate-400">Content Strategist + Sutradara AI</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-3xl w-full mx-auto">
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            quality={quality}
            setQuality={setQuality}
            promptOnly={promptOnlyMode}
            onDurationDefault={handleDurationDefault}
            onDurationCustom={handleDurationCustom}
            onPickConcept={handlePickConcept}
            onQAAnswer={handleQAAnswer}
            onQASkip={handleQASkip}
            onConfirmStoryboard={handleConfirmStoryboard}
            onGenerateScene={handleGenerateScene}
            onGenerateAll={handleGenerateAllScenes}
            onSendToKlipAI={onSendToKlipAI}
            onImageChoiceStoryboard={handleImageChoiceStoryboard}
            onImageChoiceDirect={handleImageChoiceDirect}
            onConfirmImageStoryboard={handleConfirmImageStoryboard}
            onClarifyAnswerChange={(idx, val) => { clarifyAnswersRef.current[idx] = val; }}
            onImageClarifySubmit={handleImageClarifySubmit}
            apiKey={apiKey}
            briefText={briefText}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800 bg-slate-900">
        <div className="max-w-3xl mx-auto">
          {pendingImages.length > 0 && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative">
                  <img src={img.dataUrl} alt={img.name} className="w-14 h-14 object-cover rounded-lg border border-slate-700" />
                  <button
                    onClick={() => handleRemovePendingImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
              <span className="text-[10px] text-slate-500">{pendingImages.length}/{MAX_REF_IMAGES}</span>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                handleImageFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={phase !== "brief" || pendingImages.length >= MAX_REF_IMAGES}
              title="Upload foto referensi (maks 5)"
              className="p-3 rounded-2xl bg-slate-950 border border-slate-700 text-slate-300 hover:border-purple-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-lg font-black leading-none w-11 h-11 flex items-center justify-center"
            >
              +
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={phase !== "brief" && phase !== "qa-custom" && phase !== "image-clarify" && phase !== "duration-custom"}
              placeholder={
                phase === "brief" && pendingImages.length > 0
                  ? "Tambahin konteks (opsional), lalu kirim..."
                  : phase === "brief"
                  ? "Contoh: kerja remote dari kafe, buat YouTube Shorts... (atau upload foto pakai +, atau tempel link video YouTube/IG/TikTok)"
                  : phase === "duration-custom"
                  ? "Total durasi dalam detik, kelipatan 10 (contoh: 20, 100, 120)..."
                  : phase === "qa-custom"
                  ? "Tulis jawabanmu sendiri..."
                  : phase === "image-clarify"
                  ? "Jawab pertanyaan di atas, lalu klik Lanjut"
                  : "Klik salah satu opsi di atas untuk lanjut"
              }
              inputMode={phase === "duration-custom" ? "numeric" : "text"}
              className="flex-1 text-sm p-3 rounded-2xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={
                (phase !== "brief" && phase !== "qa-custom" && phase !== "duration-custom") ||
                (phase === "brief" && pendingImages.length === 0 && !input.trim()) ||
                (phase === "qa-custom" && !input.trim()) ||
                (phase === "duration-custom" && !input.trim())
              }
              className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-40 text-white rounded-2xl shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Chat bubble renderer ───────────────────────────────────────────────────
function ChatBubble({
  msg,
  quality,
  setQuality,
  promptOnly,
  onDurationDefault,
  onDurationCustom,
  onPickConcept,
  onQAAnswer,
  onQASkip,
  onConfirmStoryboard,
  onGenerateScene,
  onGenerateAll,
  onSendToKlipAI,
  onImageChoiceStoryboard,
  onImageChoiceDirect,
  onConfirmImageStoryboard,
  onClarifyAnswerChange,
  onImageClarifySubmit,
  apiKey,
  briefText,
}: {
  msg: ChatMsg;
  quality: VeoQuality;
  setQuality: (q: VeoQuality) => void;
  promptOnly: boolean;
  onDurationDefault: (msgId: string) => void;
  onDurationCustom: (msgId: string) => void;
  onPickConcept: (c: Concept) => void;
  onQAAnswer: (msgId: string, key: string, value: string) => void;
  onQASkip: (msgId: string, key: string) => void;
  onConfirmStoryboard: (storyboard: StoryboardIndoData) => void;
  onGenerateScene: (msgId: string, sceneNumber: number) => void;
  onGenerateAll: (msgId: string) => void;
  onSendToKlipAI?: (projectData: any) => void | Promise<void>;
  onImageChoiceStoryboard: (msgId: string, image: UploadedRefImage) => void;
  onImageChoiceDirect: (msgId: string, images: UploadedRefImage[]) => void;
  onConfirmImageStoryboard: (storyboard: ImageStoryboardData) => void;
  onClarifyAnswerChange: (imageIndex: number, value: string) => void;
  onImageClarifySubmit: (msgId: string, questions: ClarifyingQuestion[]) => void;
  apiKey?: string;
  briefText: string;
}) {
  const isUser = msg.sender === "user";

  if (msg.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-purple-400 text-xs font-bold animate-pulse pl-1">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{msg.text}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`p-3 rounded-2xl max-w-[92%] text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-sm"
            : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm"
        }`}
      >
        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

        {msg.kind === "reference-analysis" && msg.referenceAnalysis && (
          <ReferenceAnalysisView data={msg.referenceAnalysis} onPickConcept={onPickConcept} />
        )}

        {msg.kind === "keywords-concepts" && (
          <div className="mt-3">
            <KeywordConceptPanel
              defaultConcepts={msg.concepts || []}
              keywords={msg.keywords || []}
              originalPrompt={briefText}
              apiKey={apiKey}
              onPickConcept={onPickConcept}
            />
          </div>
        )}

        {msg.kind === "duration-choice" && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              disabled={msg.answered}
              onClick={() => onDurationDefault(msg.id)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:border-purple-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Durasi default
            </button>
            <button
              disabled={msg.answered}
              onClick={() => onDurationCustom(msg.id)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-200 hover:border-purple-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Custom durasi per 10 detik (prompt saja)
            </button>
          </div>
        )}

        {msg.kind === "quick-replies" && msg.qaKey && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[...(msg.qaOptions || []), CUSTOM_OPTION].map((opt) => (
              <button
                key={opt}
                disabled={msg.answered}
                onClick={() => onQAAnswer(msg.id, msg.qaKey!, opt)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  opt === CUSTOM_OPTION
                    ? "border-dashed border-slate-600 bg-transparent text-slate-400 hover:border-purple-500 hover:text-white"
                    : "border-slate-700 bg-slate-950 text-slate-200 hover:border-purple-500 hover:text-white"
                }`}
              >
                {opt}
              </button>
            ))}
            <button
              disabled={msg.answered}
              onClick={() => onQASkip(msg.id, msg.qaKey!)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl text-slate-500 hover:text-white disabled:opacity-40"
            >
              Skip
            </button>
          </div>
        )}

        {msg.kind === "storyboard-id" && msg.storyboardIndo && (
          <StoryboardIndoTable data={msg.storyboardIndo} onConfirm={() => onConfirmStoryboard(msg.storyboardIndo!)} />
        )}

        {msg.kind === "storyboard" && msg.refinedData && (
          <StoryboardResult data={msg.refinedData} msgId={msg.id} quality={quality} setQuality={setQuality} promptOnly={promptOnly} onGenerateScene={onGenerateScene} onGenerateAll={onGenerateAll} onSendToKlipAI={onSendToKlipAI} />
        )}

        {msg.kind === "user-images" && msg.images && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.images.map((img) => (
              <img key={img.id} src={img.dataUrl} alt={img.name} className="w-16 h-16 object-cover rounded-lg border border-white/20" />
            ))}
          </div>
        )}

        {msg.kind === "image-choice" && msg.images && (
          <div className="mt-2.5 space-y-2">
            {msg.images.length > 1 ? (
              <>
                <p className="text-[10px] text-slate-400">Pilih 1 foto buat dijadikan storyboard:</p>
                <div className="flex flex-wrap gap-1.5">
                  {msg.images.map((img) => (
                    <button
                      key={img.id}
                      disabled={msg.answered}
                      onClick={() => onImageChoiceStoryboard(msg.id, img)}
                      className="disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <img src={img.dataUrl} alt={img.name} className="w-16 h-16 object-cover rounded-lg border border-slate-700 hover:border-purple-500 transition-all" />
                    </button>
                  ))}
                </div>
                <button
                  disabled={msg.answered}
                  onClick={() => onImageChoiceDirect(msg.id, msg.images!)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:border-purple-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Nggak usah, langsung generate {msg.images.length} klip apa adanya
                </button>
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  disabled={msg.answered}
                  onClick={() => onImageChoiceStoryboard(msg.id, msg.images![0])}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:border-purple-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ya, buatkan storyboard
                </button>
                <button
                  disabled={msg.answered}
                  onClick={() => onImageChoiceDirect(msg.id, msg.images!)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:border-purple-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Nggak usah, langsung generate
                </button>
              </div>
            )}
          </div>
        )}

        {msg.kind === "image-storyboard-grid" && msg.imageStoryboard && (
          <ImageStoryboardGrid data={msg.imageStoryboard} onConfirm={() => onConfirmImageStoryboard(msg.imageStoryboard!)} />
        )}

        {msg.kind === "image-clarify" && msg.clarifyingQuestions && (
          <div className="mt-2.5 space-y-2">
            {msg.clarifyingQuestions.map((q) => (
              <div key={q.imageIndex} className="space-y-1">
                <p className="text-xs text-slate-300">{q.question}</p>
                <input
                  type="text"
                  disabled={msg.answered}
                  onChange={(e) => onClarifyAnswerChange(q.imageIndex, e.target.value)}
                  placeholder="Jawabanmu (boleh dikosongkan)"
                  className="w-full text-xs p-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 outline-none disabled:opacity-50"
                />
              </div>
            ))}
            <button
              disabled={msg.answered}
              onClick={() => onImageClarifySubmit(msg.id, msg.clarifyingQuestions!)}
              className="text-xs font-black px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-40"
            >
              Lanjut →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 10 keyword pills act as filters/tabs — each one swaps the concept list
// below into 10 concepts specific to that keyword (not more keywords).
// Starts out showing the default concepts already generated from the whole
// brief; picking a keyword replaces that list, and picking a different
// keyword replaces it again.
function KeywordConceptPanel({
  defaultConcepts,
  keywords,
  originalPrompt,
  apiKey,
  onPickConcept,
}: {
  defaultConcepts: Concept[];
  keywords: string[];
  originalPrompt: string;
  apiKey?: string;
  onPickConcept: (c: Concept) => void;
}) {
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>(defaultConcepts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectKeyword(keyword: string) {
    if (selectedKeyword === keyword) return;
    setSelectedKeyword(keyword);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/video-ai/keyword-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, originalPrompt, apiKey }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || "Gagal menyusun konsep.");
      setConcepts(data.concepts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k) => (
            <button
              key={k}
              onClick={() => handleSelectKeyword(k)}
              disabled={loading}
              className={`text-[10px] px-2 py-1 rounded-full border transition-all disabled:opacity-50 ${
                selectedKeyword === k
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-500 hover:text-white"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-purple-400 text-xs font-bold animate-pulse pl-1">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Menyusun 10 konsep buat "{selectedKeyword}"...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {concepts.filter((c) => !c.isRareAngle).map((c) => (
            <ConceptCard key={c.id} concept={c} onClick={() => onPickConcept(c)} />
          ))}
          {concepts.some((c) => c.isRareAngle) && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Sudut Pandang Langka</p>
              {concepts.filter((c) => c.isRareAngle).map((c) => (
                <ConceptCard key={c.id} concept={c} onClick={() => onPickConcept(c)} rare />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConceptCard({ concept, onClick, rare }: { concept: Concept; onClick: () => void; rare?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all bg-slate-950/60 hover:border-purple-500 ${rare ? "border-amber-500/30" : "border-slate-700"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">{concept.angle}</span>
      </div>
      <p className="text-sm font-black text-white mt-1.5">{concept.title}</p>
      <p className="text-xs text-slate-400 mt-1">{concept.summary}</p>
      <p className="text-xs text-purple-300 italic mt-1.5">"{concept.hook}"</p>
    </button>
  );
}

function ReferenceAnalysisView({ data, onPickConcept }: { data: ReferenceAnalysis; onPickConcept: (c: Concept) => void }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const mainConcept = data.concepts[0];
  const otherConcepts = data.concepts.slice(1);

  function submitCustom() {
    const text = customText.trim();
    if (!text) return;
    onPickConcept({
      id: `custom_${Date.now()}`,
      title: "Versi Custom",
      angle: "Custom dari user",
      hook: "",
      summary: text,
      vibeTags: [],
      recommendedVoice: "Zephyr",
      recommendedBgm: "bsl1",
    });
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-64 overflow-y-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0">
            <tr className="bg-slate-900 text-slate-400">
              <th className="p-2 text-left font-black border-b border-slate-800">Waktu</th>
              <th className="p-2 text-left font-black border-b border-slate-800">Apa yang terjadi</th>
            </tr>
          </thead>
          <tbody>
            {data.timestamps.map((t, i) => (
              <tr key={i} className="border-b border-slate-800/60 align-top text-slate-300">
                <td className="p-2 whitespace-nowrap font-bold text-purple-300">{t.start}–{t.end}</td>
                <td className="p-2">{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.referenceProfile && (
        <div className="text-xs bg-purple-950/20 rounded-xl p-3 border border-purple-500/30 space-y-1">
          <p className="font-black text-purple-300 mb-1">🎬 Profil gaya video ini</p>
          <p><span className="font-bold text-purple-300">Gaya visual: </span>{data.referenceProfile.visualStyle}</p>
          <p><span className="font-bold text-purple-300">Environment: </span>{data.referenceProfile.environment}</p>
          <p><span className="font-bold text-purple-300">Konsep: </span>{data.referenceProfile.concept}</p>
          <p><span className="font-bold text-purple-300">Tone: </span>{data.referenceProfile.tone}</p>
        </div>
      )}

      <p className="text-xs font-bold text-slate-300">Mau dibuat serupa, atau versi lain?</p>

      {mainConcept && (
        <div className="space-y-2">
          <ConceptCard concept={mainConcept} onClick={() => onPickConcept(mainConcept)} />
        </div>
      )}
      {otherConcepts.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Versi Lain</p>
          {otherConcepts.map((c) => (
            <ConceptCard key={c.id} concept={c} onClick={() => onPickConcept(c)} rare />
          ))}
        </div>
      )}

      <div className="pt-1">
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-purple-500 hover:text-white transition-all"
          >
            ✍️ Custom, aku tulis versi sendiri
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Tulis versi remake yang kamu mau..."
              className="flex-1 text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 outline-none"
            />
            <button
              onClick={submitCustom}
              disabled={!customText.trim()}
              className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-40 text-white rounded-xl"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be blocked (insecure context, permissions) — fall
      // back to the old textarea+execCommand trick rather than doing nothing.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* give up silently */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      title="Salin prompt"
      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:border-purple-500 transition-all"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function CopyAllPromptsButton({ scenes }: { scenes: Scene[] }) {
  const [copied, setCopied] = useState(false);
  const combined = scenes
    .map((s) => `# Klip ${s.sceneNumber} (${s.duration || 10}s)\n${s.visualPrompt}`)
    .join("\n\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(combined);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = combined;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* give up silently */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 hover:bg-amber-500/30 transition-all"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Tersalin!" : "Salin semua prompt"}
    </button>
  );
}

function ImageStoryboardGrid({ data, onConfirm }: { data: ImageStoryboardData; onConfirm: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const okShots = data.shots.filter((s) => s.imageUrl);

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-black text-white">{data.videoTitle}</p>
      {data.consistencyProfile?.subject && (
        <div className="text-xs bg-purple-950/20 rounded-xl p-3 border border-purple-500/30">
          <span className="font-black text-purple-300">🎯 Subjek konsisten: </span>{data.consistencyProfile.subject}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {data.shots.map((shot) => (
          <div key={shot.shotNumber} className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            {shot.imageUrl ? (
              <img src={shot.imageUrl} alt={`Shot ${shot.shotNumber}`} className="w-full aspect-[3/4] object-cover" />
            ) : (
              <div className="w-full aspect-[3/4] flex items-center justify-center text-[10px] text-red-400 p-2 text-center">{shot.error || "Gagal generate"}</div>
            )}
            <div className="p-2 space-y-0.5">
              <p className="text-[10px] font-black text-purple-300">Shot {shot.shotNumber} · {shot.shotType}</p>
              <p className="text-[10px] text-slate-400">Aksi: {shot.action}</p>
              <p className="text-[10px] text-slate-500">{shot.cameraAngle} · {shot.lighting} · {shot.mood}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => { setConfirmed(true); onConfirm(); }}
        disabled={confirmed || okShots.length === 0}
        className="w-full text-xs font-black px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-50"
      >
        {confirmed ? "Lagi nulis naskah..." : `✅ Lanjut ke Video (${okShots.length} klip) →`}
      </button>
    </div>
  );
}

function StoryboardIndoTable({ data, onConfirm }: { data: StoryboardIndoData; onConfirm: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const profile = data.consistencyProfile;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-black text-white">{data.videoTitle}</p>

      {data.concept30s && (
        <div className="space-y-1.5 text-xs bg-slate-950/60 rounded-xl p-3 border border-slate-800">
          <p><span className="font-black text-pink-400">Masalah (3 detik pertama): </span>{data.concept30s.problemHook}</p>
          <p><span className="font-black text-pink-400">Titik balik: </span>{data.concept30s.turningPoint}</p>
          <p><span className="font-black text-pink-400">Perasaan yang dibawa pulang: </span>{data.concept30s.takeawayFeeling}</p>
        </div>
      )}

      {profile && (profile.character || profile.visualStyle || profile.environment) && (
        <div className="text-xs bg-purple-950/20 rounded-xl p-3 border border-purple-500/30 space-y-1">
          <p className="font-black text-purple-300 mb-1">🔒 Konsisten di semua klip</p>
          {profile.character && <p><span className="font-bold text-purple-300">Karakter: </span>{profile.character}</p>}
          {profile.environment && <p><span className="font-bold text-purple-300">Lokasi: </span>{profile.environment}</p>}
          {profile.visualStyle && <p><span className="font-bold text-purple-300">Gaya visual: </span>{profile.visualStyle}</p>}
          {profile.lighting && <p><span className="font-bold text-purple-300">Pencahayaan: </span>{profile.lighting}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-slate-900 text-slate-400">
              <th className="p-2 text-left font-black border-b border-slate-800">No</th>
              <th className="p-2 text-left font-black border-b border-slate-800">Detik</th>
              <th className="p-2 text-left font-black border-b border-slate-800">Apa yang terlihat</th>
              <th className="p-2 text-left font-black border-b border-slate-800">Narasi/dialog</th>
              <th className="p-2 text-left font-black border-b border-slate-800">Emosi</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 align-top text-slate-300">
                <td className="p-2 font-bold text-purple-300">{r.id}</td>
                <td className="p-2 whitespace-nowrap text-slate-400">{r.startSec}–{r.endSec}</td>
                <td className="p-2 italic">{r.visual}</td>
                <td className="p-2">{r.narration}</td>
                <td className="p-2 text-slate-400">{r.emotion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => {
          setConfirmed(true);
          onConfirm();
        }}
        disabled={confirmed}
        className="w-full text-xs font-black px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-50"
      >
        {confirmed ? "Lagi bikin prompt video..." : "✅ Lanjut: Buat Prompt Video Bahasa Inggris →"}
      </button>
    </div>
  );
}

function StoryboardResult({
  data,
  msgId,
  quality,
  setQuality,
  promptOnly,
  onGenerateScene,
  onGenerateAll,
  onSendToKlipAI,
}: {
  data: RefinedData;
  msgId: string;
  quality: VeoQuality;
  setQuality: (q: VeoQuality) => void;
  promptOnly: boolean;
  onGenerateScene: (msgId: string, sceneNumber: number) => void;
  onGenerateAll: (msgId: string) => void;
  onSendToKlipAI?: (projectData: any) => void | Promise<void>;
}) {
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const totalCost = data.scenes.reduce((acc, s) => acc + (s.duration || 8), 0) * QUALITY_PRICE_PER_SEC[quality];
  const doneCount = data.scenes.filter((s) => s.veoStatus === "done" && s.videoUrl).length;
  const pendingScenes = data.scenes.filter((s) => !s.veoStatus);
  const pendingCount = pendingScenes.length;
  const pendingCost = pendingScenes.reduce((acc, s) => acc + (s.duration || 8), 0) * QUALITY_PRICE_PER_SEC[quality];
  const allDone = data.scenes.length > 0 && doneCount === data.scenes.length;

  async function handleMergeAll() {
    setIsMerging(true);
    setMergeError(null);
    try {
      const jobIds = data.scenes
        .slice()
        .sort((a, b) => a.sceneNumber - b.sceneNumber)
        .map((s) => s.veoJobId)
        .filter((id): id is string => !!id);
      const res = await fetch("/api/video-ai/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) throw new Error(resData.error || "Gagal menggabungkan video.");
      setMergedUrl(resData.videoUrl);
    } catch (err: any) {
      setMergeError(err.message);
    } finally {
      setIsMerging(false);
    }
  }

  async function handleSend() {
    if (!onSendToKlipAI) return;
    setIsSending(true);
    try {
      await onSendToKlipAI({
        fullScript: data.scenes.map((s) => s.voiceoverText).filter(Boolean).join(" "),
        voice: data.voice,
        bgmId: data.bgmId,
        scenes: data.scenes,
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-black text-white">{data.videoTitle}</p>

      {data.concept30s && (
        <div className="space-y-1.5 text-xs bg-slate-950/60 rounded-xl p-3 border border-slate-800">
          <p><span className="font-black text-pink-400">Masalah (3 detik pertama): </span>{data.concept30s.problemHook}</p>
          <p><span className="font-black text-pink-400">Titik balik: </span>{data.concept30s.turningPoint}</p>
          <p><span className="font-black text-pink-400">Perasaan yang dibawa pulang: </span>{data.concept30s.takeawayFeeling}</p>
        </div>
      )}

      {data.characterDescription && (
        <div className="text-xs bg-purple-950/20 rounded-xl p-3 border border-purple-500/30">
          <span className="font-black text-purple-300">🧑 Karakter: </span>{data.characterDescription}
        </div>
      )}

      {promptOnly && (
        <div className="text-xs bg-amber-500/10 rounded-xl p-3 border border-amber-500/30 text-amber-200 space-y-1">
          <p className="font-black">📝 Mode prompt-only — {data.scenes.length} klip @ 10 detik</p>
          <p className="text-amber-200/80">Output final: prompt Bahasa Inggris per klip. Tidak ada generate video, edit, atau download di mode ini.</p>
          <CopyAllPromptsButton scenes={data.scenes} />
        </div>
      )}

      {!promptOnly && pendingCount > 0 && (
        <button
          onClick={async () => {
            setIsGeneratingAll(true);
            try {
              await onGenerateAll(msgId);
            } finally {
              setIsGeneratingAll(false);
            }
          }}
          disabled={isGeneratingAll}
          className="w-full text-xs font-black px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isGeneratingAll ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Memulai klip satu-satu (~{Math.ceil((pendingCount * 32) / 60)} menit)...</span>
            </>
          ) : (
            <span>🎬✨ Generate Semua Klip ({pendingCount}) — ${pendingCost.toFixed(2)}</span>
          )}
        </button>
      )}
      {!promptOnly && pendingCount > 1 && (
        <p className="text-[10px] text-slate-500 -mt-1.5">
          Klip dimulai satu-satu dengan jeda ~30 detik (batas rate-limit Google untuk Veo), bukan langsung bareng — supaya nggak kena error 429.
        </p>
      )}

      <div className="space-y-2">
        {data.scenes.map((sc) => (
          <div key={sc.sceneNumber} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-300">Klip {sc.sceneNumber} — {sc.duration}s</span>
            </div>
            {!promptOnly && sc.voiceoverText && <p className="text-xs text-slate-400">{sc.voiceoverText}</p>}
            <div className="relative">
              <pre className="text-[10px] text-slate-300 whitespace-pre-wrap bg-slate-900 p-2 pr-8 rounded-lg border border-slate-800 font-mono">{sc.visualPrompt}</pre>
              <CopyPromptButton text={sc.visualPrompt} />
            </div>

            {!promptOnly && (!sc.veoStatus) && (
              <button
                onClick={() => onGenerateScene(msgId, sc.sceneNumber)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black"
              >
                🎬 Generate Video (${(sc.duration * QUALITY_PRICE_PER_SEC[quality]).toFixed(2)})
              </button>
            )}
            {!promptOnly && sc.veoStatus === "generating" && (
              <p className="text-xs text-indigo-400 font-bold animate-pulse">Generating... bisa sampai beberapa menit.</p>
            )}
            {!promptOnly && sc.veoStatus === "error" && (
              <div className="space-y-1.5">
                <p className="text-xs text-red-400 font-bold">{sc.veoError}</p>
                <button onClick={() => onGenerateScene(msgId, sc.sceneNumber)} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300">Coba lagi</button>
              </div>
            )}
            {!promptOnly && sc.veoStatus === "done" && sc.videoUrl && (
              <div className="space-y-1.5">
                <video src={sc.videoUrl} controls className="w-full rounded-lg max-h-72 bg-black" />
                <a href={sc.videoUrl} download className="text-xs font-bold text-purple-400">⬇ Download</a>
              </div>
            )}
          </div>
        ))}
      </div>

      {!promptOnly && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-slate-400">Kualitas:</label>
            <select value={quality} onChange={(e) => setQuality(e.target.value as VeoQuality)} className="text-[10px] font-bold rounded-lg bg-slate-950 border border-slate-700 px-1.5 py-1">
              {(Object.keys(QUALITY_LABELS) as VeoQuality[]).map((q) => (
                <option key={q} value={q}>{QUALITY_LABELS[q]}</option>
              ))}
            </select>
          </div>
          <span className="text-[10px] text-slate-500">Total kalau generate semua: <strong className="text-amber-400">${totalCost.toFixed(2)}</strong></span>
        </div>
      )}

      {!promptOnly && allDone && (
        <div className="pt-1 border-t border-slate-800 space-y-2">
          {mergedUrl ? (
            <div className="space-y-1.5">
              <video src={mergedUrl} controls className="w-full rounded-lg max-h-80 bg-black" />
              <a href={mergedUrl} download className="inline-block text-xs font-bold text-purple-400">⬇ Download Video Gabungan (MP4)</a>
            </div>
          ) : (
            <button
              onClick={handleMergeAll}
              disabled={isMerging}
              className="w-full mt-3 text-xs font-black px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isMerging ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menggabungkan semua klip...</span>
                </>
              ) : (
                <span>🎞️ Gabungkan & Download Video Utuh ({data.scenes.length} klip)</span>
              )}
            </button>
          )}
          {mergeError && <p className="text-xs text-red-400 font-bold">{mergeError}</p>}
        </div>
      )}

      {!promptOnly && onSendToKlipAI && (
        <div className="pt-1 border-t border-slate-800">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="w-full mt-3 text-xs font-black px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Menyiapkan klip...</span>
              </>
            ) : (
              <span>➡️ Satukan di Klip AI Studio Workspace {doneCount > 0 ? `(${doneCount}/${data.scenes.length} video siap)` : "(pakai preview dulu)"}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
