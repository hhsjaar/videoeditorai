"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Film,
  Upload,
  Sparkles,
  Music,
  Sliders,
  Play,
  Volume2,
  VolumeX,
  RefreshCw,
  Download,
  Trash2,
  Plus,
  Wand2,
  Mic,
  Settings,
  Layers,
  Type,
  Video as VideoIcon,
  Bot,
  Scissors,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Sun,
  Moon,
  Zap,
  Info,
  Maximize2,
  Clock,
  LayoutGrid,
  Sparkle,
  Copy,
  Split,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { MainCompositionProps, FootageItem, TransitionItem, SubtitleChunk } from "../remotion/types";

const RemotionPlayerWrapper = dynamic(
  () => import("../components/RemotionPlayerWrapper").then((m) => m.RemotionPlayerWrapper),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-xs font-bold animate-pulse">Loading Studio Player...</div> }
);

interface UploadedFootage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  duration: number;
}

const AVAILABLE_TRANSITIONS = [
  { id: "light-leak", title: "✨ Light Leak", desc: "Warm Golden Light Sweep", category: "Light & Flare" },
  { id: "film-burn", title: "🔥 Film Burn", desc: "Retro Orange Burn Flare", category: "Light & Flare" },
  { id: "passerby", title: "💫 Passerby", desc: "Anamorphic Streak Sweep", category: "Light & Flare" },
  { id: "lens-flare", title: "🌌 Lens Flare", desc: "Cyan Radial Glow", category: "Light & Flare" },
  { id: "flash-white", title: "⚡ Flash White", desc: "High-Energy Flash", category: "Flash" },
  { id: "fade-black", title: "🎬 Fade Black", desc: "Dramatic Cinematic Fade", category: "Fade" },
  { id: "zoom-blur", title: "🔍 Zoom Blur", desc: "Impact Scale & Motion Blur", category: "Motion" },
  { id: "glitch", title: "🤖 Glitch", desc: "Cyber Scanlines RGB", category: "Cyber" },
  { id: "iris-circle", title: "⭕ Iris Circle", desc: "Radial Circular Wipe", category: "Mask" },
  { id: "wipe-horizontal", title: "↔️ Wipe Horizontal", desc: "Smooth Side Slide", category: "Wipe" },
  { id: "wipe-diagonal", title: "↗️ Wipe Diagonal", desc: "Dynamic Polygon Slash", category: "Wipe" },
  { id: "vignette", title: "🎭 Color Split", desc: "Vibrant Vignette Flare", category: "Color" },
];

