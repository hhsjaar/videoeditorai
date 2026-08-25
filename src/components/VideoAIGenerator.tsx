"use client";

import React, { useState, useRef, useEffect } from "react";
import { QUALITY_PRICE_PER_SEC, QUALITY_LABELS, type VeoQuality } from "@/lib/veoPricing";
import {
  Sparkles,
  Wand2,
  Play,
  Pause,
  RotateCcw,
  Download,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Film,
  Music,
  Mic,
  Eye,
  CheckCircle2,
  Layers,
  ArrowRight,
  RefreshCw,
  Edit3,
  Copy,
  Check,
  Zap,
  Volume2,
  VolumeX,
  Clock,
  LayoutGrid,
  Video as VideoIcon,
  Palette,
  AlertCircle,
  HelpCircle,
  Send,
} from "lucide-react";

export interface VideoAIConcept {
  id: string;
  title: string;
  angle: string;
  hook: string;
  summary: string;
  targetAudience: string;
  vibeTags: string[];
  recommendedVoice: string;
  recommendedBgm: string;
  visualStyle: string;
  previewScript: string;
  isRareAngle?: boolean;
}

export interface VideoAIScene {
  sceneNumber: number;
  duration: number;
  visualPrompt: string;
  voiceoverText: string;
  cameraMotion: string;
  transition: string;
  overlayTitle?: string;
  visualUrl?: string;
  veoJobId?: string | null;
  veoStatus?: "generating" | "done" | "error" | "skipped";
  veoError?: string | null;
  videoUrl?: string | null;
}

export interface RefinedVideoData {
  videoTitle: string;
  summary: string;
  characterDescription?: string;
  aspectRatio: string;
  stylePreset: string;
  voice: string;
  bgmId: string;
  totalDuration: number;
  scenes: VideoAIScene[];
}

interface VideoAIGeneratorProps {
  apiKey?: string;
  onSendToKlipAI?: (projectData: any) => void;
}

const INSPIRATION_PROMPTS = [
  "☕ Video promosi kafe estetik kekinian di Bandung dengan nuansa hangat",
  "📱 Review gadget smartphone AI masa kini dengan fitur kamera canggih",
  "🚀 3 Rahasia sukses memulai bisnis digital untuk pemula di tahun ini",
  "🏖️ Rekomendasi wisata hidden gem di Bali yang wajib dikunjungi",
  "🧠 Fakta unik sains: Kenapa langit berwarna biru saat siang hari?",
  "🥗 Resep makanan sehat dan lezat dalam waktu kurang dari 5 menit",
];

const PRESET_STYLES = [
  { id: "cinematic", name: "🎬 Cinematic Film", desc: "8k, warm lighting, anamorphic lens" },
  { id: "3d-render", name: "✨ 3D Pixar Animation", desc: "Vibrant stylized 3D render, soft glow" },
  { id: "cyberpunk", name: "🌃 Cyberpunk Neon", desc: "Futuristic dark mode, neon teal & magenta" },
  { id: "minimalist", name: "⚪ Minimalist Studio", desc: "Clean macro aesthetics, natural daylight" },
  { id: "anime", name: "🌸 Anime Makoto Shinkai", desc: "Lush skies, painterly light rays, vibrant" },
];

const VOICE_OPTIONS = [
  { id: "Zephyr", name: "Zephyr (Pria Warm & Energetik)", desc: "Warm & confident" },
  { id: "Puck", name: "Puck (Wanita Soft & Lembut)", desc: "Soft & calm" },
  { id: "Kore", name: "Kore (Wanita Berwibawa)", desc: "Professional & clear" },
  { id: "Fenrir", name: "Fenrir (Pria Sinematik Deep)", desc: "Deep & cinematic" },
  { id: "Aoede", name: "Aoede (Wanita Ceria Commercial)", desc: "Fresh & enthusiastic" },
  { id: "Charon", name: "Charon (Pria Santai Vlog)", desc: "Casual & friendly" },
];

const BGM_OPTIONS = [
  { id: "bsl1", title: "🎵 Chill & Aesthetic Lounge", url: "/bgm/bsl1.mp3" },
  { id: "bsl2", title: "🎵 Upbeat Commercial Groove", url: "/bgm/bsl2.mp3" },
  { id: "bsl3", title: "🎵 Minimalist Coffee Acoustic", url: "/bgm/bsl3.mp3" },
  { id: "bsl4", title: "🎵 Luxury & Gourmet Cinematic", url: "/bgm/bsl4.mp3" },
  { id: "bsl5", title: "🎵 Modern Vlog Beat", url: "/bgm/bsl5.mp3" },
];

