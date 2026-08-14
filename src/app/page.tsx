"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Film,
  Upload,
  Sparkles,
  Music,
  Sliders,
  Play,
  Pause,
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
  Image as ImageIcon,
  Subtitles,
  Palette,
  Check,
  Grid,
  Copy,
  Clipboard,
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

export default function CapCutWebStudio() {
  const [activeNavTab, setActiveNavTab] = useState<"generate" | "video" | "photo" | "audio" | "text" | "effects" | "caption" | "filter">("video");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");

  // Footages state
  const [footages, setFootages] = useState<UploadedFootage[]>([]);
  const [clipDuration, setClipDuration] = useState<number>(3.0);
  const [customClipDurations, setCustomClipDurations] = useState<{ [key: number]: number }>({});
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const [copiedClip, setCopiedClip] = useState<UploadedFootage | null>(null);

  // Playhead & Scrubber state (Dynamic Frame Sync)
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
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

  // Handle Footage Upload with Native Duration Auto-Detection
  const handleFootageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const loadedFootages: UploadedFootage[] = await Promise.all(
      files.map((file, idx) => {
        return new Promise<UploadedFootage>((resolve) => {
          const previewUrl = URL.createObjectURL(file);
          const tempVid = document.createElement("video");
          tempVid.src = previewUrl;
          tempVid.onloadedmetadata = () => {
            const nativeDur = tempVid.duration && !isNaN(tempVid.duration) && tempVid.duration > 0
              ? parseFloat(tempVid.duration.toFixed(1))
              : clipDuration;
            resolve({
              id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              file,
              previewUrl,
              name: file.name || `VID${(idx + 1).toString().padStart(4, "0")}.mp4`,
              duration: nativeDur,
            });
          };
          tempVid.onerror = () => {
            resolve({
              id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              file,
              previewUrl,
              name: file.name || `VID${(idx + 1).toString().padStart(4, "0")}.mp4`,
              duration: clipDuration,
            });
          };
        });
      })
    );

    setFootages((prev) => {
      const combined = [...prev, ...loadedFootages];
      const newDurMap: { [key: number]: number } = {};
      combined.forEach((f, i) => {
        newDurMap[i] = f.duration;
      });
      setCustomClipDurations(newDurMap);
      return combined;
    });
  };

  const removeFootage = (id: string) => {
    setFootages((prev) => prev.filter((f) => f.id !== id));
  };

  // Split Footage Cut (Gunting ✂️) at Playhead Position
  const handleSplitClipAtPlayhead = useCallback(() => {
    if (footages.length === 0) return alert("Upload klip video terlebih dahulu!");

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
      return alert("Posisikan jarum playhead (merah/putih) di tengah klip yang ingin dipotong!");
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
  }, [footages, customClipDurations, clipDuration, currentTimeSec]);

  // Copy Clip
  const handleCopyClip = useCallback(() => {
    if (selectedClipIndex === null || !footages[selectedClipIndex]) return;
    setCopiedClip(footages[selectedClipIndex]);
  }, [selectedClipIndex, footages]);

  // Paste Clip at Playhead
  const handlePasteClip = useCallback(() => {
    if (!copiedClip) return;
    const pasted: UploadedFootage = {
      ...copiedClip,
      id: `${Date.now()}_copy`,
      name: `${copiedClip.name} (Copy)`,
    };
    setFootages((prev) => [...prev, pasted]);
  }, [copiedClip]);

  // Keyboard Shortcuts (Cmd+X, Cmd+C, Cmd+V, Delete, Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleSplitClipAtPlayhead();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopyClip();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteClip();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipIndex !== null && footages[selectedClipIndex]) {
          removeFootage(footages[selectedClipIndex].id);
          setSelectedClipIndex(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSplitClipAtPlayhead, handleCopyClip, handlePasteClip, selectedClipIndex, footages]);

  // Apply Transition Card to Playhead / Nearest Clip Boundary or All Clips
  const applyTransitionToPlayhead = (transitionId: string) => {
    if (footages.length <= 1) return alert("Upload minimal 2 klip video untuk memasang transisi!");

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

  // Memoize Remotion Composition Props to prevent @remotion/player re-initialization loops during playback
  const previewFootages: FootageItem[] = useMemo(() => {
    return footages.map((f, idx) => ({
      url: f.previewUrl,
      duration: customClipDurations[idx] || clipDuration,
      colorGrade: editingStyle,
    }));
  }, [footages, customClipDurations, clipDuration, editingStyle]);

  const previewTransitions: TransitionItem[] = useMemo(() => {
    return Object.keys(transitionsMap).map((afterIdx) => ({
      type: transitionsMap[parseInt(afterIdx)],
      afterClipIndex: parseInt(afterIdx),
      duration: 0.8,
    }));
  }, [transitionsMap]);

  const textToSplit = polishedScript || rawScript;
  const textChunks: string[] = useMemo(() => {
    const w = textToSplit.replace(/[.!?\n]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < w.length; i += 3) {
      chunks.push(w.slice(i, i + 3).join(" "));
    }
    return chunks;
  }, [textToSplit]);

  const totalVideoDurationSec = useMemo(() => {
    return previewFootages.reduce((acc, f) => acc + f.duration, 0) || 10;
  }, [previewFootages]);

  const previewSubtitles: SubtitleChunk[] = useMemo(() => {
    const chunkDurSec = totalVideoDurationSec / Math.max(1, textChunks.length);
    return textChunks.map((chunkText, i) => ({
      text: chunkText,
      start: i * chunkDurSec,
      end: (i + 1) * chunkDurSec,
    }));
  }, [textChunks, totalVideoDurationSec]);

  const remotionCompositionProps: MainCompositionProps = useMemo(() => ({
    footages: previewFootages,
    transitions: previewTransitions,
    subtitles: previewSubtitles,
    voiceOverUrl: audioUrl || undefined,
    bgmUrl: bgmUrl || undefined,
    bgmVolume: bgmVolume,
    subtitleStyle: subtitleStyle,
    clipDuration: clipDuration,
  }), [
    previewFootages,
    previewTransitions,
    previewSubtitles,
    audioUrl,
    bgmUrl,
    bgmVolume,
    subtitleStyle,
    clipDuration,
  ]);

  // EXACT TOTAL DURATION IN FRAMES TO PREVENT EXTRA BLACK FRAMES OR LOOP GLITCHING
  const totalFrames = Math.max(60, Math.round(totalVideoDurationSec * 60));

  // Player frame update callback for smooth playhead tracking
  const handlePlayerFrameUpdate = useCallback((frame: number) => {
    const sec = frame / 60;
    setCurrentTimeSec(parseFloat(sec.toFixed(2)));
  }, []);

  // Format timecode display (e.g. 00:04 / 01:44)
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(0);
    return `${mins.toString().padStart(2, "0")}:${secs.padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121215] text-slate-100 font-sans select-none overflow-hidden">
      {/* MAIN TOP SECTION: LEFT NAV + SECONDARY PANEL + RIGHT PROGRAM MONITOR */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. LEFT-MOST SLIM ICON NAVIGATION BAR */}
        <div className="w-16 bg-[#18181c] border-r border-[#27272a] flex flex-col items-center py-4 gap-4 z-40">
          {[
            { id: "generate", label: "Generate", icon: Sparkles },
            { id: "video", label: "Video", icon: VideoIcon },
            { id: "photo", label: "Photo", icon: ImageIcon },
            { id: "audio", label: "Audio", icon: Music },
            { id: "text", label: "Text", icon: Type },
            { id: "effects", label: "Effects", icon: Layers },
            { id: "caption", label: "Caption", icon: Subtitles },
            { id: "filter", label: "Filter", icon: Sliders },
          ].map((nav) => {
            const Icon = nav.icon;
            const isActive = activeNavTab === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => setActiveNavTab(nav.id as any)}
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
                  isActive
                    ? "bg-[#27272a] text-white font-bold border border-[#3f3f46] shadow-md"
                    : "text-slate-400 hover:bg-[#27272a]/50 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] leading-none">{nav.label}</span>
                {isActive && <div className="absolute right-0 top-3 bottom-3 w-1 bg-white rounded-l-full" />}
              </button>
            );
          })}
        </div>

        {/* 2. SECONDARY MEDIA ASSET PANEL (GRID OF VIDEOS) */}
        <div className="w-80 bg-[#18181c] border-r border-[#27272a] flex flex-col overflow-hidden z-30">
          {/* HEADER BAR FOR MEDIA GRID */}
          <div className="p-3 border-b border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded-lg hover:bg-[#27272a] text-slate-300">
                <Grid className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-[#27272a] text-slate-300">
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            <label className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border border-[#3f3f46]">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
              <input type="file" multiple accept="video/*" onChange={handleFootageUpload} className="hidden" />
            </label>
          </div>

          {/* TAB CONTENT DETAILS */}
          <div className="flex-1 p-3 overflow-y-auto space-y-4">
            {activeNavTab === "video" && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-300 flex justify-between items-center">
                  <span>Daftar Klip Video ({footages.length})</span>
                  <span className="text-[10px] text-slate-400">MP4 / MOV</span>
                </div>

                {footages.length === 0 ? (
                  <div className="border-2 border-dashed border-[#27272a] rounded-xl p-8 text-center space-y-2">
                    <VideoIcon className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-400 font-bold">Belum ada klip yang diupload</p>
                    <p className="text-[10px] text-slate-500">Klik tombol Upload di atas untuk memilih file video Anda</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {footages.map((clip, idx) => (
                      <div
                        key={clip.id}
                        onClick={() => setSelectedClipIndex(idx)}
                        className={`rounded-xl overflow-hidden border bg-[#09090b] relative group cursor-pointer transition-all ${
                          selectedClipIndex === idx ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-[#27272a] hover:border-slate-500"
                        }`}
                      >
                        <div className="w-full aspect-video bg-black relative overflow-hidden">
                          <video src={clip.previewUrl} className="w-full h-full object-cover" />
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded bg-black/60 border border-white/40 flex items-center justify-center">
                            {selectedClipIndex === idx && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-200 truncate">{clip.name}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFootage(clip.id);
                            }}
                            className="text-rose-400 hover:text-rose-300 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SCRIPT & VOICE */}
            {(activeNavTab === "generate" || activeNavTab === "text") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Script & Voice Over AI</span>
                  <button onClick={handlePolishScript} disabled={isPolishing} className="px-2 py-1 text-[9px] bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold">
                    {isPolishing ? "Polishing..." : "Polish AI"}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Masukkan naskah video Anda di sini..."
                  value={rawScript}
                  onChange={(e) => setRawScript(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] text-slate-100 resize-none"
                />
                <button
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio}
                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold"
                >
                  {isGeneratingAudio ? "Membuat Suara AI..." : `Generate Voice Over (${selectedVoice})`}
                </button>
              </div>
            )}

            {/* TAB: EFFECTS & TRANSITIONS */}
            {activeNavTab === "effects" && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300">Library Transisi Sinematik</span>
                <div className="space-y-1.5">
                  {AVAILABLE_TRANSITIONS.map((t) => (
                    <div key={t.id} className="p-2 rounded-xl bg-[#09090b] border border-[#27272a] flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-200">{t.title}</p>
                        <p className="text-[9px] text-slate-400">{t.desc}</p>
                      </div>
                      <button onClick={() => applyTransitionToPlayhead(t.id)} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9px] font-bold">
                        + Jarum
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. RIGHT PROGRAM MONITOR CANVAS (EXACT CAPCUT LAYOUT) */}
        <div className="flex-1 bg-[#121215] flex flex-col justify-between p-4 overflow-hidden relative">
          {/* ASPECT RATIO SELECTOR TOP BAR */}
          <div className="flex items-center justify-end gap-2 z-20">
            <div className="flex items-center gap-1 bg-[#18181c] border border-[#27272a] rounded-lg px-2.5 py-1 text-xs font-bold">
              <span className="text-slate-400">Aspect Ratio:</span>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value="9:16">9:16 Vertical (Shorts/Reels)</option>
                <option value="16:9">16:9 Landscape</option>
                <option value="1:1">1:1 Square</option>
              </select>
            </div>
            <button
              onClick={handleExportVideo}
              disabled={isExporting}
              className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
            >
              Export MP4
            </button>
          </div>

          {/* MAIN CENTER DISPLAY CANVAS */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden my-2">
            <div
              className={`max-h-full relative flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden border border-[#27272a] bg-black ${
                aspectRatio === "9:16" ? "w-[330px] h-[580px] aspect-[9/16]" : aspectRatio === "16:9" ? "w-[600px] h-[337px] aspect-[16/9]" : "w-[400px] h-[400px] aspect-square"
              }`}
            >
              <RemotionPlayerWrapper
                props={remotionCompositionProps}
                durationInFrames={totalFrames}
                onFrameUpdate={handlePlayerFrameUpdate}
                seekToSec={seekToSec}
              />
            </div>
          </div>

          {/* BOTTOM PLAYER CONTROL BAR */}
          <div className="h-10 bg-[#18181c] border border-[#27272a] rounded-xl px-4 flex items-center justify-between text-xs font-bold text-slate-300">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-slate-400 cursor-pointer hover:text-white" />
              <span className="font-mono text-slate-200">
                {formatTimecode(currentTimeSec)} / {formatTimecode(totalVideoDurationSec)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 font-mono">SHORTCUTS: CMD+X (SPLIT) | CMD+C (COPY) | CMD+V (PASTE)</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">LIVE SYNC READY</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM SPACIOUS & PROPORTIONAL MULTI-TRACK TIMELINE (h-80 SPANNING CENTER & RIGHT) */}
      <div className="h-80 bg-[#18181c] border-t border-[#27272a] flex flex-col overflow-hidden z-30 relative">
        {/* FULL HEIGHT WHITE PLAYHEAD LINE DROP DOWN THROUGH ENTIRE TIMELINE (100% HEIGHT) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `calc(100px + ${(currentTimeSec / Math.max(0.1, totalVideoDurationSec)) * 88}%)`,
            width: "2px",
            backgroundColor: "#ffffff",
            boxShadow: "0 0 14px rgba(255, 255, 255, 1), 0 0 4px rgba(255, 255, 255, 0.8)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          {/* WHITE TIME BADGE PIN (00:04) AT TOP OF RULER */}
          <div className="w-12 h-5 rounded-full bg-white text-black font-mono font-extrabold text-[9px] flex items-center justify-center -translate-x-1/2 shadow-xl border border-slate-300">
            {formatTimecode(currentTimeSec)}
          </div>
        </div>

        {/* TIMELINE RULER TOP BAR */}
        <div
          ref={timelineRulerRef}
          onClick={(e) => {
            if (!timelineRulerRef.current) return;
            const rect = timelineRulerRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left - 90;
            const trackWidth = rect.width - 90;
            if (trackWidth > 0) {
              const clickedTime = Math.max(0, Math.min(totalVideoDurationSec, (clickX / trackWidth) * totalVideoDurationSec));
              setSeekToSec(parseFloat(clickedTime.toFixed(2)));
              setCurrentTimeSec(parseFloat(clickedTime.toFixed(2)));
            }
          }}
          className="h-10 bg-[#121215] border-b border-[#27272a] px-3 flex items-center relative select-none cursor-pointer overflow-hidden z-20"
        >
          {/* TOOLBAR CONTROLS (SPLIT, COPY, PASTE) */}
          <div className="w-[100px] text-[10px] font-extrabold text-slate-400 flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleSplitClipAtPlayhead(); }}
              className="p-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40 cursor-pointer"
              title="Split Cut (Cmd+X)"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyClip(); }}
              className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-slate-300 border border-[#3f3f46] cursor-pointer"
              title="Copy Clip (Cmd+C)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handlePasteClip(); }}
              className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-slate-300 border border-[#3f3f46] cursor-pointer"
              title="Paste Clip (Cmd+V)"
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TIMELINE RULER MARKS (00:00, 00:04, 00:10, 00:20, 00:30, etc.) */}
          <div className="flex-1 flex justify-between text-[10px] font-mono text-slate-400 font-bold pr-6">
            <span>00:00</span>
            <span>00:04</span>
            <span>00:10</span>
            <span>00:20</span>
            <span>00:30</span>
            <span>00:40</span>
            <span>00:50</span>
            <span>01:00</span>
            <span>01:10</span>
            <span>01:20</span>
          </div>
        </div>

        {/* SPACIOUS TIMELINE LAYERS CONTAINER */}
        <div className="flex-1 p-3 overflow-x-auto space-y-3 text-xs select-none z-10">
          {/* LAYER 1: V1 VIDEO TRACK FILMSTRIP (PROPORTIONAL CLIP WIDTHS) */}
          <div className="flex items-center gap-3">
            <span className="w-20 text-[10px] font-extrabold text-slate-400">Layer 1 (V1)</span>
            <div className="flex-1 flex items-center gap-1.5 h-16 bg-[#09090b] rounded-xl border border-[#27272a] p-1.5 overflow-hidden">
              {footages.length === 0 ? (
                <div className="w-full text-[10px] text-slate-600 italic text-center">Belum ada klip video di Layer 1</div>
              ) : (
                footages.map((clip, idx) => {
                  const clipDur = customClipDurations[idx] || clipDuration;
                  const clipPercent = (clipDur / Math.max(0.1, totalVideoDurationSec)) * 100;

                  return (
                    <React.Fragment key={clip.id}>
                      <div
                        onClick={() => setSelectedClipIndex(idx)}
                        style={{ width: `calc(${clipPercent}% - 8px)` }}
                        className={`h-full px-2 rounded-xl flex items-center gap-2 text-indigo-200 border transition-all cursor-pointer flex-shrink-0 min-w-[90px] ${
                          selectedClipIndex === idx ? "border-indigo-400 bg-indigo-900/90 shadow-lg shadow-indigo-600/30 scale-[1.01]" : "border-indigo-500/30 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:border-indigo-400"
                        }`}
                      >
                        <div className="w-10 h-12 rounded bg-black overflow-hidden flex-shrink-0 border border-slate-800">
                          <video src={clip.previewUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-slate-100 truncate">{clip.name}</p>
                          <p className="text-[8px] text-indigo-300 opacity-80 font-mono">{clipDur}s</p>
                        </div>
                      </div>

                      {idx < footages.length - 1 && (
                        <div
                          onClick={() => applyTransitionToPlayhead("light-leak")}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 text-amber-300 text-[9px] font-extrabold cursor-pointer flex-shrink-0"
                        >
                          ⚡ {transitionsMap[idx] || "light-leak"}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          {/* LAYER 2: A1 VOICE OVER TRACK (ONLY SHOWS IF VOICE OVER EXISTS) */}
          <div className="flex items-center gap-3">
            <span className="w-20 text-[10px] font-extrabold text-amber-400">Layer 2 (A1)</span>
            <div className="flex-1">
              {audioUrl ? (
                <div className="h-10 bg-gradient-to-r from-amber-950/90 via-amber-900/90 to-amber-950/90 border border-amber-500/50 rounded-xl flex items-center px-4 text-amber-200 text-[10px] font-extrabold gap-2 shadow-md">
                  <Mic className="w-4 h-4 text-amber-400" />
                  <span>Voice Over AI ({selectedVoice}) Waveform Audio Track</span>
                </div>
              ) : (
                <div className="h-10 bg-[#09090b]/50 rounded-xl border border-dashed border-[#27272a] flex items-center px-4 text-slate-600 italic text-[10px]">
                  (A1 Voice Over Kosong - Klik Generate Voice Over di Tab Left untuk menambahkan)
                </div>
              )}
            </div>
          </div>

          {/* LAYER 3: A2 BGM AUDIO TRACK (ONLY SHOWS IF BGM EXISTS) */}
          <div className="flex items-center gap-3">
            <span className="w-20 text-[10px] font-extrabold text-emerald-400">Layer 3 (A2)</span>
            <div className="flex-1">
              {bgmUrl ? (
                <div className="h-10 bg-gradient-to-r from-emerald-950/90 via-teal-900/90 to-emerald-950/90 border border-emerald-500/50 rounded-xl flex items-center px-4 text-emerald-200 text-[10px] font-extrabold gap-2 shadow-md">
                  <Music className="w-4 h-4 text-emerald-400" />
                  <span>Background Music Track ({Math.round(bgmVolume * 100)}%)</span>
                </div>
              ) : (
                <div className="h-10 bg-[#09090b]/50 rounded-xl border border-dashed border-[#27272a] flex items-center px-4 text-slate-600 italic text-[10px]">
                  (A2 BGM Music Kosong - Klik Pilih BGM AI di Tab Audio)
                </div>
              )}
            </div>
          </div>

          {/* LAYER 4: T1 CAPTIONS SUBTITLES TRACK */}
          <div className="flex items-center gap-3">
            <span className="w-20 text-[10px] font-extrabold text-purple-400">Layer 4 (T1)</span>
            <div className="flex-1 flex items-center gap-2 h-10 overflow-hidden">
              {textChunks.length > 0 ? (
                textChunks.map((chunk, i) => (
                  <div key={i} className="h-8 px-3 bg-purple-950/80 border border-purple-500/40 text-purple-200 rounded-xl text-[9px] font-extrabold flex items-center gap-1.5 truncate flex-shrink-0">
                    <span className="bg-purple-500/20 px-1 rounded text-purple-300">cc</span>
                    <span className="truncate">{chunk}</span>
                  </div>
                ))
              ) : (
                <div className="w-full h-10 bg-[#09090b]/50 rounded-xl border border-dashed border-[#27272a] flex items-center px-4 text-slate-600 italic text-[10px]">
                  (T1 Subtitle Captions Kosong - Tulis Naskah di Tab Left)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RENDER EXPORT PROGRESS MODAL */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-96 p-6 rounded-2xl border border-[#27272a] bg-[#18181c] text-center space-y-4 shadow-2xl">
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
          <div className="w-[380px] p-5 rounded-2xl border border-[#27272a] bg-[#18181c] space-y-4 shadow-2xl">
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