export default function AutoVideoEditorStudio() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState<"media" | "script" | "transitions" | "bgm" | "style" | "copilot">("media");

  // Footages state
  const [footages, setFootages] = useState<UploadedFootage[]>([]);
  const [clipDuration, setClipDuration] = useState<number>(3.0);
  const [customClipDurations, setCustomClipDurations] = useState<{ [key: number]: number }>({});
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);

  // Playhead & Scrubber state
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const timelineRulerRef = useRef<HTMLDivElement>(null);

  // Script & Voice state
  const [rawScript, setRawScript] = useState<string>("");
  const [polishedScript, setPolishedScript] = useState<string>("");
  const [isPolishing, setIsPolishing] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("Zephyr");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Transitions state
  const [transitionsMap, setTransitionsMap] = useState<{ [afterIndex: number]: string }>({});

  // BGM state
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState<number>(0.2);
  const [isSelectingBgm, setIsSelectingBgm] = useState<boolean>(false);

  // Style state
  const [editingStyle, setEditingStyle] = useState<string>("fast-viral");
  const [subtitleStyle, setSubtitleStyle] = useState<string>("plain-shadow");

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);

  // AI Copilot state
  const [copilotMessages, setCopilotMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Halo! Saya Copilot Studio AI Anda. Ada yang bisa saya bantu untuk memodifikasi video atau memilih transisi sinematik hari ini?" },
  ]);
  const [copilotInput, setCopilotInput] = useState<string>("");
  const [isCopilotThinking, setIsCopilotThinking] = useState<boolean>(false);

  // Handle Footage Upload
  const handleFootageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newFootages: UploadedFootage[] = files.map((file, idx) => ({
      id: `${Date.now()}_${idx}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      duration: clipDuration,
    }));
    setFootages((prev) => [...prev, ...newFootages]);
  };

  const removeFootage = (id: string) => {
    setFootages((prev) => prev.filter((f) => f.id !== id));
  };

  // Split Footage Cut (Gunting ✂️) at Playhead Position
  const handleSplitClipAtPlayhead = () => {
    if (footages.length === 0) return alert("Upload klip video terlebih dahulu!");

    // Calculate which clip the playhead is currently inside
    let acc = 0;
    let targetIndex = -1;
    let timeInsideClip = 0;

    for (let i = 0; i < footages.length; i++) {
      const dur = customClipDurations[i] || clipDuration;
      if (currentTimeSec >= acc && currentTimeSec <= acc + dur) {
        targetIndex = i;
        timeInsideClip = currentTimeSec - acc;
        break;
      }
      acc += dur;
    }

    if (targetIndex === -1 || timeInsideClip < 0.4) {
      return alert("Posisikan jarum playhead (merah) di tengah klip yang ingin dipotong!");
    }

    const targetClip = footages[targetIndex];
    const originalDur = customClipDurations[targetIndex] || clipDuration;
    const part1Dur = Math.max(0.5, parseFloat(timeInsideClip.toFixed(1)));
    const part2Dur = Math.max(0.5, parseFloat((originalDur - part1Dur).toFixed(1)));

    const part2Clip: UploadedFootage = {
      id: `${Date.now()}_split`,
      file: targetClip.file,
      previewUrl: targetClip.previewUrl,
      name: `${targetClip.name} (Part 2)`,
      duration: part2Dur,
    };

    // Update footages array and duration maps
    const updatedFootages = [...footages];
    updatedFootages.splice(targetIndex + 1, 0, part2Clip);

    const newDurMap: { [key: number]: number } = {};
    updatedFootages.forEach((_, idx) => {
      if (idx < targetIndex) newDurMap[idx] = customClipDurations[idx] || clipDuration;
      else if (idx === targetIndex) newDurMap[idx] = part1Dur;
      else if (idx === targetIndex + 1) newDurMap[idx] = part2Dur;
      else newDurMap[idx] = customClipDurations[idx - 1] || clipDuration;
    });

    setFootages(updatedFootages);
    setCustomClipDurations(newDurMap);
  };

  // Apply Transition Card to Playhead / Nearest Clip Boundary or All Clips
  const applyTransitionToPlayhead = (transitionId: string) => {
    if (footages.length <= 1) return alert("Upload minimal 2 klip video untuk memasang transisi!");

    // Find nearest clip boundary to current playhead time
    let acc = 0;
    let nearestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < footages.length - 1; i++) {
      const dur = customClipDurations[i] || clipDuration;
      acc += dur;
      const diff = Math.abs(currentTimeSec - acc);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIndex = i;
      }
    }

    setTransitionsMap((prev) => ({ ...prev, [nearestIndex]: transitionId }));
  };

  const applyTransitionToAllClips = (transitionId: string) => {
    if (footages.length <= 1) return alert("Upload minimal 2 klip video untuk memasang transisi!");

    const newMap: { [afterIdx: number]: string } = {};
    for (let i = 0; i < footages.length - 1; i++) {
      newMap[i] = transitionId;
    }
    setTransitionsMap(newMap);
  };

  // Polish Script API
  const handlePolishScript = async () => {
    if (!rawScript.trim()) return alert("Masukkan naskah terlebih dahulu!");
    setIsPolishing(true);
    try {
      const res = await fetch("/api/polish-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: rawScript }),
      });
      const data = await res.json();
      if (data.polished) {
        setPolishedScript(data.polished);
      } else {
        alert(data.error || "Gagal poles naskah.");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsPolishing(false);
    }
  };

  // Generate VO API
  const handleGenerateAudio = async () => {
    const text = polishedScript || rawScript;
    if (!text.trim()) return alert("Tuliskan naskah terlebih dahulu!");
    setIsGeneratingAudio(true);
    try {
      const res = await fetch("/api/generate-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: selectedVoice }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      const blob = await res.blob();
      const file = new File([blob], "voiceover.wav", { type: "audio/wav" });
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Select BGM API
  const handleAutoBgm = async () => {
    setIsSelectingBgm(true);
    try {
      const res = await fetch("/api/select-bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: polishedScript || rawScript, mood: editingStyle }),
      });
      const data = await res.json();
      if (data.track && data.track.url) {
        setBgmUrl(data.track.url);
      } else {
        alert("BGM berhasil disesuaikan secara otomatis.");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSelectingBgm(false);
    }
  };

  // Render Export Video API
  const handleExportVideo = async () => {
    if (footages.length === 0) return alert("Upload minimal 1 klip video!");
    setIsExporting(true);
    setExportProgress(15);

    try {
      const formData = new FormData();
      footages.forEach((f) => formData.append("footages", f.file));
      if (audioFile) formData.append("voiceOver", audioFile);
      if (bgmFile) formData.append("bgm", bgmFile);

      formData.append("subtitleText", polishedScript || rawScript);
      formData.append("editingStyle", editingStyle);
      formData.append("subtitleStyle", subtitleStyle);
      formData.append("bgmVolume", bgmVolume.toString());
      formData.append("clipDuration", clipDuration.toString());

      const transitionsList: TransitionItem[] = [];
      Object.keys(transitionsMap).forEach((afterIdx) => {
        transitionsList.push({
          type: transitionsMap[parseInt(afterIdx)],
          afterClipIndex: parseInt(afterIdx),
          duration: 0.8,
        });
      });
      formData.append("transitions", JSON.stringify(transitionsList));

      const customDurationsList = footages.map((_, idx) => customClipDurations[idx] || clipDuration);
      formData.append("clipDurations", JSON.stringify(customDurationsList));

      setExportProgress(45);

      const res = await fetch("/api/render-video", {
        method: "POST",
        body: formData,
      });

      setExportProgress(85);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal mengekspor video.");
      }

      const blob = await res.blob();
      const videoObjectUrl = URL.createObjectURL(blob);
      setExportedVideoUrl(videoObjectUrl);
      setExportProgress(100);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate Remotion Composition Props for real-time player preview
  const previewFootages: FootageItem[] = footages.map((f, idx) => ({
    url: f.previewUrl,
    duration: customClipDurations[idx] || clipDuration,
    colorGrade: editingStyle,
  }));

  const previewTransitions: TransitionItem[] = Object.keys(transitionsMap).map((afterIdx) => ({
    type: transitionsMap[parseInt(afterIdx)],
    afterClipIndex: parseInt(afterIdx),
    duration: 0.8,
  }));

  // Word-accurate 2-3 word subtitle chunks matching human speech pace (~3.2 words/sec)
  const textToSplit = polishedScript || rawScript;
  const words = textToSplit.replace(/[.!?\n]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const textChunks: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    textChunks.push(words.slice(i, i + 3).join(" "));
  }

  const totalVideoDurationSec = previewFootages.reduce((acc, f) => acc + f.duration, 0) || 10;
  const chunkDurSec = totalVideoDurationSec / Math.max(1, textChunks.length);
  const previewSubtitles: SubtitleChunk[] = textChunks.map((chunkText, i) => ({
    text: chunkText,
    start: i * chunkDurSec,
    end: (i + 1) * chunkDurSec,
  }));

  const remotionCompositionProps: MainCompositionProps = {
    footages: previewFootages,
    transitions: previewTransitions,
    subtitles: previewSubtitles,
    voiceOverUrl: audioUrl || undefined,
    bgmUrl: bgmUrl || undefined,
    bgmVolume: bgmVolume,
    subtitleStyle: subtitleStyle,
    clipDuration: clipDuration,
  };

  const totalFrames = Math.max(60, Math.round(totalVideoDurationSec * 60));

  // Dynamic Theme Classes
  const bgClass = isDark ? "bg-[#070A11] text-slate-100" : "bg-slate-50 text-slate-800";
  const panelClass = isDark ? "bg-[#0E1422]/95 border-[#1C263B]" : "bg-white border-slate-200 shadow-sm";
  const borderClass = isDark ? "border-[#1C263B]" : "border-slate-200";
  const textSub = isDark ? "text-slate-400" : "text-slate-500";
  const inputClass = isDark ? "bg-[#0A0E18] border-[#1C263B] text-slate-100 focus:border-indigo-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500";

  // Format timecode (e.g. 00:02.5)
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    return `${mins.toString().padStart(2, "0")}:${secs.padStart(4, "0")}`;
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans select-none transition-colors duration-200 ${bgClass}`}>
      {/* 1. TOP HEADER BAR */}
      <header className={`h-14 px-4 border-b flex items-center justify-between z-40 ${panelClass}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-black tracking-wide uppercase bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Auto Video Studio Pro</h1>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">REMOTION 60FPS</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">9:16 CapCut Studio • Multi-Track Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isDark ? "bg-[#0A0E18] border-slate-800 text-slate-300 hover:bg-slate-800" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"}`}
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
          </button>

          <button
            onClick={handleExportVideo}
            disabled={isExporting}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Download className="w-4 h-4 text-white" />}
            <span>Export Full HD MP4</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN STUDIO WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT TAB NAVIGATION SIDEBAR */}
        <div className={`w-16 border-r flex flex-col items-center py-3 gap-3 z-30 ${panelClass}`}>
          {[
            { id: "media", label: "Media", icon: VideoIcon },
            { id: "script", label: "Script & VO", icon: Type },
            { id: "transitions", label: "Transitions", icon: Layers },
            { id: "bgm", label: "Audio BGM", icon: Music },
            { id: "style", label: "Filters", icon: Sliders },
            { id: "copilot", label: "AI Copilot", icon: Bot },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold"
                    : isDark
                    ? "text-slate-400 hover:bg-[#1C263B] hover:text-slate-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title={tab.label}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] leading-none font-medium">{tab.label}</span>
                {isActive && <div className="absolute right-0 top-2 bottom-2 w-1 bg-indigo-400 rounded-l-full" />}
              </button>
            );
          })}
        </div>

        {/* LEFT CONTROL PANEL (TAB CONTENT) */}
        <div className={`w-80 border-r flex flex-col overflow-y-auto p-4 gap-4 z-20 ${panelClass}`}>
          {/* TAB 1: MEDIA ASSETS */}
          {activeTab === "media" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold flex items-center gap-2">
                  <VideoIcon className="w-4 h-4 text-indigo-400" /> Upload Footages ({footages.length})
                </h2>
              </div>

              <label className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDark ? "border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-950/20" : "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50"}`}>
                <Upload className="w-6 h-6 text-indigo-400 mb-1.5" />
                <span className="text-xs font-bold text-indigo-400">Pilih Klip Video</span>
                <span className="text-[10px] text-slate-400 mt-0.5">MP4 / MOV (Vertikal 9:16)</span>
                <input type="file" multiple accept="video/*" onChange={handleFootageUpload} className="hidden" />
              </label>

              {/* FOOTAGES LIST */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Daftar Klip ({footages.length}):</span>
                {footages.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic text-center py-4">Belum ada klip yang diupload</p>
                ) : (
                  footages.map((clip, idx) => (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipIndex(idx)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        selectedClipIndex === idx ? "border-indigo-500 bg-indigo-950/30" : inputClass
                      }`}
                    >
                      <div className="w-12 h-16 rounded-lg bg-black overflow-hidden relative flex-shrink-0">
                        <video src={clip.previewUrl} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[8px] font-extrabold bg-black/80 text-white px-1 rounded">#{idx + 1}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{clip.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400">Durasi:</span>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="15"
                            value={customClipDurations[idx] || clipDuration}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 3;
                              setCustomClipDurations((prev) => ({ ...prev, [idx]: val }));
                            }}
                            className="w-12 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-center font-bold"
                          />
                          <span className="text-[10px] text-slate-400">s</span>
                        </div>
                      </div>

                      <button onClick={(e) => { e.stopPropagation(); removeFootage(clip.id); }} className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-950/30 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SCRIPT & VOICE OVER */}
          {activeTab === "script" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold flex items-center gap-2">
                  <Type className="w-4 h-4 text-indigo-400" /> Script & Voice Over AI
                </h2>
                <button onClick={handlePolishScript} disabled={isPolishing} className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1 cursor-pointer">
                  {isPolishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 text-purple-300" />} Polish AI
                </button>
              </div>

              {/* VOICE PILLS SELECTOR */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400">Pilih Karakter Suara AI:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "Zephyr", label: "👩 Zephyr", desc: "Smooth" },
                    { id: "Puck", label: "👨 Puck", desc: "Santai" },
                    { id: "Charon", label: "🧔 Charon", desc: "Wibawa" },
                    { id: "Kore", label: "👧 Kore", desc: "Jernih" },
                    { id: "Fenrir", label: "🦁 Fenrir", desc: "Enerjik" },
                    { id: "Aoede", label: "🎭 Aoede", desc: "Warm" },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVoice(v.id)}
                      className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-left ${
                        selectedVoice === v.id ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30" : `${inputClass} opacity-70 hover:opacity-100`
                      }`}
                    >
                      <div className="truncate">{v.label}</div>
                      <div className="text-[8px] font-normal opacity-80">{v.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={5}
                placeholder="Masukkan naskah promosi Anda di sini..."
                value={rawScript}
                onChange={(e) => setRawScript(e.target.value)}
                className={`w-full text-xs p-3 rounded-xl resize-none ${inputClass}`}
              />

              {polishedScript && (
                <div className="p-3 rounded-xl text-xs border border-indigo-500/30 bg-indigo-950/20 text-indigo-200 space-y-1">
                  <div className="flex justify-between font-bold text-[10px] text-indigo-400">
                    <span>Hasil Polish AI:</span>
                    <button onClick={() => setRawScript(polishedScript)} className="hover:underline cursor-pointer">Gunakan</button>
                  </div>
                  <p className="text-[11px] leading-relaxed">{polishedScript}</p>
                </div>
              )}

              <button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4 text-amber-300" />}
                <span>Generate Voice Over ({selectedVoice})</span>
              </button>

              {audioUrl && (
                <div className={`p-3 rounded-xl border space-y-1.5 ${inputClass}`}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-emerald-400 flex items-center gap-1 text-[10px]"><CheckCircle2 className="w-3.5 h-3.5" /> Voice Over Tersimpan</span>
                  </div>
                  <audio src={audioUrl} controls className="w-full h-8" />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SMART TRANSITIONS CARD LIBRARY (DRAG & DROP / PLAYHEAD APPLY) */}
          {activeTab === "transitions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" /> Library Transisi Sinematik
                </h2>
              </div>

              <div className="p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-950/20 text-[10px] text-indigo-300 leading-relaxed">
                💡 Klik kartu transisi untuk langsung memasangnya pada **jarum playhead (merah)** atau pasang ke semua klip sekaligus!
              </div>

              {/* TRANSITIONS CARDS GRID */}
              <div className="grid grid-cols-1 gap-2">
                {AVAILABLE_TRANSITIONS.map((t) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${inputClass} hover:border-indigo-500 hover:scale-[1.01]`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">{t.title}</h4>
                      <p className="text-[9px] text-slate-400 mt-0.5">{t.desc}</p>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => applyTransitionToPlayhead(t.id)}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-bold cursor-pointer shadow-sm"
                        title="Pasang di Jarum Playhead Terdekat"
                      >
                        + Jarum
                      </button>
                      <button
                        onClick={() => applyTransitionToAllClips(t.id)}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[9px] font-bold cursor-pointer shadow-sm"
                        title="Pasang ke Semua Klip"
                      >
                        + Semua
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIO BGM */}
          {activeTab === "bgm" && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold flex items-center gap-2">
                <Music className="w-4 h-4 text-indigo-400" /> Background Music (BGM)
              </h2>

              <button
                onClick={handleAutoBgm}
                disabled={isSelectingBgm}
                className="w-full py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSelectingBgm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkle className="w-4 h-4 text-amber-400" />}
                <span>Pilih BGM Otomatis AI</span>
              </button>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400">Atur Volume Musik BGM:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold w-10 text-right">{Math.round(bgmVolume * 100)}%</span>
                </div>
              </div>

              {bgmUrl && <audio src={bgmUrl} controls className="w-full h-8" />}
            </div>
          )}

          {/* TAB 5: BOLD COLOR FILTERS & SUBTITLE STYLE */}
          {activeTab === "style" && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" /> Bold Color Filters & Subtitles
              </h2>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter Pewarnaan Visual (Color Grading):</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "fast-viral", name: "🔥 Fast Viral", desc: "Vibrant Pop" },
                    { id: "cinematic-aesthetic", name: "🎬 Filmic Teal & Orange", desc: "Deep Film" },
                    { id: "moody-lowsat", name: "🖤 Moody Low-Sat", desc: "Low Saturation" },
                    { id: "vintage-gold", name: "🌇 Vintage Warm Gold", desc: "Golden Hour" },
                    { id: "brand-commercial", name: "💼 Commercial Clean", desc: "High Clarity" },
                    { id: "soft-sweet", name: "🌸 Soft Sweet", desc: "Pastel Dream" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setEditingStyle(preset.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                        editingStyle === preset.id ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30" : `${inputClass} opacity-70 hover:opacity-100`
                      }`}
                    >
                      <div className="truncate">{preset.name}</div>
                      <div className="text-[8px] font-normal opacity-75 mt-0.5">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gaya Teks Subtitle (Caption):</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "plain-shadow", name: "✨ Plain Shadow" },
                    { id: "yellow", name: "🟨 Yellow Box" },
                    { id: "neon", name: "🟦 Neon Glow" },
                    { id: "box", name: "⬛ Dark Box" },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setSubtitleStyle(sub.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                        subtitleStyle === sub.id ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30" : `${inputClass} opacity-70 hover:opacity-100`
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AI COPILOT */}
          {activeTab === "copilot" && (
            <div className="space-y-3 flex flex-col h-full">
              <h2 className="text-xs font-bold flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" /> AI Copilot Studio Assistant
              </h2>
              <div className="flex-1 border rounded-xl p-3 overflow-y-auto space-y-2.5 text-xs bg-black/40 border-slate-800">
                {copilotMessages.map((msg, idx) => (
                  <div key={idx} className={`p-2.5 rounded-xl ${msg.role === "assistant" ? "bg-indigo-950/40 text-indigo-200 border border-indigo-500/20" : "bg-slate-800 text-slate-100 ml-4"}`}>
                    {msg.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Tanyakan rekomendasi gaya..."
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  className={`flex-1 text-xs p-2.5 rounded-xl ${inputClass}`}
                />
                <button
                  onClick={async () => {
                    if (!copilotInput.trim()) return;
                    const txt = copilotInput;
                    setCopilotInput("");
                    setCopilotMessages((prev) => [...prev, { role: "user", text: txt }]);
                    setIsCopilotThinking(true);
                    try {
                      const res = await fetch("/api/ai-copilot", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt: txt }),
                      });
                      const data = await res.json();
                      setCopilotMessages((prev) => [...prev, { role: "assistant", text: data.reply || data.message || "Saya siap membantu memodifikasi video Anda!" }]);
                    } catch (e: any) {
                      setCopilotMessages((prev) => [...prev, { role: "assistant", text: "Maaf, terjadi kesalahan koneksi." }]);
                    } finally {
                      setIsCopilotThinking(false);
                    }
                  }}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer text-xs"
                >
                  Kirim
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CENTER PROGRAM MONITOR (REMOTION PLAYER CANVAS) */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden relative">
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div className="w-[340px] h-[600px] max-h-full aspect-[9/16] relative flex items-center justify-center">
              <RemotionPlayerWrapper props={remotionCompositionProps} durationInFrames={totalFrames} />
            </div>
          </div>

          {/* BOTTOM MULTI-TRACK STUDIO TIMELINE (CAPCUT STYLE WITH THUMBNAILS, SCRUBBER PLAYHEAD & SPLIT CUT) */}
          <div className={`h-52 border rounded-2xl p-3 flex flex-col gap-2.5 overflow-hidden ${panelClass}`}>
            {/* TIMELINE TOOLBAR & RULER HEADER */}
            <div className="flex items-center justify-between border-b pb-2 border-slate-800 text-[10px] text-slate-400 font-extrabold">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSplitClipAtPlayhead}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center gap-1.5 text-[10px] font-extrabold cursor-pointer shadow-md shadow-rose-600/30"
                  title="Potong Klip di Posisi Jarum Merah"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>SPLIT CUT (GUNTING)</span>
                </button>
                <div className="flex items-center gap-1.5 font-mono text-indigo-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>JARUM PLAYHEAD: {formatTimecode(currentTimeSec)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono">
                <span>TOTAL: {totalVideoDurationSec.toFixed(1)}s</span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-600/30 text-indigo-300">60 FPS</span>
              </div>
            </div>

            {/* SPACIOUS TIMELINE TRACKS CONTAINER WITH RED PLAYHEAD SCRUBBER */}
            <div
              ref={timelineRulerRef}
              onClick={(e) => {
                if (!timelineRulerRef.current) return;
                const rect = timelineRulerRef.current.getBoundingClientRect();
                const clickX = e.clientX - rect.left - 70; // Adjust for track label width
                const trackWidth = rect.width - 70;
                if (trackWidth > 0) {
                  const clickedTime = Math.max(0, Math.min(totalVideoDurationSec, (clickX / trackWidth) * totalVideoDurationSec));
                  setCurrentTimeSec(parseFloat(clickedTime.toFixed(2)));
                }
              }}
              className="flex-1 overflow-x-auto space-y-2 text-[10px] font-bold relative cursor-pointer"
            >
              {/* RED INTERACTIVE PLAYHEAD SCRUBBER LINE */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `calc(70px + ${(currentTimeSec / Math.max(0.1, totalVideoDurationSec)) * 90}%)`,
                  width: "2px",
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 10px rgba(239, 68, 68, 0.9)",
                  zIndex: 40,
                  pointerEvents: "none",
                }}
              >
                <div className="w-3 h-3 rounded-full bg-rose-500 -translate-x-[5px] -translate-y-1 shadow-md border border-white" />
              </div>

              {/* TRACK 1: V1 VIDEO FOOTAGES (WITH THUMBNAILS & TRANSITION BADGES) */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-indigo-400 flex items-center gap-1 text-[9px] font-extrabold"><VideoIcon className="w-3.5 h-3.5" /> V1 Video</span>
                <div className="flex-1 flex items-center gap-1.5 h-12">
                  {footages.length === 0 ? (
                    <div className="h-10 flex-1 bg-slate-900/60 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 italic">Belum ada klip video</div>
                  ) : (
                    footages.map((clip, idx) => (
                      <React.Fragment key={clip.id}>
                        <div
                          onClick={(e) => { e.stopPropagation(); setSelectedClipIndex(idx); }}
                          className={`h-12 px-2 rounded-xl flex items-center gap-2 text-indigo-200 border transition-all cursor-pointer ${
                            selectedClipIndex === idx ? "border-indigo-400 bg-indigo-900/90 shadow-lg shadow-indigo-600/30 scale-[1.02]" : "border-indigo-500/30 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:border-indigo-400"
                          }`}
                        >
                          <div className="w-8 h-10 rounded bg-black overflow-hidden flex-shrink-0 border border-slate-800">
                            <video src={clip.previewUrl} className="w-full h-full object-cover" />
                          </div>
                          <span className="truncate max-w-[80px]">#{idx + 1} {clip.name}</span>
                          <span className="text-[9px] opacity-80 font-mono">({customClipDurations[idx] || clipDuration}s)</span>
                        </div>

                        {idx < footages.length - 1 && (
                          <div
                            onClick={(e) => { e.stopPropagation(); setActiveTab("transitions"); }}
                            className="h-7 px-2 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 rounded-lg text-amber-300 text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                            title={`Transisi: ${transitionsMap[idx] || "light-leak"}`}
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>{transitionsMap[idx] || "light-leak"}</span>
                          </div>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>

              {/* TRACK 2: A1 VOICE OVER TRACK */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-amber-400 flex items-center gap-1 text-[9px] font-extrabold"><Mic className="w-3.5 h-3.5" /> A1 Voice</span>
                <div className="flex-1">
                  {audioUrl ? (
                    <div className="h-7 bg-gradient-to-r from-amber-950/80 to-amber-900/80 border border-amber-500/40 rounded-xl flex items-center px-3 text-amber-200 gap-2 font-bold">
                      <Mic className="w-3.5 h-3.5 text-amber-400" />
                      <span>Voice Over AI ({selectedVoice})</span>
                    </div>
                  ) : (
                    <div className="h-7 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 flex items-center px-3 text-slate-600 italic text-[9px]">Tidak ada Voice Over</div>
                  )}
                </div>
              </div>

              {/* TRACK 3: A2 BGM AUDIO TRACK */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-emerald-400 flex items-center gap-1 text-[9px] font-extrabold"><Music className="w-3.5 h-3.5" /> A2 BGM</span>
                <div className="flex-1">
                  {bgmUrl ? (
                    <div className="h-7 bg-gradient-to-r from-emerald-950/80 to-teal-900/80 border border-emerald-500/40 rounded-xl flex items-center px-3 text-emerald-200 gap-2 font-bold">
                      <Music className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Background Music ({Math.round(bgmVolume * 100)}%)</span>
                    </div>
                  ) : (
                    <div className="h-7 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 flex items-center px-3 text-slate-600 italic text-[9px]">Tanpa Musik BGM</div>
                  )}
                </div>
              </div>

              {/* TRACK 4: T1 SUBTITLES CAPTIONS TRACK */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-purple-400 flex items-center gap-1 text-[9px] font-extrabold"><Type className="w-3.5 h-3.5" /> T1 Captions</span>
                <div className="flex-1">
                  {textChunks.length > 0 ? (
                    <div className="h-7 bg-gradient-to-r from-purple-950/80 to-pink-950/80 border border-purple-500/40 rounded-xl flex items-center px-3 text-purple-200 gap-2 font-bold truncate">
                      <Type className="w-3.5 h-3.5 text-purple-400" />
                      <span className="truncate">{textChunks.length} Subtitle Captions ({subtitleStyle})</span>
                    </div>
                  ) : (
                    <div className="h-7 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 flex items-center px-3 text-slate-600 italic text-[9px]">Tidak ada Teks Captions</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RENDER EXPORT PROGRESS MODAL */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className={`w-96 p-6 rounded-2xl border text-center space-y-4 shadow-2xl ${panelClass}`}>
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 mx-auto flex items-center justify-center animate-bounce">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black">Mengespor Video (Remotion Engine)</h3>
              <p className="text-xs text-slate-400 mt-1">Sedang merender Full HD 60FPS MP4 di server...</p>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400">{exportProgress}% Selesai</span>
          </div>
        </div>
      )}

      {/* EXPORTED VIDEO RESULT MODAL */}
      {exportedVideoUrl && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className={`w-[380px] p-5 rounded-2xl border space-y-4 shadow-2xl ${panelClass}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Video Berhasil Diekspor!
              </h3>
              <button onClick={() => setExportedVideoUrl(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="w-full aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg border border-slate-800">
              <video src={exportedVideoUrl} controls autoPlay className="w-full h-full object-contain" />
            </div>
            <a
              href={exportedVideoUrl}
              download={`AutoVideo_${Date.now()}.mp4`}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" /> Download Video MP4
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
