"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Check, RefreshCw, Sparkles } from "lucide-react";
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
  kind: "text" | "loading" | "keywords-concepts" | "quick-replies" | "storyboard-id" | "storyboard" | "scenes-generate";
  text?: string;
  keywords?: string[];
  concepts?: Concept[];
  qaKey?: string;
  qaOptions?: string[];
  answered?: boolean;
  storyboardIndo?: StoryboardIndoData;
  refinedData?: RefinedData;
}

let idCounter = 0;
const nextId = () => `m${++idCounter}_${Date.now()}`;

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
  const [phase, setPhase] = useState<"brief" | "concepts" | "qa" | "qa-custom" | "storyboard" | "done">("brief");
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
        targetDuration: 30,
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
        apiKey,
      });
      removeMsg(loadingId);
      pushMsg({ sender: "ai", kind: "storyboard", refinedData: data.refinedData, text: "Nih hasilnya! Prompt video Bahasa Inggris siap generate, konsisten karakter & gaya visualnya di semua klip." });
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
      pollScene(msgId, sceneNumber, jobId);
    } catch (err: any) {
      patchScene(msgId, sceneNumber, { veoStatus: "error", veoError: err.message });
    }
  }

  async function handleGenerateAllScenes(msgId: string) {
    const msg = messages.find((m) => m.id === msgId);
    const pending = (msg?.refinedData?.scenes || []).filter((s) => !s.veoStatus);
    for (const sc of pending) {
      handleGenerateScene(msgId, sc.sceneNumber);
      // Small stagger so the burst of requests doesn't hit the API all at once.
      await new Promise((resolve) => setTimeout(resolve, 400));
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
          patchScene(msgId, sceneNumber, { veoStatus: data.status, videoUrl: data.videoUrl || null, veoError: data.error || null });
        }
      } catch (err: any) {
        clearInterval(interval);
        patchScene(msgId, sceneNumber, { veoStatus: "error", veoError: err.message });
      }
    }, 6000);
  }

  function handleSend() {
    if (phase === "brief") handleSendBrief();
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
            onPickConcept={handlePickConcept}
            onQAAnswer={handleQAAnswer}
            onQASkip={handleQASkip}
            onConfirmStoryboard={handleConfirmStoryboard}
            onGenerateScene={handleGenerateScene}
            onGenerateAll={handleGenerateAllScenes}
            onSendToKlipAI={onSendToKlipAI}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800 bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 max-w-3xl mx-auto"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={phase !== "brief" && phase !== "qa-custom"}
            placeholder={
              phase === "brief"
                ? "Contoh: kerja remote dari kafe, buat YouTube Shorts, target pekerja muda 22-30 tahun..."
                : phase === "qa-custom"
                ? "Tulis jawabanmu sendiri..."
                : "Klik salah satu opsi di atas untuk lanjut"
            }
            className="flex-1 text-sm p-3 rounded-2xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={(phase !== "brief" && phase !== "qa-custom") || !input.trim()}
            className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-40 text-white rounded-2xl shadow"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Chat bubble renderer ───────────────────────────────────────────────────
function ChatBubble({
  msg,
  quality,
  setQuality,
  onPickConcept,
  onQAAnswer,
  onQASkip,
  onConfirmStoryboard,
  onGenerateScene,
  onGenerateAll,
  onSendToKlipAI,
}: {
  msg: ChatMsg;
  quality: VeoQuality;
  setQuality: (q: VeoQuality) => void;
  onPickConcept: (c: Concept) => void;
  onQAAnswer: (msgId: string, key: string, value: string) => void;
  onQASkip: (msgId: string, key: string) => void;
  onConfirmStoryboard: (storyboard: StoryboardIndoData) => void;
  onGenerateScene: (msgId: string, sceneNumber: number) => void;
  onGenerateAll: (msgId: string) => void;
  onSendToKlipAI?: (projectData: any) => void | Promise<void>;
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

        {msg.kind === "keywords-concepts" && (
          <div className="mt-3 space-y-3">
            {msg.keywords && msg.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {msg.keywords.map((k, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">{k}</span>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {(msg.concepts || []).filter((c) => !c.isRareAngle).map((c) => (
                <ConceptCard key={c.id} concept={c} onClick={() => onPickConcept(c)} />
              ))}
            </div>
            {(msg.concepts || []).some((c) => c.isRareAngle) && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Sudut Pandang Langka</p>
                {(msg.concepts || []).filter((c) => c.isRareAngle).map((c) => (
                  <ConceptCard key={c.id} concept={c} onClick={() => onPickConcept(c)} rare />
                ))}
              </div>
            )}
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
          <StoryboardResult data={msg.refinedData} msgId={msg.id} quality={quality} setQuality={setQuality} onGenerateScene={onGenerateScene} onGenerateAll={onGenerateAll} onSendToKlipAI={onSendToKlipAI} />
        )}
      </div>
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
  onGenerateScene,
  onGenerateAll,
  onSendToKlipAI,
}: {
  data: RefinedData;
  msgId: string;
  quality: VeoQuality;
  setQuality: (q: VeoQuality) => void;
  onGenerateScene: (msgId: string, sceneNumber: number) => void;
  onGenerateAll: (msgId: string) => void;
  onSendToKlipAI?: (projectData: any) => void | Promise<void>;
}) {
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const totalCost = data.scenes.reduce((acc, s) => acc + (s.duration || 8), 0) * QUALITY_PRICE_PER_SEC[quality];
  const doneCount = data.scenes.filter((s) => s.veoStatus === "done" && s.videoUrl).length;
  const pendingScenes = data.scenes.filter((s) => !s.veoStatus);
  const pendingCount = pendingScenes.length;
  const pendingCost = pendingScenes.reduce((acc, s) => acc + (s.duration || 8), 0) * QUALITY_PRICE_PER_SEC[quality];

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

      {pendingCount > 0 && (
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
              <span>Memulai semua klip...</span>
            </>
          ) : (
            <span>🎬✨ Generate Semua Klip ({pendingCount}) — ${pendingCost.toFixed(2)}</span>
          )}
        </button>
      )}

      <div className="space-y-2">
        {data.scenes.map((sc) => (
          <div key={sc.sceneNumber} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-300">Klip {sc.sceneNumber} — {sc.duration}s</span>
            </div>
            <p className="text-xs text-slate-400">{sc.voiceoverText}</p>
            <pre className="text-[10px] text-slate-300 whitespace-pre-wrap bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono">{sc.visualPrompt}</pre>

            {(!sc.veoStatus) && (
              <button
                onClick={() => onGenerateScene(msgId, sc.sceneNumber)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black"
              >
                🎬 Generate Video (${(sc.duration * QUALITY_PRICE_PER_SEC[quality]).toFixed(2)})
              </button>
            )}
            {sc.veoStatus === "generating" && (
              <p className="text-xs text-indigo-400 font-bold animate-pulse">Generating... bisa sampai beberapa menit.</p>
            )}
            {sc.veoStatus === "error" && (
              <div className="space-y-1.5">
                <p className="text-xs text-red-400 font-bold">{sc.veoError}</p>
                <button onClick={() => onGenerateScene(msgId, sc.sceneNumber)} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300">Coba lagi</button>
              </div>
            )}
            {sc.veoStatus === "done" && sc.videoUrl && (
              <div className="space-y-1.5">
                <video src={sc.videoUrl} controls className="w-full rounded-lg max-h-72 bg-black" />
                <a href={sc.videoUrl} download className="text-xs font-bold text-purple-400">⬇ Download</a>
              </div>
            )}
          </div>
        ))}
      </div>

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

      {onSendToKlipAI && (
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