const ConceptCard: React.FC<{
  concept: VideoAIConcept;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ concept, index, isSelected, onSelect }) => (
  <div
    onClick={onSelect}
    className={`group relative cursor-pointer rounded-3xl border p-6 transition-all duration-200 flex flex-col justify-between ${
      isSelected
        ? "border-purple-500 bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-900 shadow-2xl shadow-purple-500/20 ring-2 ring-purple-500/40"
        : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90"
    }`}
  >
    <div className="space-y-4">
      {/* Badge Top */}
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-purple-500/20 px-3 py-1 text-[11px] font-extrabold text-purple-300 border border-purple-500/30">
          {concept.angle || `Konsep #${index + 1}`}
        </span>
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
            isSelected
              ? "border-purple-500 bg-purple-600 text-white"
              : "border-slate-700 bg-slate-800 text-transparent"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-black text-white group-hover:text-purple-200 transition-colors">
        {concept.title}
      </h3>

      {/* Hook Preview */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-1">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-pink-400">
          🎯 Hook 3 Detik Pertama:
        </div>
        <p className="text-slate-200 italic font-medium">
          "{concept.hook}"
        </p>
      </div>

      {/* Summary */}
      <p className="text-xs text-slate-400 leading-relaxed">
        {concept.summary}
      </p>

      {/* Vibe Tags */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(concept.vibeTags || []).map((tag, tIdx) => (
          <span
            key={tIdx}
            className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>

    {/* Metadata Footer */}
    <div className="mt-6 border-t border-slate-800/80 pt-4 space-y-2 text-[11px] text-slate-400">
      <div className="flex items-center justify-between">
        <span>🎙️ Suara:</span>
        <span className="font-bold text-slate-200">
          {concept.recommendedVoice || "Zephyr"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>🎵 Backsound:</span>
        <span className="font-bold text-slate-200">
          {concept.recommendedBgm || "Track 1"}
        </span>
      </div>
    </div>
  </div>
);

export const VideoAIGenerator: React.FC<VideoAIGeneratorProps> = ({
  apiKey,
  onSendToKlipAI,
}) => {
  // Wizard steps: 1: Prompt -> 2: Choose Concept -> 3: Refine Scenes -> 4: Output Studio
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 State
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [targetDuration, setTargetDuration] = useState(30);
  const [tone, setTone] = useState("kreatif");

  // Step 2 State (Concepts generated by Gemini)
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [concepts, setConcepts] = useState<VideoAIConcept[]>([]);
  const [conceptKeywords, setConceptKeywords] = useState<string[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string>("");
  const [conceptError, setConceptError] = useState<string | null>(null);

  // Step 3 State (Refined Scenes)
  const [isRefiningScenes, setIsRefiningScenes] = useState(false);
  const [refinedData, setRefinedData] = useState<RefinedVideoData | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("cinematic");
  const [selectedVoice, setSelectedVoice] = useState("Zephyr");
  const [selectedBgm, setSelectedBgm] = useState("bsl1");
  const [refineError, setRefineError] = useState<string | null>(null);

  // Step 4 State (Generated Video Result & Player)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedVideoResult, setGeneratedVideoResult] = useState<any | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [veoQuality, setVeoQuality] = useState<VeoQuality>("lite");

  // Audio Playback
  const [isGeneratingVO, setIsGeneratingVO] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto step timer for preview playback
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && generatedVideoResult?.scenes?.length) {
      interval = setInterval(() => {
        setPlayProgress((prev) => {
          const totalDur = generatedVideoResult.scenes.reduce(
            (s: number, sc: any) => s + (sc.duration || 5),
            0
          );
          if (prev >= totalDur) {
            setIsPlaying(false);
            return 0;
          }
          const nextVal = prev + 0.1;
          // Calculate active scene
          let accum = 0;
          for (let i = 0; i < generatedVideoResult.scenes.length; i++) {
            accum += generatedVideoResult.scenes[i].duration || 5;
            if (nextVal <= accum) {
              setActiveSceneIndex(i);
              break;
            }
          }
          return nextVal;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, generatedVideoResult]);

  // Handler: Generate Concepts from Prompt (Step 1 -> 2)
  const handleGenerateConcepts = async () => {
    if (!prompt.trim()) return;
    setIsGeneratingConcepts(true);
    setConceptError(null);

    try {
      const res = await fetch("/api/video-ai/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          targetDuration,
          tone,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat konsep video dari Gemini.");
      }

      setConcepts(data.concepts);
      setConceptKeywords(data.keywords || []);
      if (data.concepts.length > 0) {
        setSelectedConceptId(data.concepts[0].id);
        setSelectedVoice(data.concepts[0].recommendedVoice || "Zephyr");
        setSelectedBgm(data.concepts[0].recommendedBgm || "bsl1");
      }
      setCurrentStep(2);
    } catch (err: any) {
      setConceptError(err.message || "Terjadi kesalahan saat menghubungi Gemini.");
    } finally {
      setIsGeneratingConcepts(false);
    }
  };

  // Handler: Refine Concept into Scenes (Step 2 -> 3)
  const handleRefineConcept = async () => {
    const chosenConcept = concepts.find((c) => c.id === selectedConceptId) || concepts[0];
    if (!chosenConcept) return;

    setIsRefiningScenes(true);
    setRefineError(null);

    try {
      const res = await fetch("/api/video-ai/refine-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: chosenConcept,
          userPrompt: prompt,
          customInstructions,
          aspectRatio,
          stylePreset: selectedStyle,
          voice: selectedVoice,
          bgmId: selectedBgm,
          targetDuration,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengolah adegan video.");
      }

      setRefinedData(data.refinedData);
      setCurrentStep(3);
    } catch (err: any) {
      setRefineError(err.message || "Terjadi kesalahan saat mengolah adegan.");
    } finally {
      setIsRefiningScenes(false);
    }
  };

  // Handler: Generate Video from Gemini (Step 3 -> 4)
  const handleGenerateFinalVideo = async () => {
    if (!refinedData) return;

    setIsGeneratingVideo(true);
    setGenerationProgress(15);

    try {
      const progressTimer = setInterval(() => {
        setGenerationProgress((p) => (p < 85 ? p + Math.floor(Math.random() * 15) + 5 : p));
      }, 700);

      const res = await fetch("/api/video-ai/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refinedData,
          generationMode: "veo-video",
          quality: veoQuality,
          apiKey,
        }),
      });

      clearInterval(progressTimer);
      setGenerationProgress(100);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat video AI.");
      }

      setGeneratedVideoResult(data.data);
      setCurrentStep(4);
      setActiveSceneIndex(0);
      setPlayProgress(0);

      // Scenes come back with veoJobId + veoStatus:"generating" — each scene's
      // real Veo video is still in flight server-side. Poll every scene until done.
      (data.data.scenes || []).forEach((scene: VideoAIScene) => {
        if (scene.veoJobId && scene.veoStatus === "generating") {
          pollVeoScene(scene.sceneNumber, scene.veoJobId);
        }
      });
    } catch (err: any) {
      alert("Error generate video: " + (err.message || "Gagal memproses video"));
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Poll one scene's Veo job until it's done/errored, then patch it into generatedVideoResult.
  const pollVeoScene = (sceneNumber: number, jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video-ai/status/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal cek status video.");

        if (data.status === "done" || data.status === "error") {
          clearInterval(interval);
          setGeneratedVideoResult((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              scenes: prev.scenes.map((s: VideoAIScene) =>
                s.sceneNumber === sceneNumber
                  ? { ...s, veoStatus: data.status, videoUrl: data.videoUrl || null, veoError: data.error || null }
                  : s
              ),
            };
          });
        }
      } catch (err: any) {
        clearInterval(interval);
        setGeneratedVideoResult((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            scenes: prev.scenes.map((s: VideoAIScene) =>
              s.sceneNumber === sceneNumber ? { ...s, veoStatus: "error", veoError: err.message } : s
            ),
          };
        });
      }
    }, 6000);
  };

  // Scene editor changes in Step 3
  const handleUpdateScene = (index: number, field: keyof VideoAIScene, value: any) => {
    if (!refinedData) return;
    const updatedScenes = [...refinedData.scenes];
    updatedScenes[index] = { ...updatedScenes[index], [field]: value };
    setRefinedData({ ...refinedData, scenes: updatedScenes });
  };

  // Generate Voice Over Audio for Final Result
  const handleGenerateVoiceOver = async () => {
    if (!generatedVideoResult?.fullScript) return;
    setIsGeneratingVO(true);

    try {
      const res = await fetch("/api/generate-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: generatedVideoResult.fullScript,
          voice: generatedVideoResult.voice || selectedVoice,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.audioUrl) {
        throw new Error(data.error || "Gagal membuat voice over");
      }

      setAudioUrl(data.audioUrl);
    } catch (err: any) {
      console.error("VO error:", err);
    } finally {
      setIsGeneratingVO(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Wizard Steps Header */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-xl shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Step 1 */}
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                currentStep === 1
                  ? "bg-purple-600/20 border border-purple-500/50 text-white"
                  : currentStep > 1
                  ? "bg-slate-800/60 text-purple-300 hover:bg-slate-800"
                  : "text-slate-500 opacity-60"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                  currentStep === 1
                    ? "bg-purple-600 text-white"
                    : currentStep > 1
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">1. Ide & Prompt</p>
                <p className="text-[10px] text-slate-400 truncate">Masukkan ide video</p>
              </div>
            </button>

            {/* Step 2 */}
            <button
              onClick={() => concepts.length > 0 && setCurrentStep(2)}
              disabled={concepts.length === 0}
              className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                currentStep === 2
                  ? "bg-purple-600/20 border border-purple-500/50 text-white"
                  : currentStep > 2
                  ? "bg-slate-800/60 text-purple-300 hover:bg-slate-800"
                  : "text-slate-500 opacity-60"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                  currentStep === 2
                    ? "bg-purple-600 text-white"
                    : currentStep > 2
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {currentStep > 2 ? <Check className="h-4 w-4" /> : "2"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">2. Pilihan Konsep</p>
                <p className="text-[10px] text-slate-400 truncate">3 Opsi Kreatif Gemini</p>
              </div>
            </button>

            {/* Step 3 */}
            <button
              onClick={() => refinedData && setCurrentStep(3)}
              disabled={!refinedData}
              className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                currentStep === 3
                  ? "bg-purple-600/20 border border-purple-500/50 text-white"
                  : currentStep > 3
                  ? "bg-slate-800/60 text-purple-300 hover:bg-slate-800"
                  : "text-slate-500 opacity-60"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                  currentStep === 3
                    ? "bg-purple-600 text-white"
                    : currentStep > 3
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {currentStep > 3 ? <Check className="h-4 w-4" /> : "3"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">3. Olah Adegan</p>
                <p className="text-[10px] text-slate-400 truncate">Breakdown Script & Scene</p>
              </div>
            </button>

            {/* Step 4 */}
            <button
              onClick={() => generatedVideoResult && setCurrentStep(4)}
              disabled={!generatedVideoResult}
              className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                currentStep === 4
                  ? "bg-purple-600/20 border border-purple-500/50 text-white"
                  : "text-slate-500 opacity-60"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                  currentStep === 4 ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                4
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">4. Video Studio</p>
                <p className="text-[10px] text-slate-400 truncate">Play & Export</p>
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* STEP 1: PROMPT & IDEATION                                */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>LANGKAH 1: PROMPTING IDE VIDEO</span>
                </div>
                <h2 className="text-2xl font-black text-white sm:text-3xl">
                  Mau Bikin Video Seperti Apa Hari Ini?
                </h2>
                <p className="text-sm text-slate-400">
                  Tuliskan ide, topik, atau tujuan video Anda. AI Gemini akan langsung merancang 3 opsi konsep kreatif siap pilih.
                </p>
              </div>

              {/* Inspiration Chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">
                  💡 Inspirasi Topik Populer:
                </label>
                <div className="flex flex-wrap gap-2">
                  {INSPIRATION_PROMPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(sample)}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-white transition-all text-left"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Prompt Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  Deskripsi Ide Video Anda:
                </label>
                <div className="relative">
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Contoh: Buatkan video promosi menu signature kopi gula aren untuk kafe di Bandung, target anak muda, gaya sinematik dan estetik..."
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                  {prompt && (
                    <button
                      onClick={() => setPrompt("")}
                      className="absolute right-3 top-3 rounded-lg bg-slate-800/80 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Controls: Aspect Ratio, Duration, Tone */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
                {/* Aspect Ratio */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300">
                    Format & Aspek Rasio:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAspectRatio("9:16")}
                      className={`rounded-xl py-2 text-center text-xs font-bold transition-all border ${
                        aspectRatio === "9:16"
                          ? "border-purple-500 bg-purple-600/20 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      📱 9:16
                      <div className="text-[9px] font-normal opacity-70">Shorts/TikTok</div>
                    </button>
                    <button
                      onClick={() => setAspectRatio("16:9")}
                      className={`rounded-xl py-2 text-center text-xs font-bold transition-all border ${
                        aspectRatio === "16:9"
                          ? "border-purple-500 bg-purple-600/20 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🖥️ 16:9
                      <div className="text-[9px] font-normal opacity-70">YouTube</div>
                    </button>
                    <button
                      onClick={() => setAspectRatio("1:1")}
                      className={`rounded-xl py-2 text-center text-xs font-bold transition-all border ${
                        aspectRatio === "1:1"
                          ? "border-purple-500 bg-purple-600/20 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ⏹️ 1:1
                      <div className="text-[9px] font-normal opacity-70">Square/Feed</div>
                    </button>
                  </div>
                </div>

                {/* Duration */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      Target Durasi:
                    </label>
                    <span className="text-xs font-extrabold text-purple-400">
                      {targetDuration} Detik
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setTargetDuration(sec)}
                        className={`rounded-xl py-2 text-center text-xs font-bold transition-all border ${
                          targetDuration === sec
                            ? "border-purple-500 bg-purple-600/20 text-white"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300">
                    Tone & Suasana:
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="kreatif">✨ Kreatif & Viral</option>
                    <option value="sinematik">🎬 Sinematik & Elegan</option>
                    <option value="edukatif">💡 Edukatif & Berwibawa</option>
                    <option value="santai">☕ Santai & Kasual Vlog</option>
                    <option value="komersial">🔥 Iklan Komersial High-Impact</option>
                  </select>
                </div>
              </div>

              {conceptError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{conceptError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <button
                  id="btn-generate-concepts"
                  onClick={handleGenerateConcepts}
                  disabled={!prompt.trim() || isGeneratingConcepts}
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 px-8 py-3.5 text-sm font-black text-white shadow-xl shadow-purple-600/30 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isGeneratingConcepts ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Gemini Sedang Merancang 3 Konsep...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-pink-200" />
                      <span>Rancang 3 Konsep Kreatif dengan Gemini →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: CHOOSE FROM GEMINI CONCEPTS                      */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>LANGKAH 2: PILIH KONSEP DARI GEMINI</span>
              </div>
              <h2 className="text-2xl font-black text-white sm:text-3xl">
                Gemini Telah Merancang 5 Konsep + 3 Sudut Pandang Langka
              </h2>
              <p className="text-sm text-slate-400">
                Pilih konsep yang paling sesuai dengan visi Anda. Gemini akan mengolah konsep terpilih menjadi naskah breakdown scene lengkap.
              </p>
            </div>

            {conceptKeywords.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">
                  🔑 Kata Kunci yang Sering Dicari:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {conceptKeywords.map((kw, i) => (
                    <span key={i} className="rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-400">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Main Concept Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {concepts.filter((c) => !c.isRareAngle).map((concept, index) => (
                <ConceptCard
                  key={concept.id || index}
                  concept={concept}
                  index={index}
                  isSelected={selectedConceptId === concept.id}
                  onSelect={() => {
                    setSelectedConceptId(concept.id);
                    setSelectedVoice(concept.recommendedVoice || "Zephyr");
                    setSelectedBgm(concept.recommendedBgm || "bsl1");
                  }}
                />
              ))}
            </div>

            {concepts.some((c) => c.isRareAngle) && (
              <div className="space-y-3 pt-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                  <Zap className="h-3.5 w-3.5" />
                  <span>SUDUT PANDANG LANGKA — Jarang Dipakai Kreator Lain</span>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {concepts.filter((c) => c.isRareAngle).map((concept, index) => (
                    <ConceptCard
                      key={concept.id || `rare-${index}`}
                      concept={concept}
                      index={index}
                      isSelected={selectedConceptId === concept.id}
                      onSelect={() => {
                        setSelectedConceptId(concept.id);
                        setSelectedVoice(concept.recommendedVoice || "Zephyr");
                        setSelectedBgm(concept.recommendedBgm || "bsl1");
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {refineError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{refineError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Ubah Ide Prompt</span>
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleGenerateConcepts}
                  disabled={isGeneratingConcepts}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${isGeneratingConcepts ? "animate-spin" : ""}`} />
                  <span>Minta 3 Opsi Baru</span>
                </button>

                <button
                  id="btn-refine-concept"
                  onClick={handleRefineConcept}
                  disabled={!selectedConceptId || isRefiningScenes}
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 px-8 py-3.5 text-sm font-black text-white shadow-xl shadow-purple-600/30 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isRefiningScenes ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Gemini Sedang Mengolah Adegan...</span>
                    </>
                  ) : (
                    <>
                      <span>Pilih Konsep Ini & Olah Adegan</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: REFINE SCENES & SCRIPT TUNING                     */}
        {/* ========================================================= */}
        {currentStep === 3 && refinedData && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                <Edit3 className="h-3.5 w-3.5" />
                <span>LANGKAH 3: PENGOLAHAN DETAIL ADEGAN & NASKAH</span>
              </div>
              <h2 className="text-2xl font-black text-white sm:text-3xl">
                Tuning Naskah & Visual Tiap Adegan
              </h2>
              <p className="text-sm text-slate-400">
                Gemini telah membedah konsep menjadi naskah dan prompt visual per scene. Anda dapat menyesuaikan teks narasi, visual prompt, atau model suara sebelum digenerate.
              </p>
            </div>

            {/* Global Settings: Voice, BGM, Style */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-md">
              {/* Style Preset */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-purple-400" />
                  <span>Style Visual:</span>
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none"
                >
                  {PRESET_STYLES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Voice Actor */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-pink-400" />
                  <span>Suara Voice Over:</span>
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Backsound */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Backsound Musik:</span>
                </label>
                <select
                  value={selectedBgm}
                  onChange={(e) => setSelectedBgm(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none"
                >
                  {BGM_OPTIONS.map((bgm) => (
                    <option key={bgm.id} value={bgm.id}>
                      {bgm.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scenes List */}
            <div className="space-y-4">
              {refinedData.characterDescription && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 text-xs">
                  <span className="font-black text-purple-300">🧑 Karakter Utama (konsisten di semua scene): </span>
                  <span className="text-slate-300">{refinedData.characterDescription}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-400" />
                  <span>Daftar Adegan ({refinedData.scenes?.length || 0} Scene)</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Total Estimasi:{" "}
                  <strong className="text-purple-300">
                    {refinedData.scenes.reduce((acc, sc) => acc + (sc.duration || 5), 0)}s
                  </strong>
                </span>
              </div>

              <div className="space-y-4">
                {refinedData.scenes.map((scene, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-4 transition-all hover:border-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-xs font-black text-white">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={scene.overlayTitle || ""}
                          onChange={(e) =>
                            handleUpdateScene(idx, "overlayTitle", e.target.value)
                          }
                          placeholder="Judul / Badge Scene (Opsional)"
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-bold text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Camera motion */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span>Kamera:</span>
                          <select
                            value={scene.cameraMotion || "zoom-in"}
                            onChange={(e) =>
                              handleUpdateScene(idx, "cameraMotion", e.target.value)
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="zoom-in">Zoom In</option>
                            <option value="zoom-out">Zoom Out</option>
                            <option value="pan-left">Pan Left</option>
                            <option value="pan-right">Pan Right</option>
                            <option value="slow-tilt">Slow Tilt</option>
                          </select>
                        </div>

                        {/* Duration — clamped to what the AI video engine actually supports */}
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          <select
                            value={[4, 6, 8].includes(scene.duration) ? scene.duration : 8}
                            onChange={(e) =>
                              handleUpdateScene(idx, "duration", Number(e.target.value))
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                          >
                            <option value={4}>4 detik</option>
                            <option value={6}>6 detik</option>
                            <option value={8}>8 detik</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Voiceover Script */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                          <Mic className="h-3.5 w-3.5" />
                          <span>Naskah Voice Over (Bahasa Indonesia):</span>
                        </label>
                        <textarea
                          rows={3}
                          value={scene.voiceoverText || ""}
                          onChange={(e) =>
                            handleUpdateScene(idx, "voiceoverText", e.target.value)
                          }
                          placeholder="Teks yang akan dibacakan Voice Over..."
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none"
                        />
                      </div>

                      {/* Visual Prompt for Gemini Engine */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Film className="h-3.5 w-3.5" />
                          <span>Prompt Visual AI (English):</span>
                        </label>
                        <textarea
                          rows={3}
                          value={scene.visualPrompt || ""}
                          onChange={(e) =>
                            handleUpdateScene(idx, "visualPrompt", e.target.value)
                          }
                          placeholder="Deskripsi visual untuk engine video/image..."
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 placeholder-slate-500 focus:border-purple-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Veo Quality & Cost Estimate */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-300">Kualitas Video AI:</label>
                <select
                  value={veoQuality}
                  onChange={(e) => setVeoQuality(e.target.value as VeoQuality)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                >
                  {(Object.keys(QUALITY_LABELS) as VeoQuality[]).map((q) => (
                    <option key={q} value={q}>{QUALITY_LABELS[q]}</option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-slate-400">
                Estimasi total biaya:{" "}
                <strong className="text-amber-400">
                  ${(refinedData.scenes.reduce((acc, sc) => acc + (sc.duration || 8), 0) * QUALITY_PRICE_PER_SEC[veoQuality]).toFixed(2)}
                </strong>{" "}
                (ditagih ke API key Gemini)
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Kembali ke Konsep</span>
              </button>

              <button
                id="btn-generate-final-video"
                onClick={handleGenerateFinalVideo}
                disabled={isGeneratingVideo}
                className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 px-8 py-3.5 text-sm font-black text-white shadow-xl shadow-purple-600/30 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isGeneratingVideo ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Memproses Video Engine Gemini ({generationProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 text-amber-300" />
                    <span>Generate Video Sekarang (Engine Gemini)</span>
                    <Sparkles className="h-4 w-4 text-pink-200" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: OUTPUT STUDIO PLAYER & EXPORT                    */}
        {/* ========================================================= */}
        {currentStep === 4 && generatedVideoResult && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>LANGKAH 4: VIDEO AI SELESAI DIGENERATE</span>
              </div>
              <h2 className="text-2xl font-black text-white sm:text-3xl">
                {generatedVideoResult.videoTitle || "Hasil Video AI Gemini"}
              </h2>
              <p className="text-sm text-slate-400">
                Video telah dirangkai dengan visual sinematik Gemini, motion effect, teks narasi, dan audio.
              </p>
            </div>

            {/* Studio Workspace */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Video Preview Player */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex flex-col justify-between">
                  {/* Current Active Scene Visual — real Veo <video> once ready, placeholder image while generating */}
                  {generatedVideoResult.scenes?.[activeSceneIndex] && (
                    <div className="absolute inset-0 overflow-hidden">
                      {generatedVideoResult.scenes[activeSceneIndex].videoUrl ? (
                        <video
                          key={generatedVideoResult.scenes[activeSceneIndex].videoUrl}
                          src={generatedVideoResult.scenes[activeSceneIndex].videoUrl}
                          className="h-full w-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={generatedVideoResult.scenes[activeSceneIndex].visualUrl}
                          alt="Scene Visual"
                          className={`h-full w-full object-cover transition-transform duration-1000 ${
                            isPlaying ? "scale-110" : "scale-100"
                          }`}
                        />
                      )}
                      {/* Subtle Vignette & Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
                      {generatedVideoResult.scenes[activeSceneIndex].veoStatus === "generating" && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-sm px-3 py-2 text-center text-[10px] font-bold text-amber-300 flex items-center justify-center gap-1.5">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          <span>Video AI sedang di-generate Veo... (bisa sampai beberapa menit)</span>
                        </div>
                      )}
                      {generatedVideoResult.scenes[activeSceneIndex].veoStatus === "error" && (
                        <div className="absolute inset-x-0 bottom-0 bg-red-950/80 backdrop-blur-sm px-3 py-2 text-center text-[10px] font-bold text-red-300">
                          Gagal generate: {generatedVideoResult.scenes[activeSceneIndex].veoError || "Unknown error"}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Header in Player */}
                  <div className="relative z-10 p-4 flex items-center justify-between">
                    <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-extrabold text-white border border-white/10">
                      SCENE {activeSceneIndex + 1} / {generatedVideoResult.scenes?.length || 1}
                    </span>
                    <span className="rounded-full bg-purple-600/80 backdrop-blur-md px-2.5 py-0.5 text-[9px] font-bold text-white">
                      AI GEMINI ENGINE
                    </span>
                  </div>

                  {/* Subtitle & Narration Overlay in Player */}
                  <div className="relative z-10 p-5 space-y-3">
                    {generatedVideoResult.scenes?.[activeSceneIndex]?.overlayTitle && (
                      <div className="inline-block rounded-xl bg-purple-600/90 px-3 py-1 text-xs font-black text-white shadow-lg backdrop-blur-md">
                        {generatedVideoResult.scenes[activeSceneIndex].overlayTitle}
                      </div>
                    )}

                    <div className="rounded-2xl bg-black/75 p-3.5 backdrop-blur-md border border-white/15 text-center">
                      <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                        "{generatedVideoResult.scenes?.[activeSceneIndex]?.voiceoverText}"
                      </p>
                    </div>
                  </div>

                  {/* Playback Controls Overlay Bottom */}
                  <div className="relative z-20 bg-slate-950/90 p-3 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md hover:bg-purple-500"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                    </button>

                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100"
                          style={{
                            width: `${
                              (playProgress /
                                Math.max(
                                  1,
                                  generatedVideoResult.scenes.reduce(
                                    (s: number, sc: any) => s + (sc.duration || 5),
                                    0
                                  )
                                )) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>{playProgress.toFixed(1)}s</span>
                        <span>
                          {generatedVideoResult.scenes
                            .reduce((s: number, sc: any) => s + (sc.duration || 5), 0)
                            .toFixed(0)}
                          s
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setPlayProgress(0);
                        setActiveSceneIndex(0);
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:text-white"
                      title="Reset Playback"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Scenes Breakdown & Transfer to Editor */}
              <div className="lg:col-span-5 space-y-5">
                {/* Voice Over Audio Box */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-pink-400" />
                      <h4 className="text-xs font-bold text-white">Voice Over AI Gemini</h4>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Suara: {generatedVideoResult.voice || selectedVoice}
                    </span>
                  </div>

                  {audioUrl ? (
                    <div className="space-y-2">
                      <audio ref={audioRef} controls src={audioUrl} className="w-full h-8" />
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Audio siap disinkronkan
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerateVoiceOver}
                      disabled={isGeneratingVO}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600/20 border border-pink-500/40 py-2.5 text-xs font-bold text-pink-300 hover:bg-pink-600/30"
                    >
                      {isGeneratingVO ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Membuat Audio Voice Over...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Generate Audio Suara AI</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Scene Carousel Selector */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-purple-400" />
                    <span>Pilih Scene untuk Preview:</span>
                  </h4>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {generatedVideoResult.scenes?.map((sc: any, sIdx: number) => (
                      <div
                        key={sIdx}
                        onClick={() => setActiveSceneIndex(sIdx)}
                        className={`flex items-center gap-3 rounded-xl p-2.5 cursor-pointer transition-all border ${
                          activeSceneIndex === sIdx
                            ? "border-purple-500 bg-purple-950/40 text-white"
                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-slate-800">
                          <img
                            src={sc.visualUrl}
                            alt={`Scene ${sIdx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          {sc.veoStatus === "generating" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-300" />
                            </div>
                          )}
                          {sc.videoUrl && (
                            <div className="absolute bottom-0 right-0 rounded-tl bg-emerald-500 p-0.5">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">
                              Scene #{sIdx + 1}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {sc.duration}s
                            </span>
                          </div>
                          <p className="text-[11px] truncate text-slate-400">
                            {sc.voiceoverText}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Integration Actions */}
                <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 to-purple-950/30 p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-indigo-400" />
                    <span>Langkah Selanjutnya:</span>
                  </h4>
                  <p className="text-xs text-slate-300">
                    Buka proyek ini langsung di <strong>Klip AI Editor</strong> untuk memotong klip, mengubah subtitle dinamis, atau menambahkan transisi kustom!
                  </p>

                  <div className="flex flex-col gap-2 pt-1">
                    {onSendToKlipAI && (
                      <button
                        onClick={() => onSendToKlipAI(generatedVideoResult)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-95"
                      >
                        <Film className="h-4 w-4" />
                        <span>Buka & Edit di Klip AI Editor →</span>
                      </button>
                    )}

                    <button
                      onClick={() => setCurrentStep(1)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Buat Video AI Baru</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
