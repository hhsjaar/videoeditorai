"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Wand2,
  Volume2,
  Video,
  Music,
  Image as ImageIcon,
  Play,
  Pause,
  Download,
  Loader2,
  CheckCircle2,
  Layers,
  Smartphone,
  Film,
  Scissors,
  Plus,
  Trash2,
  VolumeX,
  Type,
  Check,
  LayoutGrid,
  Sun,
  Moon,
  Link as LinkIcon,
  X,
  Zap,
  Sliders,
  FileVideo,
  Palette,
  Clock,
} from "lucide-react";

export default function AutoVideoStudio() {
  // Navigation / View Mode: "wizard" (Default Opening View) | "timeline" (Pro Mode)
  const [viewMode, setViewMode] = useState<"wizard" | "timeline">("wizard");

  // UI Theme: "light" (Default Light Mode) | "dark"
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Feature: AI Style Analyzer & Remixer (Reels / TikTok Clone)
  const [showStyleAnalyzerModal, setShowStyleAnalyzerModal] = useState(false);
  const [styleUrlInput, setStyleUrlInput] = useState("");
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [analyzedStyleData, setAnalyzedStyleData] = useState<{
    styleName: string;
    pace: string;
    subtitleStyle: "plain-shadow" | "yellow" | "white" | "neon" | "box";
    subtitleFontSize: number;
    recommendedBgmId: string;
    recommendedBgmTitle: string;
    colorMood: string;
    hookAnalysis: string;
    editingTips: string[];
  } | null>(null);

  // Inspector & Editing Style State
  const [editingStyle, setEditingStyle] = useState<"fast-viral" | "cinematic-aesthetic" | "brand-commercial" | "soft-sweet">("fast-viral");
  const [activeTab, setActiveTab] = useState<"script" | "media" | "inspector">("script");
  const [subtitleStyle, setSubtitleStyle] = useState<"plain-shadow" | "yellow" | "white" | "neon" | "box">("plain-shadow");
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(22);

  // Step 1: Script & Audio Voice Over State
  const [rawScript, setRawScript] = useState("");
  const [polishedScript, setPolishedScript] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(15);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Step 2: Media Bin Footages State
  const [footages, setFootages] = useState<{ file: File; duration?: number; previewUrl?: string }[]>([]);

  // Step 3: BGM State & AI Selection
  const [bgm, setBgm] = useState<File | null>(null);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState<number>(0.2);
  const [isSelectingBgm, setIsSelectingBgm] = useState(false);
  const [bgmReasoning, setBgmReasoning] = useState("");
  const [selectedBgmTitle, setSelectedBgmTitle] = useState("");
  const [isBgmPreviewPlaying, setIsBgmPreviewPlaying] = useState(false);

  // Step 4: Ending Dissolve Scene Logo State (Defaults to attached burjolevelup photo)
  const [endingLogo, setEndingLogo] = useState<{ file?: File; previewUrl: string } | null>({
    previewUrl: "/ending-logo.png",
  });

  // Render Video State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // Playback Control & Timeline State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const totalTimelineDuration = Math.max(audioDuration || 15, 10);

  // BGM Object URL Sync
  useEffect(() => {
    if (bgm) {
      const url = URL.createObjectURL(bgm);
      setBgmUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBgmUrl(null);
    }
  }, [bgm]);

  // Synchronize Playback across Media elements
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalTimelineDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);

      if (renderedVideoUrl && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      if (audioUrl && audioPreviewRef.current) {
        audioPreviewRef.current.muted = isMuted;
        audioPreviewRef.current.play().catch(() => {});
      }
      if (bgmUrl && bgmAudioRef.current) {
        bgmAudioRef.current.volume = bgmVolume;
        bgmAudioRef.current.muted = isMuted;
        bgmAudioRef.current.play().catch(() => {});
      }
      if (previewVideoRef.current) {
        previewVideoRef.current.muted = true;
        previewVideoRef.current.play().catch(() => {});
      }
    } else {
      clearInterval(interval);
      if (videoRef.current) videoRef.current.pause();
      if (audioPreviewRef.current) audioPreviewRef.current.pause();
      if (bgmAudioRef.current) bgmAudioRef.current.pause();
      if (previewVideoRef.current) previewVideoRef.current.pause();
      setIsBgmPreviewPlaying(false);
    }

    return () => clearInterval(interval);
  }, [isPlaying, totalTimelineDuration, renderedVideoUrl, audioUrl, bgmUrl, isMuted, bgmVolume]);

  // Sync seek position
  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (renderedVideoUrl && videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (audioUrl && audioPreviewRef.current) {
      audioPreviewRef.current.currentTime = newTime;
    }
    if (bgmUrl && bgmAudioRef.current) {
      bgmAudioRef.current.currentTime = newTime % (bgmAudioRef.current.duration || 60);
    }
  };

  // Load Voice Over Duration
  useEffect(() => {
    if (audioUrl) {
      const tempAudio = new Audio(audioUrl);
      tempAudio.onloadedmetadata = () => {
        if (tempAudio.duration && !isNaN(tempAudio.duration)) {
          setAudioDuration(tempAudio.duration);
        }
      };
    }
  }, [audioUrl]);

  // Feature Call: AI Style Analyzer
  const handleAnalyzeStyle = async () => {
    if (!styleUrlInput.trim()) {
      return alert("Masukkan link video Instagram Reels / TikTok atau deskripsi gaya video!");
    }

    setIsAnalyzingStyle(true);
    try {
      const res = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: styleUrlInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menganalisis gaya video.");
      setAnalyzedStyleData(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAnalyzingStyle(false);
    }
  };

  // Feature Call: 1-Click Apply Analyzed Style
  const handleApplyAnalyzedStyle = async () => {
    if (!analyzedStyleData) return;

    setSubtitleStyle(analyzedStyleData.subtitleStyle);
    setSubtitleFontSize(analyzedStyleData.subtitleFontSize || 22);

    const paceLower = analyzedStyleData.pace.toLowerCase();
    if (paceLower.includes("cepat") || paceLower.includes("fast")) {
      setEditingStyle("fast-viral");
    } else if (paceLower.includes("slow") || paceLower.includes("aesthetic")) {
      setEditingStyle("cinematic-aesthetic");
    } else if (paceLower.includes("brand") || paceLower.includes("commercial")) {
      setEditingStyle("brand-commercial");
    } else {
      setEditingStyle("soft-sweet");
    }

    if (analyzedStyleData.recommendedBgmId) {
      const bgmUrlMap: Record<string, string> = {
        "fnb-modern-cafe": "/bgm/fnb-modern-cafe.mp3",
        "fnb-trendy-bistro": "/bgm/fnb-trendy-bistro.mp3",
        "fnb-premium-gourmet": "/bgm/fnb-premium-gourmet.mp3",
        "fnb-streetfood-viral": "/bgm/fnb-streetfood-viral.mp3",
        "fnb-bakery-sweet": "/bgm/fnb-bakery-sweet.mp3",
        "fnb-drink-refreshing": "/bgm/fnb-drink-refreshing.mp3",
        "fnb-brand-commercial": "/bgm/fnb-brand-commercial.mp3",
        "fnb-night-bar": "/bgm/fnb-night-bar.mp3",
      };

      const presetUrl = bgmUrlMap[analyzedStyleData.recommendedBgmId] || "/bgm/fnb-modern-cafe.mp3";
      handleSelectPresetBgm(presetUrl, analyzedStyleData.recommendedBgmTitle || "BGM Teranalisis AI");
    }

    setShowStyleAnalyzerModal(false);
    alert(`Gaya Editing "${analyzedStyleData.styleName}" berhasil diterapkan! (Pacing + Color Grade + Subtitle + BGM telah disinkronkan)`);
  };

  // API Call: Auto Select BGM via Gemini AI
  const handleSelectBgmAI = async () => {
    const textToUse = polishedScript || rawScript;
    if (!textToUse.trim()) {
      return alert("Masukkan naskah terlebih dahulu agar AI dapat menganalisis dan memilihkan BGM yang cocok!");
    }

    setIsSelectingBgm(true);
    try {
      const res = await fetch("/api/select-bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText: textToUse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memilih BGM otomatis.");

      const audioRes = await fetch(data.track.url);
      const blob = await audioRes.blob();
      const file = new File([blob], `${data.track.id}.mp3`, { type: "audio/mp3" });

      setBgm(file);
      setBgmVolume(data.recommendedVolume || 0.2);
      setBgmReasoning(data.reasoning);
      setSelectedBgmTitle(data.track.title);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSelectingBgm(false);
    }
  };

  // Manual Select BGM from Presets
  const handleSelectPresetBgm = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `${name}.mp3`, { type: "audio/mp3" });
      setBgm(file);
      setSelectedBgmTitle(name);
      setBgmReasoning("Pilihan manual dari pustaka BGM brand F&B.");
    } catch (e: any) {
      alert("Gagal memuat preset BGM: " + e.message);
    }
  };

  // API Call: Polish Script via Gemini
  const handlePolishScript = async () => {
    if (!rawScript.trim()) return alert("Masukkan naskah awal Anda!");
    setIsPolishing(true);
    try {
      const res = await fetch("/api/polish-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText: rawScript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal merapikan naskah.");
      setPolishedScript(data.polishedScript);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPolishing(false);
    }
  };

  // API Call: Generate Voice Over Audio
  const handleGenerateAudio = async () => {
    const textToUse = polishedScript || rawScript;
    if (!textToUse.trim()) return alert("Tuliskan naskah terlebih dahulu!");
    setIsGeneratingAudio(true);
    try {
      const res = await fetch("/api/generate-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToUse, voiceName: "Zephyr" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal membuat suara audio.");
      }

      const blob = await res.blob();
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Add Footages
  const handleFootageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setFootages((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFootage = (index: number) => {
    setFootages((prev) => prev.filter((_, i) => i !== index));
  };

  // Change Ending Logo Scene
  const handleEndingLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setEndingLogo({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
  };

  // API Call: Render Full Video (9:16)
  const handleRenderVideo = async () => {
    if (!audioBlob) return alert("Hasilkan Voice Over terlebih dahulu!");
    if (footages.length === 0) return alert("Upload minimal 1 video footage!");

    setIsRendering(true);
    setRenderProgress("Memotong footage sesuai gaya editing, mewarnai (color grade), mencocokkan BGM, dan menyusun format 9:16...");

    try {
      const formData = new FormData();
      formData.append("voiceover", audioBlob, "vo.mp3");
      formData.append("subtitleText", polishedScript || rawScript);
      formData.append("bgmVolume", bgmVolume.toString());
      formData.append("subtitleStyle", subtitleStyle);
      formData.append("subtitleFontSize", subtitleFontSize.toString());
      formData.append("editingStyle", editingStyle);

      footages.forEach((item, idx) => {
        formData.append(`footage_${idx}`, item.file);
      });

      if (bgm) formData.append("bgm", bgm);
      if (endingLogo && endingLogo.file) formData.append("endingLogo", endingLogo.file);

      const res = await fetch("/api/render-video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Proses render video gagal.");
      }

      const videoBlob = await res.blob();
      setRenderedVideoUrl(URL.createObjectURL(videoBlob));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRendering(false);
    }
  };

  // Timecode Formatter
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  // Helper subtitle text current sentence
  const sentences = (polishedScript || rawScript)
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const currentSentenceIdx = Math.min(
    Math.floor((currentTime / totalTimelineDuration) * sentences.length),
    sentences.length - 1
  );
  const currentSubtitleText = sentences[currentSentenceIdx] || "";

  // Dynamic Theme Classes
  const isLight = theme === "light";
  const bgMain = isLight ? "bg-[#f8fafc] text-slate-900" : "bg-[#07090e] text-slate-100";
  const bgHeader = isLight ? "bg-white/90 border-slate-200 shadow-sm" : "bg-[#0b0f19] studio-border";
  const cardBg = isLight ? "bg-white border-slate-200 shadow-lg shadow-slate-200/50" : "bg-[#0b0f19] studio-border shadow-xl";
  const inputBg = isLight ? "bg-slate-100/90 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white" : "bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500";
  const innerCardBg = isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800";
  const textSub = isLight ? "text-slate-500" : "text-slate-400";
  const textHead = isLight ? "text-slate-800" : "text-slate-100";

  return (
    <main className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${bgMain}`}>
      
      {/* HEADER NAVBAR */}
      <header className={`h-16 border-b px-6 flex items-center justify-between z-40 transition-colors ${bgHeader}`}>
        {/* App Title Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-purple-500/20">
            AV
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              AUTO VIDEO EDITOR <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-500/20">F&B PRO</span>
            </h1>
            <p className={`text-[10px] ${textSub}`}>AI Automated Short Video Generator (9:16)</p>
          </div>
        </div>

        {/* Center Mode Controls & AI Style Analyzer Launcher */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-950 border-slate-800"}`}>
            <button
              onClick={() => setViewMode("wizard")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === "wizard"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                  : isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Mode Input</span>
            </button>

            <button
              onClick={() => setViewMode("timeline")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                  : isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-purple-400" />
              <span>Studio Timeline</span>
            </button>
          </div>

          {/* AI Style Analyzer Feature Button */}
          <button
            onClick={() => setShowStyleAnalyzerModal(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: "6s" }} />
            <span>AI Style Analyzer (Reels/TikTok)</span>
          </button>
        </div>

        {/* Right Controls: Theme Switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isLight
                ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm"
                : "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700"
            }`}
          >
            {isLight ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            <span>{isLight ? "Mode Terang" : "Mode Gelap"}</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* FEATURE MODAL: AI VIRAL STYLE ANALYZER & REMIXER (REELS / TIKTOK CLONE) */}
      {/* ========================================================================= */}
      {showStyleAnalyzerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-3xl p-6 border shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 ${isLight ? "bg-white border-slate-200" : "bg-[#0c101d] border-slate-800"}`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 studio-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-pink-500/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-extrabold flex items-center gap-2 ${textHead}`}>
                    AI Viral Style Analyzer & Remixer
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-300 font-bold border border-pink-500/20">
                      Reels / TikTok Clone
                    </span>
                  </h3>
                  <p className={`text-xs ${textSub}`}>Analisis gaya editing, tempo pemotongan, warna, font, dan BGM dari video referensi lalu terapkan ke video Anda sendiri!</p>
                </div>
              </div>

              <button
                onClick={() => setShowStyleAnalyzerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-600 dark:text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Link Instagram / TikTok */}
            <div className="space-y-2">
              <label className={`text-xs font-bold flex items-center gap-1.5 ${textHead}`}>
                <LinkIcon className="w-3.5 h-3.5 text-pink-500" />
                <span>Masukkan Link Video Instagram Reels / TikTok atau Deskripsi Video Referensi:</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://www.instagram.com/reel/... atau 'Video kuliner cafe aesthetic fast cuts subtitle polos shadow'"
                  value={styleUrlInput}
                  onChange={(e) => setStyleUrlInput(e.target.value)}
                  className={`flex-1 text-xs px-4 py-3 rounded-xl focus:outline-none ${inputBg}`}
                />
                <button
                  onClick={handleAnalyzeStyle}
                  disabled={isAnalyzingStyle || !styleUrlInput.trim()}
                  className="px-5 py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-pink-600/20 transition-all cursor-pointer shrink-0"
                >
                  {isAnalyzingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                  <span>Analisis Gaya Video AI</span>
                </button>
              </div>
            </div>

            {/* AI Analysis Result Dashboard */}
            {analyzedStyleData && (
              <div className={`p-5 rounded-2xl border space-y-4 ${innerCardBg}`}>
                <div className="flex items-center justify-between border-b pb-3 studio-border">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">{analyzedStyleData.styleName}</h4>
                      <p className="text-[11px] text-slate-500">Tone Warna: {analyzedStyleData.colorMood}</p>
                    </div>
                  </div>
                  <span className="text-[11px] px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold rounded-lg border border-indigo-500/20">
                    Pacing Cuts: {analyzedStyleData.pace}
                  </span>
                </div>

                {/* Subtitle & BGM Breakdown */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className={`p-3 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
                    <span className="font-bold text-slate-500 block mb-1">Gaya Subtitle Terdeteksi:</span>
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <Type className="w-4 h-4 text-purple-500" />
                      <span>{analyzedStyleData.subtitleStyle} ({analyzedStyleData.subtitleFontSize}px)</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
                    <span className="font-bold text-slate-500 block mb-1">Rekomendasi Track BGM:</span>
                    <div className="flex items-center gap-2 font-bold text-pink-500">
                      <Music className="w-4 h-4" />
                      <span className="truncate">{analyzedStyleData.recommendedBgmTitle}</span>
                    </div>
                  </div>
                </div>

                {/* Editing Tips & Hook Breakdown */}
                <div className="space-y-2">
                  <span className="font-bold text-xs text-slate-500 block">Daya Tarik & Tips Editing Viral:</span>
                  <p className="text-xs italic bg-amber-500/10 text-amber-700 dark:text-amber-300 p-2.5 rounded-xl border border-amber-500/20">
                    "{analyzedStyleData.hookAnalysis}"
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300 pl-4 list-disc">
                    {analyzedStyleData.editingTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>

                {/* 1-Click Apply Button */}
                <button
                  onClick={handleApplyAnalyzedStyle}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current text-amber-300" />
                  <span>TERAPKAN GAYA EDITING INI KE VIDEO SAYA (1-CLICK APPLY)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN VIEW 1: INITIAL WIZARD CREATOR MODE (4 STEP GUIDED INPUT FORM) */}
      {/* ========================================================================= */}
      {viewMode === "wizard" ? (
        <div className="flex-1 flex overflow-hidden p-6 gap-6 max-w-7xl mx-auto w-full">
          
          {/* LEFT COLUMN: 4 Step Form Cards */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
            
            {/* STEP 1: Input Teks untuk Voice Over */}
            <div className={`${cardBg} rounded-2xl p-5 space-y-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center border border-indigo-500/30 text-sm">
                    1
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                        <Type className="w-4 h-4 text-indigo-500" />
                        Input Teks untuk Voice Over
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 rounded-md font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Suara AI: <strong>Zephyr (F&B Presenter)</strong>
                      </span>
                    </div>
                    <p className={`text-[11px] ${textSub}`}>Ketik naskah video Anda & hasilkan suara AI komunikatif</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handlePolishScript}
                    disabled={isPolishing || !rawScript.trim()}
                    className={`px-3 py-1.5 disabled:opacity-40 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700" : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200"
                    }`}
                  >
                    {isPolishing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <Wand2 className="w-3.5 h-3.5 text-purple-500" />}
                    <span>Polish AI</span>
                  </button>

                  <button
                    onClick={handleGenerateAudio}
                    disabled={isGeneratingAudio || (!rawScript.trim() && !polishedScript.trim())}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    {isGeneratingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>Generate VO</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                placeholder="Masukkan atau tempel naskah video promosi brand F&B Anda di sini (contoh: Burjolevelup menjual bukan hanya sekadar makanan, tapi juga rasa...)"
                value={rawScript}
                onChange={(e) => setRawScript(e.target.value)}
                className={`w-full text-xs p-3.5 rounded-xl focus:outline-none resize-none leading-relaxed transition-all ${inputBg}`}
              />

              {/* Polished Result & Audio Player Preview */}
              {polishedScript && (
                <div className={`p-3 rounded-xl space-y-1 text-xs border ${isLight ? "bg-indigo-50 border-indigo-200 text-slate-800" : "bg-indigo-950/40 border-indigo-500/30 text-indigo-300"}`}>
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Naskah Hasil Polish AI:
                    </span>
                    <button onClick={() => setPolishedScript("")} className="text-slate-400 hover:text-slate-600 text-[10px]">
                      Reset
                    </button>
                  </div>
                  <p className="italic leading-relaxed">{polishedScript}</p>
                </div>
              )}

              {audioUrl && (
                <div className={`p-3 rounded-xl flex items-center justify-between text-xs border ${innerCardBg}`}>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold">Voice Over Zephyr Siap!</span>
                    <span className="text-[10px] text-slate-400 font-mono">({audioDuration.toFixed(1)}s)</span>
                  </div>
                  <audio controls src={audioUrl} className="h-7 w-48" />
                </div>
              )}
            </div>

            {/* STEP 2: Input Footage Video & Gaya Editing Preset */}
            <div className={`${cardBg} rounded-2xl p-5 space-y-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center border border-indigo-500/30 text-sm">
                    2
                  </div>
                  <div>
                    <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                      <Video className="w-4 h-4 text-indigo-500" />
                      Input Footage Video & Preset Gaya Editing (Editing Style)
                    </h2>
                    <p className={`text-[11px] ${textSub}`}>Unggah klip video & pilih tempo pemotongan + pewarnaan (color grade)</p>
                  </div>
                </div>

                <label className="cursor-pointer px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Footage</span>
                  <input type="file" accept="video/*" multiple onChange={handleFootageChange} className="hidden" />
                </label>
              </div>

              {/* Editing Style Visual Preset Cards */}
              <div className="space-y-2 pt-2 border-t studio-border">
                <label className={`text-xs font-semibold flex items-center justify-between ${textSub}`}>
                  <span>Pilih Gaya Editing Video (Editing Style & Color Grade):</span>
                  <span className="text-[10px] text-indigo-500 font-mono font-bold">Auto Pacing & Tone</span>
                </label>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      id: "fast-viral",
                      title: "⚡ Fast Viral Beat",
                      desc: "Pemotongan Cepat 1.2s + Color Grade Warm Food Pop",
                      badge: "TikTok Beat",
                    },
                    {
                      id: "cinematic-aesthetic",
                      title: "☕ Cinematic Aesthetic",
                      desc: "Pemotongan Slow 3.2s + Color Grade Vintage Mood",
                      badge: "Reels Slow",
                    },
                    {
                      id: "brand-commercial",
                      title: "🔥 Modern Commercial",
                      desc: "Pemotongan Medium 2.0s + Color Grade High Contrast",
                      badge: "Brand Anthem",
                    },
                    {
                      id: "soft-sweet",
                      title: "🍰 Sweet Soft Vibe",
                      desc: "Pemotongan 2.5s + Color Grade Soft Brightness",
                      badge: "Sweet Bakery",
                    },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setEditingStyle(preset.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer space-y-1.5 ${
                        editingStyle === preset.id
                          ? "border-indigo-600 bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 font-bold shadow-md"
                          : isLight ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">{preset.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-mono font-bold">{preset.badge}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {footages.length === 0 ? (
                <div className={`border-2 border-dashed rounded-xl p-6 text-center space-y-2 ${isLight ? "border-slate-300 bg-slate-50" : "border-slate-800 bg-slate-950/50"}`}>
                  <FileVideo className="w-8 h-8 mx-auto text-slate-400" />
                  <p className={`text-xs ${textSub}`}>Belum ada footage diunggah. Tambahkan klip video makanan/minuman Anda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {footages.map((item, idx) => (
                    <div key={idx} className={`relative group rounded-xl overflow-hidden border p-1.5 space-y-1.5 ${innerCardBg}`}>
                      <video src={item.previewUrl} className="w-full aspect-[9/16] object-cover rounded-lg bg-black" />
                      <div className="flex items-center justify-between text-[10px] px-1">
                        <span className="truncate max-w-[80px] font-mono text-slate-400">{item.file.name}</span>
                        <button onClick={() => removeFootage(idx)} className="text-rose-500 hover:text-rose-600 p-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 3: Input Musik Latar (BGM) */}
            <div className={`${cardBg} rounded-2xl p-5 space-y-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center border border-indigo-500/30 text-sm">
                    3
                  </div>
                  <div>
                    <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                      <Music className="w-4 h-4 text-pink-500" />
                      Input Musik Latar (BGM) Brand F&B
                    </h2>
                    <p className={`text-[11px] ${textSub}`}>Pilih musik latar komersial moderen manual atau minta AI memilihkan</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectBgmAI}
                    disabled={isSelectingBgm || (!rawScript.trim() && !polishedScript.trim())}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-pink-600/20 transition-all cursor-pointer"
                  >
                    {isSelectingBgm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                    <span>Pilihkan BGM AI</span>
                  </button>

                  <label className={`cursor-pointer px-3.5 py-1.5 border rounded-xl text-xs font-semibold ${isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700" : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300"}`}>
                    {bgm ? "Ganti" : "+ Upload BGM"}
                    <input type="file" accept="audio/*" onChange={(e) => setBgm(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              </div>

              {bgmReasoning && (
                <div className={`p-3 rounded-xl text-xs space-y-1 border ${isLight ? "bg-pink-50 border-pink-200 text-pink-900" : "bg-pink-950/40 border-pink-500/30 text-pink-300"}`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Rekomendasi AI ({selectedBgmTitle}):</span>
                  </div>
                  <p className="italic">{bgmReasoning}</p>
                </div>
              )}

              {/* BGM Preset Selection Grid (F&B & Modern Branded) */}
              <div className="space-y-2 pt-2 border-t studio-border">
                <label className={`text-xs font-semibold flex items-center justify-between ${textSub}`}>
                  <span>Pustaka BGM Brand F&B Komersial Moderen:</span>
                  <span className="text-[10px] text-pink-500 font-mono font-bold">F&B Brand Edition</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "bsl1", name: "BGM 1 - Modern Chill Vibe", url: "/bgm/bsl1.mp3" },
                    { id: "bsl2", name: "BGM 2 - Upbeat Culinary Beat", url: "/bgm/bsl2.mp3" },
                    { id: "bsl3", name: "BGM 3 - Aesthetic Cafe Mood", url: "/bgm/bsl3.mp3" },
                    { id: "bsl4", name: "BGM 4 - Premium Gourmet Vibe", url: "/bgm/bsl4.mp3" },
                    { id: "bsl5", name: "BGM 5 - Trendy Commercial Anthem", url: "/bgm/bsl5.mp3" },
                    { id: "bsl6", name: "BGM 6 - Sweet Bakery & Dessert", url: "/bgm/bsl6.mp3" },
                    { id: "bsl7", name: "BGM 7 - Refreshing Summer Beverage", url: "/bgm/bsl7.mp3" },
                    { id: "bsl8", name: "BGM 8 - Viral Foodie Beat", url: "/bgm/bsl8.mp3" },
                    { id: "bsl9", name: "BGM 9 - Stylish Bistro Lounge", url: "/bgm/bsl9.mp3" },
                    { id: "bsl10", name: "BGM 10 - Modern Brand Commercial", url: "/bgm/bsl10.mp3" },
                  ].map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handleSelectPresetBgm(track.url, track.name)}
                      className={`p-2.5 rounded-xl border text-left text-[11px] transition-all flex items-center justify-between cursor-pointer ${
                        selectedBgmTitle === track.name
                          ? "border-pink-500 bg-pink-500/10 text-pink-600 dark:text-pink-200 font-bold shadow-sm"
                          : isLight ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className="truncate">{track.name}</span>
                      {selectedBgmTitle === track.name && <Check className="w-3.5 h-3.5 text-pink-500 shrink-0 ml-1" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active BGM Audio Player & Preview Controls */}
              {bgm && (
                <div className={`p-3.5 rounded-xl border space-y-3 ${innerCardBg}`}>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2.5 truncate max-w-[240px]">
                      <button
                        onClick={() => {
                          if (bgmAudioRef.current) {
                            if (bgmAudioRef.current.paused) {
                              bgmAudioRef.current.volume = bgmVolume;
                              bgmAudioRef.current.play().catch(() => {});
                              setIsBgmPreviewPlaying(true);
                            } else {
                              bgmAudioRef.current.pause();
                              setIsBgmPreviewPlaying(false);
                            }
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-md"
                      >
                        {isBgmPreviewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      </button>
                      <div className="truncate">
                        <span className="font-bold text-xs truncate block">{bgm.name}</span>
                        <span className="text-[10px] text-pink-500 font-semibold">{isBgmPreviewPlaying ? "Memutar Pratinjau Audio..." : "Klik play untuk mendengar"}</span>
                      </div>
                    </div>
                    <span className="text-pink-500 font-mono font-bold text-xs">Volume: {Math.round(bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => {
                      const vol = parseFloat(e.target.value);
                      setBgmVolume(vol);
                      if (bgmAudioRef.current) bgmAudioRef.current.volume = vol;
                    }}
                    className="w-full accent-pink-500 cursor-pointer h-1.5 bg-slate-300 dark:bg-slate-800 rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* STEP 4: Input Subtitle & Highlight Text */}
            <div className={`${cardBg} rounded-2xl p-5 space-y-4`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center border border-indigo-500/30 text-sm">
                  4
                </div>
                <div>
                  <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                    <Type className="w-4 h-4 text-purple-500" />
                    Input Subtitle & Highlight Text Style
                  </h2>
                  <p className={`text-[11px] ${textSub}`}>Atur gaya tampilan teks subtitle San Francisco Regular</p>
                </div>
              </div>

              {/* Subtitle Preset Selector */}
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${textSub}`}>Pilih Gaya Subtitle (Subtitle Style)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: "plain-shadow", name: "Polos Putih + Shadow", bg: isLight ? "bg-slate-800 text-white font-normal shadow" : "text-white font-normal drop-shadow-md bg-slate-900 border border-slate-700" },
                    { id: "yellow", name: "Yellow Punch", bg: "bg-amber-400 text-black font-normal" },
                    { id: "white", name: "Minimal White Box", bg: isLight ? "bg-slate-200 text-black font-normal border border-slate-300" : "bg-white text-black font-normal" },
                    { id: "neon", name: "Neon Cyan", bg: "bg-cyan-400 text-black font-normal border border-cyan-200" },
                    { id: "box", name: "Black Box", bg: "bg-black text-white font-normal border border-slate-700" },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSubtitleStyle(style.id as any)}
                      className={`p-2.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        subtitleStyle === style.id
                          ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-200 font-bold shadow-sm"
                          : isLight ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className={`px-2 py-0.5 text-[10px] rounded-md ${style.bg}`}>Aa Sub</span>
                      <span className="text-[10px] font-semibold leading-tight">{style.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitle Font Size Controls */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${innerCardBg}`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Ukuran Teks Subtitle (Font Size):</span>
                  <span className="text-purple-500 font-mono font-bold">{subtitleFontSize} px</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="14"
                    max="38"
                    step="2"
                    value={subtitleFontSize}
                    onChange={(e) => setSubtitleFontSize(parseInt(e.target.value, 10))}
                    className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-slate-300 dark:bg-slate-800 rounded-lg"
                  />
                  <div className="flex gap-1">
                    {[
                      { size: 18, label: "Kecil" },
                      { size: 22, label: "Sedang" },
                      { size: 28, label: "Besar" },
                      { size: 34, label: "X-Besar" },
                    ].map((btn) => (
                      <button
                        key={btn.size}
                        onClick={() => setSubtitleFontSize(btn.size)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                          subtitleFontSize === btn.size
                            ? "bg-purple-600 text-white border-purple-500 shadow-sm"
                            : isLight ? "bg-white text-slate-600 border-slate-300 hover:bg-slate-100" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ending Scene Logo (Dissolve) Preview */}
              <div className="pt-3 border-t studio-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 border rounded-xl overflow-hidden p-1 shrink-0 ${innerCardBg}`}>
                    <img src={endingLogo?.previewUrl} alt="Ending Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="font-bold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                      <span>Akhiran Video (Dissolve Scene 2.5s)</span>
                    </span>
                    <p className={`text-[10px] ${textSub}`}>Cover akhiran video burjolevelup disisipkan di akhir durasi</p>
                  </div>
                </div>

                <label className="cursor-pointer text-xs text-amber-500 font-bold hover:underline">
                  Ganti Foto Logo
                  <input type="file" accept="image/*" onChange={handleEndingLogoChange} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: 9:16 Preview Player & Main Render Action */}
          <div className={`w-96 rounded-2xl p-5 flex flex-col items-center justify-between shrink-0 border ${cardBg}`}>
            
            <div className={`w-full flex items-center justify-between text-xs pb-2 ${textSub}`}>
              <div className="flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>CANVAS 9:16</span>
              </div>
              <div className={`border px-3 py-1 rounded-lg font-mono text-xs font-bold ${isLight ? "bg-slate-100 border-slate-200 text-indigo-600" : "bg-slate-950 border-slate-800 text-cyan-400"}`}>
                {formatTimecode(currentTime)}
              </div>
            </div>

            {/* 9:16 Video Player Container */}
            <div className="w-full aspect-[9/16] bg-black rounded-2xl overflow-hidden relative border studio-border shadow-2xl flex items-center justify-center">
              {renderedVideoUrl ? (
                <video ref={videoRef} src={renderedVideoUrl} controls className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full relative bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
                  {footages.length > 0 ? (
                    <video
                      ref={previewVideoRef}
                      src={footages[Math.min(Math.floor((currentTime / totalTimelineDuration) * footages.length), footages.length - 1)]?.previewUrl}
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <div className="flex flex-col items-center text-slate-600 gap-2 p-6 text-center">
                      <Smartphone className="w-12 h-12 text-slate-700 animate-pulse" />
                      <p className="text-xs text-slate-400">Pratinjau Live Canvas 9:16</p>
                      <p className="text-[10px] text-slate-600">Isi naskah & upload footage untuk memulai</p>
                    </div>
                  )}

                  {/* Canvas Preview Subtitle Rendering (Exact 1:1 Scale & Soft Subtle Drop Shadow) */}
                  {currentSubtitleText && (
                    <div className="absolute bottom-14 left-4 right-4 text-center z-20 pointer-events-none flex items-center justify-center">
                      <span
                        style={{
                          fontSize: `${Math.round(subtitleFontSize * 0.95)}px`,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "San Francisco", sans-serif',
                          fontWeight: 400,
                        }}
                        className={`inline-block max-w-[88%] px-4 py-2 rounded-xl leading-relaxed text-center whitespace-normal break-words transition-all ${
                          subtitleStyle === "plain-shadow"
                            ? "text-white font-normal drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] [text-shadow:_0_1px_4px_rgb(0_0_0_/_45%)] tracking-normal"
                            : subtitleStyle === "yellow"
                            ? "bg-amber-400 text-black font-normal shadow-md"
                            : subtitleStyle === "neon"
                            ? "bg-cyan-400 text-black font-normal border border-cyan-300 shadow-md"
                            : subtitleStyle === "box"
                            ? "bg-black/90 text-white font-normal border border-slate-700 shadow-lg"
                            : "bg-white text-black font-normal shadow-sm"
                        }`}
                      >
                        {currentSubtitleText}
                      </span>
                    </div>
                  )}

                  {/* Ending Dissolve Scene Overlay (Last 2.5s) */}
                  {endingLogo && currentTime >= Math.max(0, totalTimelineDuration - 2.5) && (
                    <div className="absolute inset-0 bg-black z-30 flex items-center justify-center transition-all duration-700">
                      <img src={endingLogo.previewUrl} alt="Ending Dissolve Logo" className="w-full h-full object-cover" />
                      <span className="absolute bottom-4 text-[10px] bg-black/80 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold">
                        DISSOLVE ENDING SCENE (2.5s)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Render Action Button & Download */}
            <div className="w-full pt-4 space-y-2">
              {renderedVideoUrl ? (
                <div className="space-y-2">
                  <a
                    href={renderedVideoUrl}
                    download="video_fnb_9x16.mp4"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>DOWNLOAD VIDEO MP4 (9:16)</span>
                  </a>

                  <button
                    onClick={() => setViewMode("timeline")}
                    className={`w-full py-2.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                      isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-indigo-600" : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-indigo-400"
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Buka & Edit di Studio Timeline</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleRenderVideo}
                  disabled={isRendering || !audioBlob || footages.length === 0}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white rounded-xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer font-black"
                >
                  {isRendering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{renderProgress || "Memproses Video 9:16..."}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>PROSES & RENDER VIDEO 9:16</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MAIN VIEW 2: PRO STUDIO TIMELINE MODE (SYNCHRONIZED MULTI-TRACK) */
        /* ========================================================================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Inspector Panel */}
            <div className={`w-80 border-r flex flex-col shrink-0 ${cardBg}`}>
              <div className={`flex border-b text-xs font-medium ${isLight ? "bg-slate-100 border-slate-200" : "bg-[#0d1322] border-slate-800"}`}>
                <button
                  onClick={() => setActiveTab("script")}
                  className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    activeTab === "script" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold" : "border-transparent text-slate-400"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Naskah
                </button>
                <button
                  onClick={() => setActiveTab("media")}
                  className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    activeTab === "media" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold" : "border-transparent text-slate-400"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Media ({footages.length})
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {activeTab === "script" && (
                  <div className="space-y-3">
                    <label className={`text-xs font-semibold ${textSub}`}>Naskah Video</label>
                    <textarea
                      rows={6}
                      value={rawScript}
                      onChange={(e) => setRawScript(e.target.value)}
                      className={`w-full text-xs p-3 rounded-xl resize-none ${inputBg}`}
                    />
                    <button
                      onClick={handlePolishScript}
                      disabled={isPolishing || !rawScript.trim()}
                      className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-500 cursor-pointer"
                    >
                      Polish Script AI
                    </button>
                  </div>
                )}

                {activeTab === "media" && (
                  <div className="space-y-3">
                    <label className={`text-xs font-semibold ${textSub}`}>Video Clips ({footages.length})</label>
                    <div className="grid grid-cols-2 gap-2">
                      {footages.map((item, idx) => (
                        <div key={idx} className={`border rounded-lg p-1 ${innerCardBg}`}>
                          <video src={item.previewUrl} className="w-full aspect-video object-cover rounded bg-black" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Center Program Monitor */}
            <div className={`flex-1 flex flex-col items-center justify-between p-4 relative overflow-hidden ${isLight ? "bg-slate-100" : "bg-[#070a12]"}`}>
              <div className={`w-full flex items-center justify-between text-xs px-2 pb-2 ${textSub}`}>
                <span className="font-mono text-indigo-600 dark:text-cyan-400 font-bold">{formatTimecode(currentTime)} / {formatTimecode(totalTimelineDuration)}</span>
              </div>

              <div className="relative h-[calc(100%-80px)] aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl border studio-border">
                {renderedVideoUrl ? (
                  <video ref={videoRef} src={renderedVideoUrl} controls className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full relative bg-slate-950">
                    {footages.length > 0 && (
                      <video
                        ref={previewVideoRef}
                        src={footages[Math.min(Math.floor((currentTime / totalTimelineDuration) * footages.length), footages.length - 1)]?.previewUrl}
                        className="w-full h-full object-cover opacity-80"
                        muted
                        loop
                        playsInline
                      />
                    )}
                  </div>
                )}
              </div>

              <div className={`w-full max-w-md border rounded-xl px-4 py-2 flex items-center justify-between shadow-xl ${isLight ? "bg-white border-slate-200" : "bg-[#0d1322] border-slate-800 text-slate-300"}`}>
                <button onClick={() => setIsPlaying(!isPlaying)} className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center cursor-pointer shadow-md">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <span className="font-mono text-xs font-bold text-slate-500">{formatTimecode(currentTime)}</span>
              </div>
            </div>
          </div>

          {/* Bottom Timeline Tracks (SYNCHRONIZED TIMELINE SCRUBBER) */}
          <div className={`h-52 border-t flex flex-col shrink-0 ${cardBg}`}>
            <div className={`h-8 border-b px-4 flex items-center justify-between text-xs ${isLight ? "bg-slate-100 border-slate-200" : "bg-[#0d1322] border-slate-800"}`}>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">STUDIO TIMELINE TRACKS</span>
              <span className="font-mono text-[10px] text-slate-400">Klik & Geser Jarum Timeline untuk Scrubbing</span>
            </div>

            <div className="flex-1 flex relative overflow-x-auto">
              {/* Track Headers */}
              <div className={`w-28 border-r flex flex-col shrink-0 text-[11px] font-mono ${isLight ? "bg-slate-100 border-slate-200" : "bg-[#0d1322] border-slate-800"}`}>
                <div className="h-8 border-b px-2 flex items-center text-purple-600 dark:text-purple-400 font-bold">CC (Text)</div>
                <div className="h-8 border-b px-2 flex items-center text-indigo-600 dark:text-indigo-400 font-bold">V1 (Video)</div>
                <div className="h-8 border-b px-2 flex items-center text-emerald-600 dark:text-emerald-400 font-bold">A1 (Voice)</div>
                <div className="h-8 border-b px-2 flex items-center text-pink-600 dark:text-pink-400 font-bold">A2 (BGM)</div>
              </div>

              {/* Synchronized Tracks Area */}
              <div
                className={`flex-1 relative min-w-[800px] ${isLight ? "bg-slate-50" : "bg-[#070a12]"}`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  handleSeek(ratio * totalTimelineDuration);
                }}
              >
                {/* CC Text Subtitle Track */}
                <div className="h-8 border-b border-slate-200 dark:border-slate-800 relative flex items-center px-1">
                  {sentences.map((sent, idx) => (
                    <div key={idx} className="h-6 mx-0.5 bg-purple-500/20 border border-purple-500/40 rounded px-2 text-[10px] truncate text-purple-700 dark:text-purple-300">
                      {sent}
                    </div>
                  ))}
                </div>

                {/* V1 Video Footages Track */}
                <div className="h-8 border-b border-slate-200 dark:border-slate-800 relative flex items-center px-1">
                  {footages.map((item, idx) => (
                    <div key={idx} className="h-6 mx-0.5 bg-indigo-500/20 border border-indigo-500/40 rounded px-2 text-[10px] truncate text-indigo-700 dark:text-indigo-300">
                      {item.file.name}
                    </div>
                  ))}
                </div>

                {/* A1 Voice Over Track */}
                <div className="h-8 border-b border-slate-200 dark:border-slate-800 relative flex items-center px-1">
                  {audioUrl && <div className="h-6 w-full bg-emerald-500/20 border border-emerald-500/40 rounded px-2 text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">Voice Over Zephyr ({audioDuration.toFixed(1)}s)</div>}
                </div>

                {/* A2 BGM Audio Track */}
                <div className="h-8 border-b border-slate-200 dark:border-slate-800 relative flex items-center px-1">
                  {bgm && <div className="h-6 w-full bg-pink-500/20 border border-pink-500/40 rounded px-2 text-[10px] text-pink-700 dark:text-pink-300 font-bold">{bgm.name}</div>}
                </div>

                {/* Playhead Scrubber Needle */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-md z-30 pointer-events-none"
                  style={{ left: `${(currentTime / totalTimelineDuration) * 100}%` }}
                >
                  <div className="w-3 h-3 -ml-1.25 bg-rose-500 rotate-45 rounded-sm shadow-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Audio Elements for Preview Sync */}
      {audioUrl && (
        <audio
          ref={audioPreviewRef}
          src={audioUrl}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}
      {bgmUrl && (
        <audio
          ref={bgmAudioRef}
          src={bgmUrl}
          loop
        />
      )}
    </main>
  );
}
