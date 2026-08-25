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
  Send,
  MessageSquare,
} from "lucide-react";
import { MainCompositionProps, FootageItem, TransitionItem, SubtitleChunk, TitleOverlayConfig } from "../remotion/types";
import { Navbar, ActiveTabType } from "../components/Navbar";
import { VideoAIChat } from "../components/VideoAIChat";
import { AnimasiAIPlaceholder } from "../components/AnimasiAIPlaceholder";

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
  startFromSec?: number;
  isImage?: boolean;
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

const PRESET_VIRAL_BGM_TRACKS = [
  { id: "bsl1", title: "🎵 Backsound 1", category: "Chill & Aesthetic", url: "/bgm/bsl1.mp3" },
  { id: "bsl2", title: "🎵 Backsound 2", category: "Upbeat Culinary", url: "/bgm/bsl2.mp3" },
  { id: "bsl3", title: "🎵 Backsound 3", category: "Coffee & Minimalist", url: "/bgm/bsl3.mp3" },
  { id: "bsl4", title: "🎵 Backsound 4", category: "Luxury & Gourmet", url: "/bgm/bsl4.mp3" },
  { id: "bsl5", title: "🎵 Backsound 5", category: "Commercial Groove", url: "/bgm/bsl5.mp3" },
  { id: "bsl6", title: "🎵 Backsound 6", category: "Sweet Bakery", url: "/bgm/bsl6.mp3" },
  { id: "bsl7", title: "🎵 Backsound 7", category: "Beverage Beat", url: "/bgm/bsl7.mp3" },
  { id: "bsl8", title: "🎵 Backsound 8", category: "Street Food Mukbang", url: "/bgm/bsl8.mp3" },
  { id: "bsl9", title: "🎵 Backsound 9", category: "Bistro Lounge", url: "/bgm/bsl9.mp3" },
  { id: "bsl10", title: "🎵 Backsound 10", category: "Grand Opening", url: "/bgm/bsl10.mp3" },
];

const VOICE_OPTIONS = [
  { id: "Zephyr", name: "Zephyr (Pria Warm & Energetik)", desc: "Suara pria hangat, jernih & bersemangat" },
  { id: "Puck", name: "Puck (Wanita Soft & Lembut)", desc: "Suara wanita lembut, tenang & jernih" },
  { id: "Kore", name: "Kore (Wanita Berwibawa)", desc: "Suara wanita profesional & formal" },
  { id: "Fenrir", name: "Fenrir (Pria Sinematik Deep)", desc: "Suara pria berat, dalam & sinematik" },
  { id: "Aoede", name: "Aoede (Wanita Ceria Commercial)", desc: "Suara wanita segar, ceria & iklani" },
  { id: "Charon", name: "Charon (Pria Santai Vlog)", desc: "Suara pria kasual, santai & ramah" },
];

const AVAILABLE_FILTERS = [
  { id: "clean-commercial", title: "✨ Clean Commercial", desc: "Clean, bright, natural, crisp", rating: "⭐⭐⭐⭐⭐" },
  { id: "warm-commercial", title: "☕ Warm Commercial", desc: "Warm, inviting, premium", rating: "⭐⭐⭐⭐⭐" },
  { id: "modern-cinematic", title: "🎬 Modern Cinematic", desc: "Contrast sedikit kuat, shadow cool", rating: "⭐⭐⭐⭐⭐" },
  { id: "soft-teal", title: "🌊 Soft Teal", desc: "Teal sangat subtle + warm skin", rating: "⭐⭐⭐⭐" },
  { id: "muted-luxury", title: "🍸 Muted Luxury", desc: "Saturasi diturunkan, elegant", rating: "⭐⭐⭐⭐⭐" },
  { id: "warm-clean", title: "☀️ Warm & Clean", desc: "Warm tapi tetap putih/natural", rating: "⭐⭐⭐⭐⭐" },
  { id: "cinematic-neutral", title: "🎞️ Cinematic Neutral", desc: "Natural dengan contrast filmic", rating: "⭐⭐⭐⭐⭐" },
  { id: "pastel-commercial", title: "🎨 Pastel Commercial", desc: "Soft, sedikit muted", rating: "⭐⭐⭐⭐" },
  { id: "urban-clean", title: "🏙️ Urban Clean", desc: "Contrast + sedikit cool", rating: "⭐⭐⭐⭐" },
  { id: "editorial-commercial", title: "📸 Editorial Commercial", desc: "Clean, refined, fashion-like", rating: "⭐⭐⭐⭐⭐" },
];

const TITLE_IN_ANIMATIONS = [
  { id: "spring-pop", label: "Elastic Pop & Glow", desc: "Membal elastis + kilau cahaya", icon: "✨" },
  { id: "kinetic-zoom", label: "Kinetic Slam Zoom", desc: "Zoom cepat 1.45x membentur", icon: "⚡" },
  { id: "slide-up", label: "Kinetic Slide Up", desc: "Meluncur naik dari bawah", icon: "⬆️" },
  { id: "stagger-cascade", label: "3D Stagger Cascade", desc: "Teks turun berurutan 1-2-3", icon: "🪜" },
  { id: "mask-reveal", label: "Cinematic Mask Wipe", desc: "Sapuan tirai sinematik mulus", icon: "🎬" },
  { id: "neon-flash", label: "Cyber Neon Flash", desc: "Kelap-kelip neon & strobe", icon: "💡" },
  { id: "flip-drop", label: "3D Perspective Flip", desc: "Putar 3D jatuh membal", icon: "🔄" },
  { id: "blur-fade", label: "Cinematic Blur Fade", desc: "Defokus blur ke tajam 4K", icon: "🌫️" },
];

const TITLE_OUT_ANIMATIONS = [
  { id: "blur-dissolve", label: "Blur Dissolve", desc: "Blur mengembang lembut", icon: "🌫️" },
  { id: "slide-up-out", label: "Fast Slide Up", desc: "Melesat cepat ke atas", icon: "🚀" },
  { id: "slide-down-out", label: "Slide Down Fade", desc: "Meluncur turun ke bawah", icon: "⬇️" },
  { id: "scale-fade", label: "Scale Shrink Sink", desc: "Mengecil tenggelam", icon: "🔍" },
  { id: "zoom-explode", label: "Flash Zoom Explode", desc: "Meledak maju ke kamera", icon: "💥" },
  { id: "flip-out", label: "3D Perspective Flip", desc: "Putar 3D menjauh", icon: "🔄" },
];

export default function CapCutWebStudio() {
  const [activeAppTab, setActiveAppTab] = useState<ActiveTabType>("video-ai");
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("gemini_api_key");
      if (savedKey) {
        setApiKey(savedKey);
      }
    }
  }, []);

  const [viewMode, setViewMode] = useState<"wizard" | "studio">("wizard");
  const [includeEndingCover, setIncludeEndingCover] = useState<boolean>(true);

  const [activeNavTab, setActiveNavTab] = useState<"generate" | "video" | "photo" | "audio" | "text" | "effects" | "caption" | "filter" | "overlay">("video");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");

  // Timeline Zoom Level (1x to 5x)
  const [timelineZoom, setTimelineZoom] = useState<number>(1);

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);

  // Footages state
  const [footages, setFootages] = useState<UploadedFootage[]>([]);
  const [clipDuration, setClipDuration] = useState<number>(3.0);
  const [customClipDurations, setCustomClipDurations] = useState<{ [key: number]: number }>({});
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<{ type: "video" | "voiceover" | "bgm" | "subtitle" | "transition" | "title"; index?: number } | null>(null);
  const [copiedClip, setCopiedClip] = useState<UploadedFootage | null>(null);

  // Playhead & Scrubber state (Dynamic Frame Sync)
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  const timelineRulerRef = useRef<HTMLDivElement>(null);

  // Script, Voice & Caption state
  const [rawScript, setRawScript] = useState<string>("");
  const [polishedScript, setPolishedScript] = useState<string>("");
  const [isPolishing, setIsPolishing] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("Zephyr");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number>(8.0);
  const [autoCaptionGenerated, setAutoCaptionGenerated] = useState<boolean>(true);
  const [customTextOverlay, setCustomTextOverlay] = useState<string>("");
  // Word-level timestamps from TTS alignment (word -> start/end time in seconds)
  const [wordTimings, setWordTimings] = useState<Array<{word: string; start: number; end: number}>>([]);

  // Target duration & additional instructions (Fitur 2)
  const [targetDuration, setTargetDuration] = useState<number>(0); // 0 = no target
  const [additionalInstructions, setAdditionalInstructions] = useState<string>("");

  // Footage semantic match state (Fitur 4)
  const [isMatchingFootage, setIsMatchingFootage] = useState<boolean>(false);
  const [preMatchFootageOrder, setPreMatchFootageOrder] = useState<UploadedFootage[] | null>(null); // for undo
  const [matchExplanation, setMatchExplanation] = useState<string>("");

  // AI Copilot confirmation modal for heavy actions (Fitur 3)
  const [copilotConfirm, setCopilotConfirm] = useState<{ message: string; action: any } | null>(null);

  // ─── Overlay Layer State ─────────────────────────────────────────────────────
  interface OverlayItem {
    id: string;
    file: File;
    previewUrl: string;
    name: string;
    position: "topleft" | "topright" | "bottomleft" | "bottomright" | "center";
    sizePercent: number;   // 10–80 % of video width
    opacity: number;       // 0.1–1.0
    startSec: number;      // when it appears (0 = start)
    endSec: number;        // when it disappears (-1 = till end)
    isVideo: boolean;
  }
  const [overlayItems, setOverlayItems] = useState<OverlayItem[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // ─── Drag & Drop Clips ───────────────────────────────────────────────────────
  const [draggedClipIdx, setDraggedClipIdx] = useState<number | null>(null);
  const [dragOverClipIdx, setDragOverClipIdx] = useState<number | null>(null);

  // Transitions state

  const [transitionsMap, setTransitionsMap] = useState<{ [afterIndex: number]: string }>({});

  // BGM state
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState<number>(0.2);
  const [isSelectingBgm, setIsSelectingBgm] = useState<boolean>(false);

  // Style state (default: none / original colors)
  const [editingStyle, setEditingStyle] = useState<string>("none");
  const [subtitleStyle, setSubtitleStyle] = useState<string>("plain-shadow");
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(44);
  const [subtitleBottomPos, setSubtitleBottomPos] = useState<number>(220);
  const [isGeneratingConcept, setIsGeneratingConcept] = useState<boolean>(false);

  // Title / Opening Header State (Reels Multi-Line Aesthetic Title with In/Out Animation)
  const [titleConfig, setTitleConfig] = useState<TitleOverlayConfig>({
    enabled: true,
    line1: "Renovasi",
    line2: "Coffee Bar",
    subtitle: "burjolevelup",
    style: "reel-aesthetic",
    italicLine2: true,
    fontSize: 84,
    fontColor: "#FFFFFF",
    positionY: 40,
    startSec: 0,
    durationSec: 3.8,
    animationIn: "spring-pop",
    animationOut: "blur-dissolve",
  });
  const [textTabSection, setTextTabSection] = useState<"title" | "subtitle">("title");

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportPreset, setExportPreset] = useState<string>("720p");
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  // Async job queue state
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderJobStatus, setRenderJobStatus] = useState<"pending" | "rendering" | "done" | "error" | null>(null);
  const [renderJobError, setRenderJobError] = useState<string | null>(null);
  const [renderJobFrames, setRenderJobFrames] = useState<{ rendered: number; total: number }>({ rendered: 0, total: 0 });
  const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null);
  const renderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI Chat Assistant State (Trainee Knowledge Engine)
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string; actionApplied?: string }>>([
    {
      sender: "ai",
      text: "Halo! Saya AI Video Editing Assistant terlatih dari Master Trainee Knowledge. Siap membantu merencanakan, mengedit, menentukan gaya warna, transisi, atau naskah video Anda!",
    },
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatSending, setIsChatSending] = useState<boolean>(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottomChat = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottomChat();
  }, [chatMessages, isChatSending]);

  // ─── Capture multiple frames dari footage (canvas) ───────────────────────────
  // Returns array of base64 frames: 1 frame for image, 3 frames for video
  const captureFootageFrames = (footage: UploadedFootage): Promise<string[]> => {
    return new Promise((resolve) => {
      const isImage = /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(footage.name) ||
        footage.file.type.startsWith("image/");

      const drawToBase64 = (el: HTMLImageElement | HTMLVideoElement): string | null => {
        const canvas = document.createElement("canvas");
        canvas.width = 384;
        canvas.height = 216;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        try {
          ctx.drawImage(el, 0, 0, 384, 216);
          return canvas.toDataURL("image/jpeg", 0.75);
        } catch { return null; }
      };

      if (isImage) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const b64 = drawToBase64(img);
          resolve(b64 ? [b64] : []);
        };
        img.onerror = () => resolve([]);
        img.src = footage.previewUrl;
      } else {
        // Video — capture 3 frames at 10%, 40%, 70% of duration
        const vid = document.createElement("video");
        vid.crossOrigin = "anonymous";
        vid.muted = true;
        vid.preload = "metadata";
        vid.src = footage.previewUrl;

        const frames: string[] = [];
        const seekPoints = [0.1, 0.4, 0.7];
        let seekIdx = 0;

        const timeout = setTimeout(() => { vid.src = ""; resolve(frames); }, 8000);

        const seekNext = () => {
          if (seekIdx >= seekPoints.length) {
            clearTimeout(timeout);
            vid.src = "";
            resolve(frames);
            return;
          }
          const t = Math.max(0.1, (vid.duration || 5) * seekPoints[seekIdx]);
          vid.currentTime = t;
          seekIdx++;
        };

        vid.onloadedmetadata = seekNext;
        vid.onseeked = () => {
          const b64 = drawToBase64(vid);
          if (b64) frames.push(b64);
          seekNext();
        };
        vid.onerror = () => { clearTimeout(timeout); resolve(frames); };
      }
    });
  };

  // ─── Footage Semantic Matching (Fitur 4) ────────────────────────────────────
  const handleAutoMatchFootage = async () => {
    if (!audioUrl || footages.length < 2) {
      alert("Auto-match membutuhkan VO yang sudah digenerate dan minimal 2 klip footage.");
      return;
    }
    setIsMatchingFootage(true);
    try {
      const script = polishedScript || rawScript;
      const footageNames = footages.map(f => f.name);

      // Capture multi-frame thumbnails for Gemini Vision analysis
      setChatMessages(prev => [...prev, { sender: "ai", text: "🔍 Menganalisis konten visual setiap klip dengan Gemini Vision (multi-frame)..." }]);
      const frameArrays: string[][] = await Promise.all(
        footages.map(f => captureFootageFrames(f))
      );
      // Only send if all clips have at least 1 frame
      const validFrameArrays = frameArrays.every(arr => arr.length > 0) ? frameArrays : undefined;


      const res = await fetch("/api/match-footage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, wordTimings, footageNames, audioDurationSec, frameArrays: validFrameArrays }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const { orderedIndices, clipTimings, explanation, usedVision } = data;

      // Save current order for undo
      setPreMatchFootageOrder([...footages]);
      setMatchExplanation(explanation || "");

      // Reorder footages
      const reordered = orderedIndices
        .map((idx: number) => footages[idx])
        .filter(Boolean) as UploadedFootage[];
      setFootages(reordered);

      // Apply clip timings as durations
      const newDurMap: { [key: number]: number } = {};
      clipTimings.forEach((t: any, pos: number) => {
        newDurMap[pos] = parseFloat((t.endSec - t.startSec).toFixed(2));
      });
      setCustomClipDurations(newDurMap);

      setChatMessages(prev => {
        const filtered = prev.filter(m => !m.text.includes("Menganalisis konten visual"));
        return [...filtered, {
          sender: "ai",
          text: `✨ Auto-Match selesai${usedVision ? " (Gemini Vision 🔍)" : ""}!\n\n${explanation}\n\nKlip sudah disusun ulang sesuai narasi. Gunakan tombol "↩ Undo Match" jika ingin balik ke urutan semula.`,
        }];
      });
    } catch (e: any) {
      alert(e.message || "Gagal melakukan auto-match footage.");
    } finally {
      setIsMatchingFootage(false);
    }
  };

  const handleUndoMatch = () => {
    if (!preMatchFootageOrder) return;
    setFootages(preMatchFootageOrder);
    setPreMatchFootageOrder(null);
    setMatchExplanation("");
    // Restore durations
    const newDurMap: { [key: number]: number } = {};
    preMatchFootageOrder.forEach((f, i) => { newDurMap[i] = f.duration; });
    setCustomClipDurations(newDurMap);
  };

  // ─── Overlay Handlers ────────────────────────────────────────────────────────
  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const isVideo = file.type.startsWith("video/");
      const newOverlay = {
        id: `overlay_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        position: "topright" as const,
        sizePercent: 25,
        opacity: 0.9,
        startSec: 0,
        endSec: -1,
        isVideo,
      };
      setOverlayItems(prev => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
    });
    e.target.value = "";
  };

  const handleRemoveOverlay = (id: string) => {
    setOverlayItems(prev => prev.filter(o => o.id !== id));
    setSelectedOverlayId(prev => prev === id ? null : prev);
  };

  const handleUpdateOverlay = (id: string, updates: Partial<{ position: "topleft" | "topright" | "bottomleft" | "bottomright" | "center"; sizePercent: number; opacity: number; startSec: number; endSec: number }>) => {
    setOverlayItems(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  // ─── Drag & Drop Clip Reordering ─────────────────────────────────────────────
  const isEndingClip = (f: UploadedFootage) =>
    f.name.includes("Cover Akhiran") || f.name.includes("Akhiran") || f.name.includes("ending");

  const handleClipDragStart = (e: React.DragEvent, idx: number) => {
    if (isEndingClip(footages[idx])) { e.preventDefault(); return; } // Lock Cover Akhiran
    setDraggedClipIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleClipDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (isEndingClip(footages[idx])) return; // Cannot drop onto Cover Akhiran
    setDragOverClipIdx(idx);
  };

  const handleClipDragEnd = () => {
    setDraggedClipIdx(null);
    setDragOverClipIdx(null);
  };

  const handleClipDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdx = draggedClipIdx;
    setDraggedClipIdx(null);
    setDragOverClipIdx(null);

    if (sourceIdx === null || sourceIdx === targetIdx) return;
    if (isEndingClip(footages[targetIdx])) return; // Cannot drop onto Cover Akhiran

    pushHistoryState();

    // Reorder footages
    const newFootages = [...footages];
    const [removed] = newFootages.splice(sourceIdx, 1);
    newFootages.splice(targetIdx, 0, removed);
    setFootages(newFootages);

    // Remap customClipDurations to match new order
    const newDurMap: { [key: number]: number } = {};
    newFootages.forEach((_, newIdx) => {
      const oldIdx = footages.indexOf(newFootages[newIdx]);
      newDurMap[newIdx] = customClipDurations[oldIdx] || clipDuration;
    });
    setCustomClipDurations(newDurMap);

    // Remap transitionsMap: transitions are anchored to position, rebuild from scratch
    const newTransMap: { [key: number]: string } = {};
    // Carry over transitions by position (keep flash-white before ending)
    const endingNewIdx = newFootages.findIndex(f => isEndingClip(f));
    if (endingNewIdx > 0) newTransMap[endingNewIdx - 1] = "flash-white";
    setTransitionsMap(newTransMap);
  };



  // ─── Helper: Cover Akhiran selalu pakai flash-white ─────────────────────────
  // Dipanggil setelah setiap perubahan transitionsMap agar transisi sebelum
  // Cover Akhiran tidak pernah diubah oleh perintah apapun.
  const ensureEndingTransition = (map: { [key: number]: string }, clips: typeof footages): { [key: number]: string } => {
    const endingIdx = clips.findIndex(f =>
      f.name.includes("Cover Akhiran") || f.name.includes("Akhiran") || f.name.includes("ending")
    );
    if (endingIdx > 0) {
      // Transition SEBELUM Cover Akhiran = posisi endingIdx - 1
      return { ...map, [endingIdx - 1]: "flash-white" };
    }
    return map;
  };

  // ─── AI Copilot Enhanced Action Handler (Fitur 3) ───────────────────────────
  const executeCopilotAction = async (act: any): Promise<string> => {
    let desc = "";
    if (act.type === "change_bgm_volume") {
      setBgmVolume(act.payload.volume);
      desc = `Volume BGM diubah ke ${Math.round(act.payload.volume * 100)}%`;
    } else if (act.type === "change_subtitle_style") {
      setSubtitleStyle(act.payload.style);
      desc = `Subtitle diubah ke gaya ${act.payload.style}`;
    } else if (act.type === "change_subtitle_font_size") {
      const sz = parseInt(act.payload.fontSize || 56);
      setSubtitleFontSize(sz);
      desc = `Ukuran subtitle diubah ke ${sz}px`;
    } else if (act.type === "change_subtitle_position") {
      const pos = parseInt(act.payload.bottom || 220);
      setSubtitleBottomPos(pos);
      desc = `Posisi subtitle diubah ke ${pos}px`;
    } else if (act.type === "change_editing_style") {
      setEditingStyle(act.payload.style);
      desc = `Color filter diubah ke ${act.payload.style}`;
    } else if (act.type === "change_clip_duration") {
      setClipDuration(act.payload.duration);
      desc = `Durasi klip diubah ke ${act.payload.duration}s`;
    } else if (act.type === "set_clip_duration") {
      const idx = act.payload.clipIndex;
      setCustomClipDurations(prev => ({ ...prev, [idx]: act.payload.duration }));
      desc = `Durasi klip ${idx + 1} diubah ke ${act.payload.duration}s`;
    } else if (act.type === "set_target_duration") {
      const targetSec: number = act.payload.seconds;
      setTargetDuration(targetSec);
      // Immediately redistribute durations across footage clips (EXCLUDE Cover Akhiran)
      if (footages.length > 0 && targetSec > 0) {
        const newDurMap = { ...customClipDurations };
        // Identify Cover Akhiran index
        const endingIdx = footages.findIndex(f =>
          f.name.includes("Cover Akhiran") || f.name.includes("ending") || f.name.includes("Akhiran")
        );
        const endingDur = endingIdx !== -1 ? (customClipDurations[endingIdx] || 3.0) : 0;
        // Available time for main clips
        const mainTargetDur = Math.max(1, targetSec - endingDur);
        const mainCount = footages.filter((_, i) => i !== endingIdx).length;
        if (mainCount > 0) {
          // Distribute evenly among main clips (proportional to current duration)
          const mainTotal = footages.reduce((s, _, i) =>
            i !== endingIdx ? s + (customClipDurations[i] || clipDuration) : s, 0) || mainCount * clipDuration;
          let accumulated = 0;
          const mainIndices = footages.map((_, i) => i).filter(i => i !== endingIdx);
          mainIndices.forEach((idx, pos) => {
            const weight = (customClipDurations[idx] || clipDuration) / mainTotal;
            if (pos === mainIndices.length - 1) {
              newDurMap[idx] = parseFloat(Math.max(1, mainTargetDur - accumulated).toFixed(2));
            } else {
              const dur = parseFloat(Math.max(1, weight * mainTargetDur).toFixed(2));
              newDurMap[idx] = dur;
              accumulated += dur;
            }
          });
          setCustomClipDurations(newDurMap);
        }
      }
      desc = `Durasi video diubah ke ${targetSec}s — klip diperpanjang rata`;

    } else if (act.type === "change_aspect_ratio") {
      setAspectRatio(act.payload.ratio);
      desc = `Rasio aspek diubah ke ${act.payload.ratio}`;
    } else if (act.type === "change_export_preset") {
      setExportPreset(act.payload.preset);
      desc = `Preset export diubah ke ${act.payload.preset}`;
    } else if (act.type === "change_bgm") {
      const track = PRESET_VIRAL_BGM_TRACKS.find(t => t.id === act.payload.trackId);
      if (track) { setBgmUrl(track.url); setBgmFile(null); }
      desc = `BGM diganti ke ${act.payload.trackId}`;
    } else if (act.type === "add_all_transitions") {
      const targetType = act.payload.type || "light-leak";
      if (targetType === "random") {
        const keys = AVAILABLE_TRANSITIONS.map(t => t.id);
        const newMap: { [key: number]: string } = {};
        footages.forEach((_, i) => { if (i < footages.length - 1) newMap[i] = keys[Math.floor(Math.random() * keys.length)]; });
        setTransitionsMap(ensureEndingTransition(newMap, footages));
        desc = "Transisi acak terpasang di semua klip (Cover Akhiran tetap Flash White)";
      } else {
        const newMap: { [key: number]: string } = {};
        footages.forEach((_, i) => { if (i < footages.length - 1) newMap[i] = targetType; });
        setTransitionsMap(ensureEndingTransition(newMap, footages));
        desc = `Transisi ${targetType} terpasang di semua klip (Cover Akhiran tetap Flash White)`;
      }
    } else if (act.type === "add_random_transitions") {
      const keys = AVAILABLE_TRANSITIONS.map(t => t.id);
      const newMap: { [key: number]: string } = {};
      footages.forEach((_, i) => { if (i < footages.length - 1) newMap[i] = keys[Math.floor(Math.random() * keys.length)]; });
      setTransitionsMap(ensureEndingTransition(newMap, footages));
      desc = "Transisi acak variatif terpasang (Cover Akhiran tetap Flash White)";
    } else if (act.type === "remove_all_transitions") {
      // Remove all EXCEPT the transition before Cover Akhiran
      const endingIdx = footages.findIndex(f =>
        f.name.includes("Cover Akhiran") || f.name.includes("Akhiran") || f.name.includes("ending")
      );
      if (endingIdx > 0) {
        setTransitionsMap({ [endingIdx - 1]: "flash-white" });
        desc = "Semua transisi dihapus (kecuali Flash White sebelum Cover Akhiran)";
      } else {
        setTransitionsMap({});
        desc = "Semua transisi dihapus";
      }
    } else if (act.type === "reorder_clips") {
      const order: number[] = act.payload.order || [];
      if (order.length > 0) {
        const reordered = order.map((i: number) => footages[i]).filter(Boolean);
        setFootages(reordered);
        const newDurMap: { [key: number]: number } = {};
        reordered.forEach((_, i) => { newDurMap[i] = customClipDurations[order[i]] || clipDuration; });
        setCustomClipDurations(newDurMap);
        desc = `Klip disusun ulang sesuai urutan: ${order.map(i => i + 1).join(", ")}`;
      }
    } else if (act.type === "change_voice") {
      setSelectedVoice(act.payload.voice);
      desc = `Suara VO diganti ke ${act.payload.voice} — klik Generate VO untuk menghasilkan ulang`;
    } else if (act.type === "regenerate_voiceover") {
      if (act.payload.voice) setSelectedVoice(act.payload.voice);
      if (act.payload.script) setPolishedScript(act.payload.script);
      await handleGenerateAudio();
      desc = `VO di-generate ulang${act.payload.voice ? " dengan suara " + act.payload.voice : ""}`;
    } else if (act.type === "auto_match_footage") {
      await handleAutoMatchFootage();
      desc = "Auto-match footage ke VO dijalankan";
    } else if (act.type === "regenerate_render") {
      desc = "Render ulang akan dimulai...";
      setTimeout(() => handleExportVideo(), 500);
    }
    return desc;
  };

  const handleSendChatMessage = async (overridePrompt?: string) => {
    const promptText = (overridePrompt || chatInput).trim();
    if (!promptText || isChatSending) return;

    if (!overridePrompt) setChatInput("");
    setChatMessages((prev) => [...prev, { sender: "user", text: promptText }]);
    setIsChatSending(true);

    try {
      const res = await fetch("/api/ai-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          context: {
            footagesCount: footages.length,
            clips: footages.map((f, i) => ({ name: f.name, duration: customClipDurations[i] || clipDuration })),
            totalDuration: totalVideoDurationSec,
            audioDurationSec,
            selectedVoice,
            rawScript,
            polishedScript,
            subtitleStyle,
            subtitleFontSize,
            subtitleBottomPos,
            editingStyle,
            transitionsMap,
            bgmUrl,
            bgmVolume,
            targetDuration,
            aspectRatio,
            exportPreset,
          },
        }),
      });

      const data = await res.json();
      if (data.message) {
        // Check if any action requires confirmation
        const heavyActions = (data.actions || []).filter((a: any) =>
          ["regenerate_voiceover", "reorder_clips", "auto_match_footage", "regenerate_render", "change_voice"].includes(a.type)
        );
        const lightActions = (data.actions || []).filter((a: any) =>
          !["regenerate_voiceover", "reorder_clips", "auto_match_footage", "regenerate_render", "change_voice"].includes(a.type)
        );

        // Execute light actions immediately
        const lightDescs: string[] = [];
        for (const act of lightActions) {
          const d = await executeCopilotAction(act);
          if (d) lightDescs.push(d);
        }

        // For heavy actions, if requiresConfirmation is true, show confirmation
        const actionDescs = [...lightDescs];
        if (heavyActions.length > 0 && data.requiresConfirmation !== false) {
          // Queue heavy actions for confirmation
          for (const act of heavyActions) {
            setCopilotConfirm({
              message: `AI ingin melakukan: **${act.type.replace(/_/g, " ")}**\n\n${data.message}`,
              action: act,
            });
          }
        } else {
          // Execute all (requiresConfirmation was explicitly false)
          for (const act of heavyActions) {
            const d = await executeCopilotAction(act);
            if (d) actionDescs.push(d);
          }
        }

        setChatMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: data.message,
            actionApplied: actionDescs.join(" | ") || undefined,
          },
        ]);
      }
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Maaf, terjadi kesalahan saat menghubungi AI Assistant.",
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  // Handle Footage Upload with Native Duration Auto-Detection
  const handleFootageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const loadedFootages: UploadedFootage[] = await Promise.all(
      files.map((file, idx) => {
        return new Promise<UploadedFootage>((resolve) => {
          const previewUrl = URL.createObjectURL(file);
          const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(file.name);
          
          if (isImg) {
            resolve({
              id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              file,
              previewUrl,
              name: file.name || `IMG${(idx + 1).toString().padStart(4, "0")}.jpg`,
              duration: clipDuration,
              isImage: true,
            });
            return;
          }

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
              isImage: false,
            });
          };
          tempVid.onerror = () => {
            resolve({
              id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              file,
              previewUrl,
              name: file.name || `VID${(idx + 1).toString().padStart(4, "0")}.mp4`,
              duration: clipDuration,
              isImage: false,
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

  // Handle Photo Upload (PNG, JPG, HEIC, WEBP, GIF)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const newFootages: UploadedFootage[] = files.map((file, i) => ({
      id: `${Date.now()}_img_${i}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      duration: 3.0,
      isImage: true,
    }));

    pushHistoryState();
    setFootages((prev) => {
      const combined = [...prev, ...newFootages];
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

  // Delete Selected Timeline Item (Video, Voiceover, BGM, or Subtitle)
  const handleDeleteSelectedItem = useCallback(() => {
    if (!selectedTimelineItem) {
      if (selectedClipIndex !== null && footages[selectedClipIndex]) {
        removeFootage(footages[selectedClipIndex].id);
        setSelectedClipIndex(null);
      }
      return;
    }

    if (selectedTimelineItem.type === "video") {
      if (selectedClipIndex !== null && footages[selectedClipIndex]) {
        removeFootage(footages[selectedClipIndex].id);
        setSelectedClipIndex(null);
      }
    } else if (selectedTimelineItem.type === "voiceover") {
      setAudioUrl(null);
      setAudioFile(null);
    } else if (selectedTimelineItem.type === "bgm") {
      setBgmUrl(null);
      setBgmFile(null);
    } else if (selectedTimelineItem.type === "subtitle") {
      setRawScript("");
      setPolishedScript("");
    } else if (selectedTimelineItem.type === "title") {
      setTitleConfig((prev) => ({ ...prev, enabled: false }));
    } else if (selectedTimelineItem.type === "transition" && selectedTimelineItem.index !== undefined) {
      const idx = selectedTimelineItem.index;
      setTransitionsMap((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }

    setSelectedTimelineItem(null);
  }, [selectedTimelineItem, selectedClipIndex, footages]);

  // Push State to History Stack
  const pushHistoryState = useCallback(() => {
    setHistoryStack((prev) => [
      ...prev,
      {
        footages,
        customClipDurations,
        transitionsMap,
        rawScript,
        polishedScript,
        audioUrl,
        bgmUrl,
        editingStyle,
      },
    ]);
    setRedoStack([]);
  }, [footages, customClipDurations, transitionsMap, rawScript, polishedScript, audioUrl, bgmUrl, editingStyle]);

  const handleUndo = useCallback(() => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [
      ...prev,
      {
        footages,
        customClipDurations,
        transitionsMap,
        rawScript,
        polishedScript,
        audioUrl,
        bgmUrl,
        editingStyle,
      },
    ]);
    setFootages(previous.footages);
    setCustomClipDurations(previous.customClipDurations);
    setTransitionsMap(previous.transitionsMap);
    setRawScript(previous.rawScript);
    setPolishedScript(previous.polishedScript);
    setAudioUrl(previous.audioUrl);
    setBgmUrl(previous.bgmUrl);
    setEditingStyle(previous.editingStyle);
    setHistoryStack((prev) => prev.slice(0, -1));
  }, [historyStack, footages, customClipDurations, transitionsMap, rawScript, polishedScript, audioUrl, bgmUrl, editingStyle]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [
      ...prev,
      {
        footages,
        customClipDurations,
        transitionsMap,
        rawScript,
        polishedScript,
        audioUrl,
        bgmUrl,
        editingStyle,
      },
    ]);
    setFootages(next.footages);
    setCustomClipDurations(next.customClipDurations);
    setTransitionsMap(next.transitionsMap);
    setRawScript(next.rawScript);
    setPolishedScript(next.polishedScript);
    setAudioUrl(next.audioUrl);
    setBgmUrl(next.bgmUrl);
    setEditingStyle(next.editingStyle);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, footages, customClipDurations, transitionsMap, rawScript, polishedScript, audioUrl, bgmUrl, editingStyle]);

  // Keyboard Shortcuts (Cmd+X, Cmd+C, Cmd+V, Cmd+Z Undo, Cmd+Shift+Z Redo, Delete/Backspace on Mac)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleSplitClipAtPlayhead();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopyClip();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteClip();
      } else if (
        e.key === "Delete" ||
        e.key === "Backspace" ||
        e.code === "Delete" ||
        e.code === "Backspace" ||
        e.keyCode === 8 ||
        e.keyCode === 46
      ) {
        e.preventDefault();
        handleDeleteSelectedItem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSplitClipAtPlayhead, handleCopyClip, handlePasteClip, handleDeleteSelectedItem, handleUndo, handleRedo]);

  // Drag-to-Trim Clip Handles (Resize Clip Duration on Timeline)
  const handleClipResizeMouseDown = (e: React.MouseEvent, idx: number, edge: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startDur = customClipDurations[idx] || clipDuration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const pxPerSec = 40 * timelineZoom;
      const deltaSec = deltaX / pxPerSec;
      const newDur = Math.max(0.5, parseFloat((startDur + (edge === "right" ? deltaSec : -deltaSec)).toFixed(1)));
      setCustomClipDurations((prev) => ({ ...prev, [idx]: newDur }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Helper to recalculate clip durations so that total main clips duration matches VO duration exactly (min 1.0s per clip)
  const syncClipDurationsWithVO = useCallback((
    targetClips: UploadedFootage[],
    targetVODurationSec: number
  ): { [key: number]: number } => {
    if (targetClips.length === 0) return {};

    const endingIdx = targetClips.findIndex((c) => c.name.includes("Cover Akhiran"));
    const endingDur = endingIdx !== -1 ? 3.0 : 0.0;

    const mainClipsCount = endingIdx !== -1 ? targetClips.length - 1 : targetClips.length;
    if (mainClipsCount <= 0) return {};

    const mainTargetDur = targetVODurationSec > 0 ? targetVODurationSec : Math.max(10.0, mainClipsCount * 2.5);
    const minClipDur = 1.0;

    // Calculate total native duration of main clips
    const totalNative = targetClips.reduce((sum, c, idx) => {
      if (idx === endingIdx) return sum;
      return sum + Math.max(1.0, c.duration || 5.0);
    }, 0);

    const newDurMap: { [key: number]: number } = {};
    let accumulated = 0;

    targetClips.forEach((clip, idx) => {
      if (idx === endingIdx) {
        newDurMap[idx] = endingDur;
        return;
      }

      const native = Math.max(1.0, clip.duration || 5.0);
      const weight = totalNative > 0 ? native / totalNative : 1 / mainClipsCount;
      let dur = Math.max(minClipDur, weight * mainTargetDur);

      const isLastMain = (endingIdx !== -1 && idx === mainClipsCount - 1) || (endingIdx === -1 && idx === targetClips.length - 1);
      if (isLastMain) {
        dur = Math.max(minClipDur, parseFloat((mainTargetDur - accumulated).toFixed(2)));
      } else {
        dur = parseFloat(dur.toFixed(2));
        accumulated += dur;
      }

      newDurMap[idx] = dur;
    });

    return newDurMap;
  }, []);

  // Effect to automatically sync clip durations when audioDurationSec or footages count change
  useEffect(() => {
    if (audioDurationSec > 0 && footages.length > 0) {
      const synced = syncClipDurationsWithVO(footages, audioDurationSec);
      setCustomClipDurations(synced);
    }
  }, [audioDurationSec, footages.length, syncClipDurationsWithVO]);

  // Concept Generator: Auto-Cut Center Part & Attach Ending Cover Video
  const handleGenerateConceptVideo = async () => {
    if (footages.length === 0) return alert("Upload minimal 1 klip video / foto!");

    pushHistoryState();
    setIsGeneratingConcept(true);

    try {
      let activeVoDuration = audioDurationSec;
      if ((rawScript || polishedScript) && !audioUrl) {
        await handleGenerateAudio();
      }

      // If user set target duration, use that as the clip sync target (main clips only)
      const effectiveDur = targetDuration > 0 ? targetDuration : (audioUrl && audioDurationSec > 0 ? audioDurationSec : 15.0);
      const targetVoDur = (audioUrl && audioDurationSec > 0) ? audioDurationSec : 15.0;

      const syncedDurMap = syncClipDurationsWithVO(footages, targetVoDur);

      // If targetDuration > VO, extend main clips proportionally
      if (targetDuration > 0 && targetDuration > targetVoDur + 0.5) {
        const extraTime = targetDuration - targetVoDur;
        const endingIdx = footages.findIndex(f => f.name.includes("Cover Akhiran") || f.name.includes("Akhiran"));
        const mainIndices = footages.map((_, i) => i).filter(i => i !== endingIdx);
        const mainTotal = mainIndices.reduce((s, i) => s + (syncedDurMap[i] || clipDuration), 0) || 1;
        mainIndices.forEach((i, pos) => {
          const ratio = (syncedDurMap[i] || clipDuration) / mainTotal;
          if (pos === mainIndices.length - 1) {
            syncedDurMap[i] = parseFloat(Math.max(1, (targetDuration - targetVoDur) - mainIndices.slice(0, -1).reduce((s, j) => s + (syncedDurMap[j] || 0) - (syncedDurMap[j] || 0) + ratio * extraTime, 0)).toFixed(2));
          } else {
            syncedDurMap[i] = parseFloat(Math.max(1, (syncedDurMap[i] || clipDuration) + ratio * extraTime).toFixed(2));
          }
        });
      }

      setCustomClipDurations(syncedDurMap);

      if (includeEndingCover) {
        let endingCoverFile: File;
        try {
          const endingRes = await fetch("/akhiran/ending.png");
          const endingBlob = await endingRes.blob();
          endingCoverFile = new File([endingBlob], "Cover Akhiran Video burjolevelup.png", { type: "image/png" });
        } catch (e) {
          endingCoverFile = new File([], "Cover Akhiran Video burjolevelup.png", { type: "image/png" });
        }
        const endingFootage: UploadedFootage = {
          id: `ending_cover_${Date.now()}`,
          file: endingCoverFile,
          name: "Cover Akhiran (Ending Video)",
          previewUrl: "/akhiran/ending.png",
          duration: 3.0,
          isImage: true,
        };

        setFootages((prev) => {
          const hasEnding = prev.some((f) => f.name.includes("Cover Akhiran"));
          if (hasEnding) return prev;
          const updated = [...prev, endingFootage];
          const updatedDurMap = syncClipDurationsWithVO(updated, targetVoDur);
          // Preserve target duration extension for main clips
          Object.keys(syncedDurMap).forEach(k => {
            const ki = parseInt(k);
            if (ki < updated.length - 1) updatedDurMap[ki] = syncedDurMap[ki];
          });
          updatedDurMap[updated.length - 1] = 3.0; // Ending always 3s
          setCustomClipDurations(updatedDurMap);

          setTransitionsMap((tPrev) => ({
            ...tPrev,
            [updated.length - 2]: "flash-white",
          }));

          return updated;
        });
      }

      setAutoCaptionGenerated(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setViewMode("studio");

      // Process additional instructions via AI Copilot AFTER entering studio
      if (additionalInstructions.trim()) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await handleSendChatMessage(`[Instruksi otomatis dari wizard] ${additionalInstructions}`);
      }
    } catch (err: any) {
      alert(err.message || "Gagal memproses video konsep.");
    } finally {
      setIsGeneratingConcept(false);
    }
  };

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
    // Cover Akhiran always stays flash-white
    setTransitionsMap(ensureEndingTransition(newMap, footages));
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

      const data = await res.json();
      const { audioBase64, audioMime, audioDurationSec: voDur, wordTimings: wt } = data;

      // Convert base64 audio back to Blob
      const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: audioMime || "audio/wav" });
      const file = new File([blob], "voiceover.wav", { type: audioMime || "audio/wav" });
      const objectUrl = URL.createObjectURL(blob);

      setAudioFile(file);
      setAudioUrl(objectUrl);
      setWordTimings([]);

      // Apply exact PCM-computed audio duration immediately
      if (voDur && !isNaN(voDur) && voDur > 0) {
        setAudioDurationSec(voDur);
        setCustomClipDurations(syncClipDurationsWithVO(footages, voDur));
      }

      // Apply word-level timestamps immediately (no async chain needed)
      if (wt && Array.isArray(wt) && wt.length > 0) {
        setWordTimings(wt);
      }

    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Helper: convert Blob to base64 string
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

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

  // Auto Generate Punchy Reel Title from Script
  const handleAutoGenerateTitle = () => {
    const text = (polishedScript || rawScript || customTextOverlay).trim();
    if (!text) {
      setTitleConfig((prev) => ({
        ...prev,
        enabled: true,
        line1: "Renovasi",
        line2: "Coffee Bar",
        subtitle: "burjolevelup",
      }));
      return;
    }

    // Clean text and extract first meaningful clause
    const cleanSentence = text.replace(/^[0-9]+[.)]\s*/, "").split(/[.!?\n]/)[0].trim();
    const words = cleanSentence.split(/\s+/).filter(Boolean);

    if (words.length <= 1) {
      setTitleConfig((prev) => ({
        ...prev,
        enabled: true,
        line1: words[0] || "Promo",
        line2: "Spesial Hari Ini",
        subtitle: "burjolevelup",
      }));
    } else if (words.length === 2) {
      setTitleConfig((prev) => ({
        ...prev,
        enabled: true,
        line1: words[0],
        line2: words[1],
        subtitle: "burjolevelup",
      }));
    } else if (words.length === 3) {
      setTitleConfig((prev) => ({
        ...prev,
        enabled: true,
        line1: words[0],
        line2: `${words[1]} ${words[2]}`,
        subtitle: "burjolevelup",
      }));
    } else if (words.length === 4) {
      setTitleConfig((prev) => ({
        ...prev,
        enabled: true,
        line1: `${words[0]} ${words[1]}`,
        line2: `${words[2]} ${words[3]}`,
        subtitle: "burjolevelup",
      }));
    } else {
      const splitIdx = Math.min(2, Math.floor(words.length / 2));
      setTitleConfig((prev) => ({
        ...prev,
        enabled: true,
        line1: words.slice(0, splitIdx).join(" "),
        line2: words.slice(splitIdx, splitIdx + 2).join(" "),
        subtitle: "burjolevelup",
      }));
    }
  };

  // Render Export Video API
  // ─── Async export with job polling ──────────────────────────────────────────
  const startPollingJob = (jobId: string) => {
    if (renderPollRef.current) clearInterval(renderPollRef.current);
    renderPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/render-status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setRenderJobStatus(data.status);
        setExportProgress(data.progress || 0);
        setRenderJobFrames({ rendered: data.renderedFrames || 0, total: data.totalFrames || 0 });
        if (data.status === "done") {
          clearInterval(renderPollRef.current!);
          renderPollRef.current = null;
          setRenderDownloadUrl(data.downloadUrl);
          setIsExporting(false);
          setExportProgress(100);
        } else if (data.status === "error") {
          clearInterval(renderPollRef.current!);
          renderPollRef.current = null;
          setRenderJobError(data.error || "Render gagal di server.");
          setIsExporting(false);
        }
      } catch (e) {
        console.error("[poll] Error fetching render status:", e);
      }
    }, 3000);
  };

  const handleExportVideo = async () => {
    if (footages.length === 0) return alert("Upload minimal 1 klip video!");

    // Reset previous job state
    setRenderJobId(null);
    setRenderJobStatus(null);
    setRenderJobError(null);
    setRenderDownloadUrl(null);
    setRenderJobFrames({ rendered: 0, total: 0 });
    setExportProgress(5);
    setIsExporting(true);
    if (renderPollRef.current) clearInterval(renderPollRef.current);

    try {
      const formData = new FormData();

      // Ensure all footage files (especially ending cover) have real image bytes
      for (let i = 0; i < footages.length; i++) {
        const f = footages[i];
        if (f.file.size === 0 || f.name.includes("Cover Akhiran") || f.name.includes("Cover_Akhiran") || f.previewUrl.includes("ending") || f.previewUrl.includes("akhiran")) {
        try {
          const endingRes = await fetch("/akhiran/ending.png");
          if (!endingRes.ok) throw new Error("HTTP " + endingRes.status);
          const endingBlob = await endingRes.blob();
          const realEndingFile = new File([endingBlob], "Cover_Akhiran_ending.png", { type: "image/png" });
          formData.append("footages", realEndingFile);
        } catch (e) {
          console.warn("Could not fetch ending cover, using original file:", e);
          formData.append("footages", f.file);
        }
        } else {
          formData.append("footages", f.file);
        }
      }

      if (audioFile) formData.append("voiceOver", audioFile);
      if (bgmFile) formData.append("bgm", bgmFile);
      if (bgmUrl) formData.append("bgmUrl", bgmUrl);
      formData.append("audioDurationSec", audioDurationSec.toString());

      formData.append("subtitleText", polishedScript || rawScript);
      formData.append("editingStyle", editingStyle);
      formData.append("subtitleStyle", subtitleStyle);
      formData.append("subtitleFontSize", subtitleFontSize.toString());
      formData.append("subtitleBottomPos", subtitleBottomPos.toString());
      formData.append("bgmVolume", bgmVolume.toString());
      formData.append("clipDuration", clipDuration.toString());
      formData.append("exportPreset", exportPreset);
      formData.append("aspectRatio", aspectRatio);

      // Target duration — if set and > VO, clips will be extended proportionally
      if (targetDuration > 0) {
        if (audioDurationSec > 0 && targetDuration < audioDurationSec - 0.5) {
          const ok = window.confirm(
            `Peringatan: Target durasi (${targetDuration}s) lebih pendek dari durasi VO (${audioDurationSec.toFixed(1)}s).\n\nVO akan tetap diputar penuh. Target durasi diabaikan.\n\nLanjutkan render?`
          );
          if (!ok) { setIsExporting(false); return; }
        } else {
          formData.append("targetDuration", targetDuration.toString());
        }
      }

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

      // Pass exact preview subtitles & footage metadata from studio workspace
      formData.append("subtitlesJson", JSON.stringify(previewSubtitles));
      formData.append("footagesMetaJson", JSON.stringify(previewFootages.map((f) => ({ duration: f.duration, startFromSec: f.startFromSec || 0, colorGrade: f.colorGrade, isImage: f.isImage }))));

      const startFromSecList = previewFootages.map((f) => f.startFromSec || 0);
      formData.append("startFromSecList", JSON.stringify(startFromSecList));

      // Overlay files + metadata
      if (overlayItems.length > 0) {
        const overlayMeta = overlayItems.map(o => ({
          position: o.position,
          sizePercent: o.sizePercent,
          opacity: o.opacity,
          startSec: o.startSec,
          endSec: o.endSec,
          isVideo: o.isVideo,
        }));
        formData.append("overlayMetaJson", JSON.stringify(overlayMeta));
        overlayItems.forEach(o => formData.append("overlayFiles", o.file));
      }

      // Title & Opening Header Overlay (Reel Style)
      if (titleConfig.enabled && (titleConfig.line1 || titleConfig.line2)) {
        formData.append("titleConfigJson", JSON.stringify(titleConfig));
      }

      // Submit job — server returns jobId immediately
      const res = await fetch("/api/render-video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const { jobId } = await res.json();
      setRenderJobId(jobId);
      setRenderJobStatus("pending");
      setExportProgress(10);

      // Start polling every 3 seconds
      startPollingJob(jobId);

    } catch (err: any) {
      setIsExporting(false);
      alert(err.message || "Terjadi kesalahan saat memulai render.");
    }
  };

  // Memoize Remotion Composition Props to prevent @remotion/player re-initialization loops during playback
  const previewFootages: FootageItem[] = useMemo(() => {
    return footages.map((f, idx) => {
      const dur = customClipDurations[idx] || clipDuration;
      const isImg = Boolean(
        f.isImage ||
        f.file?.type?.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(f.name) ||
        /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)($|\?)/i.test(f.previewUrl) ||
        f.name.includes("Cover Akhiran") ||
        f.name.includes("ending") ||
        f.name.includes("akhiran")
      );
      return {
        url: f.previewUrl,
        duration: dur,
        startFromSec: f.startFromSec || 0,
        colorGrade: editingStyle,
        isImage: isImg,
      };
    });
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
    const clean = textToSplit.trim();
    if (!clean) return [];

    // Split script into comfortable, relaxed 6-8 word phrase chunks aligned with punctuation clauses
    const clauses = clean.split(/(?<=[.!?,\n;:])\s+/).filter(Boolean);
    const chunks: string[] = [];

    for (const clause of clauses) {
      const words = clause.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      if (words.length <= 8) {
        chunks.push(words.join(" "));
      } else {
        for (let i = 0; i < words.length; i += 6) {
          const sub = words.slice(i, i + 6);
          if (i + 6 < words.length && words.length - (i + 6) <= 2) {
            chunks.push(words.slice(i, i + 8).join(" "));
            i += 2;
          } else {
            chunks.push(sub.join(" "));
          }
        }
      }
    }

    return chunks.length > 0 ? chunks : [clean];
  }, [textToSplit]);

  const totalVideoDurationSec = useMemo(() => {
    return previewFootages.reduce((acc, f) => acc + f.duration, 0) || 10;
  }, [previewFootages]);

  const previewSubtitles: SubtitleChunk[] = useMemo(() => {
    if (!autoCaptionGenerated || textChunks.length === 0) return [];

    const targetSpanDuration = (audioUrl && audioDurationSec > 0)
      ? audioDurationSec
      : totalVideoDurationSec;

    // === USE REAL WORD TIMESTAMPS — Build chunks at actual SILENCE BOUNDARIES from VAD ===
    // This is the key insight: instead of splitting at word count, split wherever the TTS audio
    // goes silent for ≥ SILENCE_GAP_THRESHOLD seconds. This makes subtitle gaps match VO gaps.
    if (wordTimings && wordTimings.length > 0) {
      const SILENCE_GAP_THRESHOLD = 0.18; // 180ms gap → new subtitle card (ignore breathing)
      const MAX_WORDS_PER_CARD = 8;        // hard cap for readability

      const results: SubtitleChunk[] = [];
      let cardWords: typeof wordTimings = [];

      const flushCard = (holdUntil?: number) => {
        if (cardWords.length === 0) return;
        const text = cardWords.map(w => w.word).join(" ");
        const startSec = cardWords[0].start;
        // Card ends at last word's end, OR at holdUntil (seamless into next card if no gap)
        const naturalEnd = cardWords[cardWords.length - 1].end;
        const endSec = holdUntil !== undefined ? holdUntil : naturalEnd;
        results.push({
          text,
          start: parseFloat(startSec.toFixed(3)),
          end: parseFloat(Math.min(targetSpanDuration, endSec).toFixed(3)),
        });
        cardWords = [];
      };

      for (let i = 0; i < wordTimings.length; i++) {
        cardWords.push(wordTimings[i]);

        const isLast = i === wordTimings.length - 1;
        const nextWord = !isLast ? wordTimings[i + 1] : null;
        const gapToNext = nextWord ? nextWord.start - wordTimings[i].end : 0;

        const isSilenceBreak = gapToNext >= SILENCE_GAP_THRESHOLD;
        const isMaxWords = cardWords.length >= MAX_WORDS_PER_CARD;

        if (isLast) {
          // Last card: extend to end of audio
          flushCard(targetSpanDuration);
        } else if (isSilenceBreak) {
          // Real silence → end card here, leave the gap EMPTY (no subtitle during silence)
          flushCard(/* no holdUntil → card ends at last word's end */);
        } else if (isMaxWords) {
          // Word count cap → hold seamlessly to next word (no visible gap)
          flushCard(nextWord!.start);
        }
      }

      return results;
    }

    // === FALLBACK: Syllable-count weighted pacing with punctuation silence gaps ===
    const countSyl = (word: string): number => {
      const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
      const vowels = cleaned.match(/[aeiouáéíóúàèìòùäëïöü]+/g);
      return Math.max(1, vowels ? vowels.length : 1);
    };

    type SilToken = { chunkIdx: number; weight: number; isSilence: boolean };
    const tokens: SilToken[] = [];
    for (let ci = 0; ci < textChunks.length; ci++) {
      const chunkWords = textChunks[ci].split(/\s+/).filter(Boolean);
      let chunkWeight = 0;
      let lastWordHasMajorPause = false;
      let lastWordHasMinorPause = false;
      for (const w of chunkWords) {
        if (/[.!?]$/.test(w)) lastWordHasMajorPause = true;
        else if (/[,;:]$/.test(w)) lastWordHasMinorPause = true;
        const cleanW = w.replace(/[.,!?;:"""''()\[\]]/g, "");
        chunkWeight += countSyl(cleanW) + cleanW.length * 0.15;
      }
      tokens.push({ chunkIdx: ci, weight: Math.max(1, chunkWeight), isSilence: false });
      if (lastWordHasMajorPause) tokens.push({ chunkIdx: -1, weight: 4.0, isSilence: true });
      else if (lastWordHasMinorPause) tokens.push({ chunkIdx: -1, weight: 2.0, isSilence: true });
    }

    const totalWeight = tokens.reduce((a, t) => a + t.weight, 0) || 1;
    const results: SubtitleChunk[] = [];
    let currentAccSec = 0;
    for (const token of tokens) {
      const dur = (token.weight / totalWeight) * targetSpanDuration;
      if (!token.isSilence) {
        results.push({
          text: textChunks[token.chunkIdx],
          start: parseFloat(currentAccSec.toFixed(3)),
          end: parseFloat(Math.min(targetSpanDuration, currentAccSec + dur).toFixed(3)),
        });
      }
      currentAccSec += dur;
    }
    return results;
  }, [textChunks, autoCaptionGenerated, audioUrl, audioDurationSec, totalVideoDurationSec, wordTimings]);

  const remotionCompositionProps: MainCompositionProps = useMemo(() => ({
    footages: previewFootages,
    transitions: previewTransitions,
    subtitles: previewSubtitles,
    titleConfig: titleConfig.enabled ? titleConfig : undefined,
    voiceOverUrl: audioUrl || undefined,
    bgmUrl: bgmUrl || undefined,
    bgmVolume: bgmVolume,
    subtitleStyle: subtitleStyle,
    subtitleFontSize: subtitleFontSize,
    subtitleBottomPos: subtitleBottomPos,
    clipDuration: clipDuration,
  }), [
    previewFootages,
    previewTransitions,
    previewSubtitles,
    titleConfig,
    audioUrl,
    bgmUrl,
    bgmVolume,
    subtitleStyle,
    subtitleFontSize,
    subtitleBottomPos,
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

  // Handle transfer from Video AI to Klip AI editor
  const handleSendFromVideoAIToKlipAI = useCallback((projectData: any) => {
    if (!projectData) return;
    if (projectData.fullScript) setRawScript(projectData.fullScript);
    if (projectData.voice) setSelectedVoice(projectData.voice);
    if (projectData.bgmId) {
      const track = PRESET_VIRAL_BGM_TRACKS.find((t) => t.id === projectData.bgmId);
      if (track) setBgmUrl(track.url);
    }

    if (projectData.scenes && Array.isArray(projectData.scenes)) {
      const newFootages: UploadedFootage[] = projectData.scenes.map((sc: any, idx: number) => ({
        id: `ai-scene-${idx}-${Date.now()}`,
        file: new File([], `Scene ${sc.sceneNumber || idx + 1}.png`),
        previewUrl: sc.visualUrl || "/generated-ai/placeholder.jpg",
        name: sc.overlayTitle ? `${sc.overlayTitle} (Scene ${idx + 1})` : `Scene ${idx + 1}`,
        duration: sc.duration || 5,
        startFromSec: 0,
        isImage: true,
      }));
      setFootages(newFootages);
    }

    setActiveAppTab("klip-ai");
    setViewMode("studio");
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121215] text-slate-100 font-sans select-none overflow-hidden relative">
      {/* GLOBAL NAVBAR ACROSS 3 MAIN FEATURES */}
      <Navbar
        activeTab={activeAppTab}
        onTabChange={setActiveAppTab}
      />

      {/* FEATURE 2: VIDEO AI (GEMINI ENGINE) */}
      {activeAppTab === "video-ai" && (
        <div className="flex-1 overflow-y-auto">
          <VideoAIChat apiKey={apiKey} />
        </div>
      )}

      {/* FEATURE 3: ANIMASI AI (COMING SOON) */}
      {activeAppTab === "animasi-ai" && (
        <div className="flex-1 overflow-y-auto">
          <AnimasiAIPlaceholder
            onExploreVideoAI={() => setActiveAppTab("video-ai")}
          />
        </div>
      )}

      {/* FEATURE 1: KLIP AI (EXISTING AUTO VIDEO EDITOR) */}
      {activeAppTab === "klip-ai" && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* CONCEPT GENERATION FULL-SCREEN ANIMATED LOADING OVERLAY */}
          {isGeneratingConcept && (
            <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="max-w-md w-full p-8 bg-[#18181c] border border-indigo-500/40 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-600/30 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-600/30 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 p-0.5 animate-spin">
                      <div className="w-full h-full bg-[#121215] rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-amber-300 animate-pulse" />
                      </div>
                    </div>
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin absolute inset-0 m-auto" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-white tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-amber-300 bg-clip-text text-transparent">
                      Memproses Video Konsep AI...
                    </h3>
                    <p className="text-xs text-slate-400">
                      AI sedang memotong bagian tengah klip, menyinkronkan voice over & memasang cover akhiran.
                    </p>
                  </div>

                  <div className="w-full space-y-2 pt-2 border-t border-[#27272a]">
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Center Part Auto-Cut Trim Active</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-indigo-300 font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sinkronisasi Durasi VO & Buka Studio...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TOP HEADER BAR FOR KLIP AI WITH WIZARD / STUDIO SWITCH */}
          <div className="h-11 bg-[#18181c] border-b border-[#27272a] px-4 flex items-center justify-between text-xs font-bold z-40 flex-shrink-0">
            <div className="flex items-center gap-2 text-slate-300">
              <Film className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-extrabold text-white">
                Klip AI Workspace
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-xl border border-[#27272a]">
              <button
                onClick={() => setViewMode("wizard")}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "wizard"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-extrabold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Wizard Generator</span>
              </button>
              <button
                onClick={() => setViewMode("studio")}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "studio"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-extrabold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <VideoIcon className="w-3.5 h-3.5" />
                <span>Studio Workspace</span>
              </button>
            </div>
          </div>

          {viewMode === "wizard" ? (
        /* 1. LANDING PAGE: STUNNING VISUAL GENERATOR WIZARD VIEW */
        <div className="flex-1 bg-[#09090b] overflow-y-auto p-4 md:p-8 pb-24 flex flex-col items-center justify-start relative scroll-smooth">
          {/* BACKGROUND GLOW ACCENTS */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl w-full space-y-6 bg-[#121215]/90 backdrop-blur-xl border border-[#27272a] rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 my-4">
            {/* HERO HEADER */}
            <div className="text-center space-y-2 pb-2 border-b border-[#27272a]/60">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-extrabold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>AI Video Generator Studio</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Buat Video Viral Otomatis dalam 1-Klik
              </h1>
              <p className="text-xs text-slate-400 max-w-xl mx-auto">
                Cukup masukkan naskah & klip media. AI memotong bagian tengah klip, membuat VO & caption, lalu memasang cover akhiran secara otomatis.
              </p>
            </div>

            {/* STEP 1: NASKAH VOICE OVER & VOICE CHARACTER CARDS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-indigo-400 flex items-center gap-2 tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-[10px]">1</span>
                  TULIS NASKAH & PILIH SUARA AI
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Multi-Voice Speech Engine</span>
              </div>

              <textarea
                rows={4}
                placeholder="Ketik naskah video Anda di sini (contoh: Nikmati sensasi kuliner boba terlezat dengan promo spesial minggu ini...)..."
                value={rawScript}
                onChange={(e) => setRawScript(e.target.value)}
                className="w-full text-xs p-3.5 rounded-2xl bg-[#09090b] border border-[#27272a] focus:border-indigo-500 text-slate-100 placeholder-slate-600 outline-none resize-y min-h-[90px] transition-all shadow-inner select-text"
              />

              {/* VISUAL VOICE SELECTION GRID (COMPACT VISUAL CARDS) */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { id: "Zephyr", name: "Zephyr", gender: "♂ Pria", tag: "Warm & Energetik", bg: "from-amber-500/20 to-orange-500/10", border: "border-amber-500/50" },
                  { id: "Puck", name: "Puck", gender: "♀ Wanita", tag: "Soft & Lembut", bg: "from-pink-500/20 to-rose-500/10", border: "border-pink-500/50" },
                  { id: "Kore", name: "Kore", gender: "♀ Wanita", tag: "Formal & Berwibawa", bg: "from-purple-500/20 to-indigo-500/10", border: "border-purple-500/50" },
                  { id: "Fenrir", name: "Fenrir", gender: "♂ Pria", tag: "Cinematic Deep", bg: "from-blue-500/20 to-cyan-500/10", border: "border-blue-500/50" },
                  { id: "Aoede", name: "Aoede", gender: "♀ Wanita", tag: "Ceria Commercial", bg: "from-emerald-500/20 to-teal-500/10", border: "border-emerald-500/50" },
                  { id: "Charon", name: "Charon", gender: "♂ Pria", tag: "Kasual Vlog", bg: "from-slate-500/20 to-zinc-500/10", border: "border-slate-500/50" },
                ].map((v) => {
                  const isSelected = selectedVoice === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${isSelected
                          ? `bg-gradient-to-r ${v.bg} ${v.border} ring-2 ring-indigo-500/50 shadow-lg scale-[1.02]`
                          : "border-[#27272a] bg-[#09090b]/80 hover:border-slate-600"
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-slate-100 text-xs">{v.name}</p>
                          <span className="text-[9px] font-bold text-slate-400 bg-[#18181c] px-1.5 py-0.2 rounded border border-[#27272a]">{v.gender}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5 truncate">{v.tag}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: GAYA SUBTITLE AUTO CAPTION (LIVE MINI PREVIEW CARDS) */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-black text-purple-400 flex items-center gap-2 tracking-wider">
                <span className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center text-[10px]">2</span>
                GAYA AUTO CAPTION SUBTITLE
              </label>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { id: "plain-shadow", label: "Clean Shadow", preview: "Teks Shadow", previewStyle: "text-white font-extrabold drop-shadow-md" },
                  { id: "yellow-highlight", label: "Yellow Highlight", preview: "Highlight Kata", previewStyle: "bg-yellow-400 text-black font-extrabold px-2 py-0.5 rounded shadow" },
                  { id: "bold-outline", label: "Bold Outline", preview: "Bold Outline", previewStyle: "text-white font-black stroke-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" },
                  { id: "neon-glow", label: "Cyber Neon", preview: "Cyan Neon", previewStyle: "bg-cyan-400 text-black font-extrabold px-2 py-0.5 rounded shadow-lg shadow-cyan-500/50" },
                  { id: "minimalist", label: "Minimalist Box", preview: "Dark Box", previewStyle: "bg-black/90 text-white font-extrabold px-2 py-0.5 rounded border border-white/30" },
                ].map((s) => {
                  const isSelected = subtitleStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSubtitleStyle(s.id)}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-between gap-2.5 transition-all cursor-pointer ${isSelected
                          ? "border-purple-500 bg-purple-950/40 ring-2 ring-purple-500/50 shadow-lg scale-[1.02]"
                          : "border-[#27272a] bg-[#09090b]/80 hover:border-slate-600"
                        }`}
                    >
                      <span className="text-[10px] font-black text-slate-300">{s.label}</span>
                      {/* LIVE MINI VISUAL PREVIEW BOX */}
                      <div className="w-full h-8 bg-[#18181c] rounded-xl flex items-center justify-center overflow-hidden border border-[#27272a]">
                        <span className={`text-[10px] ${s.previewStyle}`}>{s.preview}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: JUDUL OPENING VIDEO (REELS STYLE & ANIMASI IN/OUT ELEGAN) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-amber-400 flex items-center gap-2 tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-amber-600/30 border border-amber-500/40 text-amber-300 flex items-center justify-center text-[10px]">3</span>
                  JUDUL OPENING VIDEO (REELS STYLE)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoGenerateTitle}
                    className="text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Auto Judul dari Naskah
                  </button>
                  <button
                    onClick={() => setTitleConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${titleConfig.enabled
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-[#18181c] border-[#27272a] text-slate-400"
                      }`}
                  >
                    {titleConfig.enabled ? "✓ Aktif" : "Nonaktif"}
                  </button>
                </div>
              </div>

              {titleConfig.enabled && (
                <div className="p-3.5 rounded-2xl bg-[#09090b]/90 border border-amber-500/30 space-y-3 shadow-lg">
                  {/* INPUTS ROW */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 mb-1 block">Baris 1 (Utama)</label>
                      <input
                        type="text"
                        placeholder="Contoh: Renovasi"
                        value={titleConfig.line1}
                        onChange={(e) => setTitleConfig((prev) => ({ ...prev, line1: e.target.value }))}
                        className="w-full text-xs font-black p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] text-white focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-300">Baris 2 (Aksen)</label>
                        <label className="flex items-center gap-1 text-[9px] text-amber-400 cursor-pointer font-bold">
                          <input
                            type="checkbox"
                            checked={titleConfig.italicLine2 ?? true}
                            onChange={(e) => setTitleConfig((prev) => ({ ...prev, italicLine2: e.target.checked }))}
                            className="accent-amber-500 rounded"
                          />
                          Italic
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder="Contoh: Coffee Bar"
                        value={titleConfig.line2 || ""}
                        onChange={(e) => setTitleConfig((prev) => ({ ...prev, line2: e.target.value }))}
                        className={`w-full text-xs font-black p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] text-white focus:border-amber-500 outline-none ${titleConfig.italicLine2 !== false ? "italic" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 mb-1 block">Baris 3 (Badge/Handle)</label>
                      <input
                        type="text"
                        placeholder="Contoh: burjolevelup"
                        value={titleConfig.subtitle || ""}
                        onChange={(e) => setTitleConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                        className="w-full text-xs font-semibold p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] text-slate-200 focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* TIMING & DURATION CONTROLS */}
                  <div className="p-2.5 rounded-xl bg-[#18181c] border border-[#27272a] space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        ⏱️ Durasi Muncul Judul:
                        <span className="text-amber-400 font-mono font-black">{titleConfig.durationSec ?? 3.8} detik</span>
                      </span>
                      <span className="text-[9px] text-slate-500">Mulai dari {titleConfig.startSec ?? 0}s</span>
                    </div>

                    <input
                      type="range"
                      min="1.0"
                      max="12.0"
                      step="0.2"
                      value={titleConfig.durationSec ?? 3.8}
                      onChange={(e) => setTitleConfig((prev) => ({ ...prev, durationSec: parseFloat(e.target.value) }))}
                      className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                    />

                    {/* QUICK PRESET BUTTONS */}
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[
                        { label: "2.0s (Cepat)", sec: 2.0 },
                        { label: "3.5s (Standar)", sec: 3.5 },
                        { label: "5.0s (Panjang)", sec: 5.0 },
                        { label: "Full Video", sec: totalVideoDurationSec > 0 ? totalVideoDurationSec : 15.0 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setTitleConfig((prev) => ({ ...prev, durationSec: p.sec }))}
                          className={`py-1 rounded text-[9px] font-extrabold transition-all cursor-pointer ${
                            (titleConfig.durationSec ?? 3.8) === p.sec
                              ? "bg-amber-500 text-black shadow font-black"
                              : "bg-[#09090b] text-slate-400 hover:text-slate-200 border border-[#27272a]"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ANIMATION PRESETS */}
                  <div className="space-y-3 pt-1 border-t border-[#27272a]/60">
                    {/* IN ANIMATION (8 OPTIONS) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Animasi Masuk (8 Opsi Pilihan)</span>
                        <span className="text-[9px] text-amber-400 font-bold">✨ Smooth Cinematic Springs</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {TITLE_IN_ANIMATIONS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setTitleConfig((prev) => ({ ...prev, animationIn: a.id as any }))}
                            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                              titleConfig.animationIn === a.id || (!titleConfig.animationIn && a.id === "spring-pop")
                                ? "bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/40 shadow-sm"
                                : "bg-[#18181c] border-[#27272a] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-1 font-extrabold text-[10px] text-white">
                              <span>{a.icon}</span>
                              <span className="truncate">{a.label}</span>
                            </div>
                            <p className="text-[8px] text-slate-400 line-clamp-1 mt-0.5">{a.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* OUT ANIMATION (6 OPTIONS) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Animasi Keluar (6 Opsi Pilihan)</span>
                        <span className="text-[9px] text-slate-500">Menghilang pada akhir durasi</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {TITLE_OUT_ANIMATIONS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setTitleConfig((prev) => ({ ...prev, animationOut: a.id as any }))}
                            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                              titleConfig.animationOut === a.id || (!titleConfig.animationOut && a.id === "blur-dissolve")
                                ? "bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/40 shadow-sm"
                                : "bg-[#18181c] border-[#27272a] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-1 font-extrabold text-[10px] text-white">
                              <span>{a.icon}</span>
                              <span className="truncate">{a.label}</span>
                            </div>
                            <p className="text-[8px] text-slate-400 line-clamp-1 mt-0.5">{a.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* LIVE MINI PREVIEW OF TITLE */}
                  <div className="p-3 bg-[#121216] rounded-xl border border-[#27272a] flex flex-col items-center justify-center text-center">
                    <p className="text-xl font-black text-white leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                      {titleConfig.line1 || "Renovasi"}
                    </p>
                    {titleConfig.line2 && (
                      <p className={`text-xl font-black text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] ${titleConfig.italicLine2 !== false ? "italic" : ""}`}>
                        {titleConfig.line2}
                      </p>
                    )}
                    {titleConfig.subtitle && (
                      <p className="text-xs font-bold text-white/90 mt-1.5 tracking-wide drop-shadow-md">
                        {titleConfig.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* STEP 4: UPLOAD MEDIA FOOTAGES (AUTO-CUT CENTER PART) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-400 flex items-center gap-2 tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-[10px]">4</span>
                  UPLOAD KLIP VIDEO / FOTO
                </label>
                <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ✨ Smart Center Auto-Trim Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="py-4 px-4 bg-[#09090b]/80 hover:bg-[#18181c] border-2 border-dashed border-[#27272a] hover:border-indigo-500 rounded-2xl text-xs font-bold flex items-center gap-3 cursor-pointer transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <VideoIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-slate-200 font-extrabold text-xs">Video (MP4 / MOV)</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Upload klip video</p>
                  </div>
                  <input type="file" multiple accept="video/*" onChange={handleFootageUpload} className="hidden" />
                </label>

                <label className="py-4 px-4 bg-[#09090b]/80 hover:bg-[#18181c] border-2 border-dashed border-[#27272a] hover:border-purple-500 rounded-2xl text-xs font-bold flex items-center gap-3 cursor-pointer transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-slate-200 font-extrabold text-xs">Foto (PNG / JPG / HEIC)</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Upload gambar foto</p>
                  </div>
                  <input type="file" multiple accept="image/*,.heic,.heif,.png,.jpg,.jpeg,.webp,.gif" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>

              {footages.length > 0 && (
                <div className="p-3 bg-[#09090b] rounded-2xl border border-[#27272a] text-xs font-extrabold text-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{footages.length} Klip Media Ter-upload</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Otomatis dipotong bagian tengahnya
                  </span>
                </div>
              )}
            </div>

            {/* STEP 5: COVER AKHIRAN VIDEO TOGGLE CARD */}
            <div className="pt-2">
              <div
                onClick={() => setIncludeEndingCover(!includeEndingCover)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${includeEndingCover
                    ? "border-amber-500/60 bg-amber-950/30 ring-1 ring-amber-500/40"
                    : "border-[#27272a] bg-[#09090b]/80"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeEndingCover}
                    onChange={(e) => setIncludeEndingCover(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                  />
                  <div>
                    <p className="font-extrabold text-slate-100 text-xs flex items-center gap-1.5">
                      Gunakan Cover Akhiran Video
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                        Otomatis
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Menambahkan cover penutup default di bagian akhir video secara otomatis
                    </p>
                  </div>
                </div>
                <div className="w-12 h-8 rounded-lg border border-amber-500/40 overflow-hidden bg-black flex-shrink-0 shadow">
                  <img src="/akhiran/ending.png" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            {/* STEP 5: TARGET DURATION & ADDITIONAL INSTRUCTIONS (Fitur 2) */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-black text-sky-400 flex items-center gap-2 tracking-wider">
                <span className="w-5 h-5 rounded-full bg-sky-600/30 border border-sky-500/40 text-sky-300 flex items-center justify-center text-[10px]">5</span>
                INSTRUKSI TAMBAHAN (Opsional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400">⏱️ Target Durasi Video</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      max="300"
                      step="5"
                      value={targetDuration || ""}
                      onChange={(e) => setTargetDuration(parseFloat(e.target.value) || 0)}
                      placeholder="cth: 30"
                      className="w-full px-3 py-2 pr-10 bg-[#09090b] border border-[#27272a] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">detik</span>
                  </div>
                  {targetDuration > 0 && audioDurationSec > 0 && targetDuration < audioDurationSec - 0.5 && (
                    <p className="text-[9px] text-amber-400">⚠️ Target ({targetDuration}s) lebih pendek dari VO ({audioDurationSec.toFixed(0)}s)</p>
                  )}
                  {targetDuration > 0 && audioDurationSec > 0 && targetDuration > audioDurationSec + 0.5 && (
                    <p className="text-[9px] text-sky-400">✓ Klip akan dipanjangkan {(targetDuration - audioDurationSec).toFixed(0)}s tanpa VO</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400">📝 Catatan ke AI</span>
                  <textarea
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="cth: buat tone lebih fun, tambah emosi dramatis..."
                    rows={3}
                    className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-[10px] text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/30 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* HERO FLOATING GENERATE BUTTON */}
            <button
              onClick={handleGenerateConceptVideo}
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-black text-sm rounded-2xl shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Sparkles className="w-5 h-5 text-amber-300 animate-bounce" />
              <span>GENERATE VIDEO KONSEP & BUKA STUDIO WORKSPACE</span>
            </button>

          </div>
        </div>
      ) : (
        /* 2. CAPCUT WEB STUDIO WORKSPACE VIEW (RESPONSIVE MOBILE & TABLET & DESKTOP) */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* MAIN TOP SECTION: LEFT NAV + SECONDARY PANEL + PROGRAM MONITOR + AI CHAT */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* 1. LEFT-MOST SLIM ICON NAVIGATION BAR (RESPONSIVE SLIM) */}
            <div className="w-12 sm:w-16 bg-[#18181c] border-r border-[#27272a] flex flex-col items-center py-3 gap-3 z-40 flex-shrink-0">
              {[
                { id: "generate", label: "Generate", icon: Sparkles },
                { id: "video", label: "Video", icon: VideoIcon },
                { id: "photo", label: "Photo", icon: ImageIcon },
                { id: "audio", label: "Audio", icon: Music },
                { id: "overlay", label: "Overlay", icon: Layers },
                { id: "text", label: "Text", icon: Type },
                { id: "effects", label: "Effects", icon: Zap },
                { id: "caption", label: "Caption", icon: Subtitles },
                { id: "filter", label: "Filter", icon: Sliders },
              ].map((nav) => {
                const Icon = nav.icon;
                const isActive = activeNavTab === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => setActiveNavTab(nav.id as any)}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${isActive
                        ? "bg-[#27272a] text-white font-bold border border-[#3f3f46] shadow-md"
                        : "text-slate-400 hover:bg-[#27272a]/50 hover:text-slate-200"
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[8px] sm:text-[9px] leading-none hidden sm:inline">{nav.label}</span>
                    {isActive && <div className="absolute right-0 top-2 bottom-2 w-1 bg-white rounded-l-full" />}
                  </button>
                );
              })}
            </div>

            {/* 2. SECONDARY MEDIA ASSET PANEL (RESPONSIVE FLEX SHRINK W-64 to W-80) */}
            <div className="w-64 sm:w-72 lg:w-80 bg-[#18181c] border-r border-[#27272a] flex flex-col overflow-hidden z-30 flex-shrink-0">
              {/* HEADER BAR FOR MEDIA GRID */}
              <div className="p-2.5 sm:p-3 border-b border-[#27272a] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button className="p-1 rounded hover:bg-[#27272a] text-slate-300">
                    <Grid className="w-4 h-4" />
                  </button>
                  <button className="p-1 rounded hover:bg-[#27272a] text-slate-300">
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>

                <label className="px-2.5 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border border-[#3f3f46]">
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
                      <span>Daftar Video ({footages.length})</span>
                      <span className="text-[10px] text-slate-400">MP4 / MOV</span>
                    </div>

                    {footages.length === 0 ? (
                      <div className="border-2 border-dashed border-[#27272a] rounded-xl p-6 text-center space-y-2">
                        <VideoIcon className="w-7 h-7 text-slate-500 mx-auto" />
                        <p className="text-xs text-slate-400 font-bold">Belum ada video</p>
                        <p className="text-[10px] text-slate-500">Klik Upload untuk memilih file video</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {footages.map((clip, idx) => {
                          const isImg = clip.isImage || clip.file?.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(clip.name) || clip.name.includes("Cover Akhiran");
                          return (
                            <div
                              key={clip.id}
                              onClick={() => setSelectedClipIndex(idx)}
                              className={`rounded-xl overflow-hidden border bg-[#09090b] relative group cursor-pointer transition-all ${selectedClipIndex === idx ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-[#27272a] hover:border-slate-500"
                                }`}
                            >
                              <div className="w-full aspect-video bg-black relative overflow-hidden">
                                {isImg ? (
                                  <img
                                    src={clip.previewUrl}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <video src={clip.previewUrl} className="w-full h-full object-cover" />
                                )}
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: TEXT OVERLAY & JUDUL OPENING */}
                {activeNavTab === "text" && (
                  <div className="space-y-3">
                    {/* SEGMENTED TAB SWITCHER */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#09090b] rounded-xl border border-[#27272a]">
                      <button
                        onClick={() => setTextTabSection("title")}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${textTabSection === "title"
                            ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                            : "text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        Judul Opening (Reels)
                      </button>
                      <button
                        onClick={() => setTextTabSection("subtitle")}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${textTabSection === "subtitle"
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                            : "text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        <Subtitles className="w-3 h-3" />
                        Auto Subtitle
                      </button>
                    </div>

                    {/* ════════════════ SECTION 1: JUDUL OPENING (REELS STYLE) ════════════════ */}
                    {textTabSection === "title" && (
                      <div className="space-y-3">
                        {/* TOGGLE & QUICK ACTIONS HEADER */}
                        <div className="p-2.5 rounded-xl bg-[#09090b] border border-amber-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="toggleTitleCheck"
                              checked={titleConfig.enabled}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                              className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                            />
                            <label htmlFor="toggleTitleCheck" className="text-xs font-black text-amber-300 cursor-pointer">
                              Aktifkan Judul Video
                            </label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={handleAutoGenerateTitle}
                              className="text-[9px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              Auto Naskah
                            </button>
                            <button
                              onClick={() => setSeekToSec(titleConfig.startSec ?? 0)}
                              className="text-[9px] font-bold text-slate-200 bg-[#18181c] hover:bg-slate-700 px-2 py-1 rounded-lg border border-[#27272a] flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5 text-amber-400" />
                              Preview
                            </button>
                          </div>
                        </div>

                        {/* TEXT INPUTS HIERARCHY */}
                        <div className="space-y-2 p-2.5 rounded-xl bg-[#09090b] border border-[#27272a]">
                          <div>
                            <label className="text-[10px] font-bold text-slate-300 mb-1 block">Baris 1 (Judul Utama)</label>
                            <input
                              type="text"
                              placeholder="Contoh: Renovasi"
                              value={titleConfig.line1}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, line1: e.target.value }))}
                              className="w-full text-xs font-black p-2 rounded-lg bg-[#18181c] border border-[#27272a] text-white focus:border-amber-500 outline-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-slate-300">Baris 2 (Aksen / Sub-Judul)</label>
                              <label className="flex items-center gap-1 text-[9px] text-amber-400 cursor-pointer font-bold">
                                <input
                                  type="checkbox"
                                  checked={titleConfig.italicLine2 ?? true}
                                  onChange={(e) => setTitleConfig((prev) => ({ ...prev, italicLine2: e.target.checked }))}
                                  className="accent-amber-500 rounded"
                                />
                                Miring (Italic)
                              </label>
                            </div>
                            <input
                              type="text"
                              placeholder="Contoh: Coffee Bar"
                              value={titleConfig.line2 || ""}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, line2: e.target.value }))}
                              className={`w-full text-xs font-black p-2 rounded-lg bg-[#18181c] border border-[#27272a] text-white focus:border-amber-500 outline-none ${titleConfig.italicLine2 !== false ? "italic" : ""}`}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-300 mb-1 block">Baris 3 (Badge / Akun / Tag)</label>
                            <input
                              type="text"
                              placeholder="Contoh: burjolevelup atau @username"
                              value={titleConfig.subtitle || ""}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                              className="w-full text-xs font-semibold p-2 rounded-lg bg-[#18181c] border border-[#27272a] text-slate-200 focus:border-amber-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* GAYA DESAIN PRESET */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preset Desain Judul</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: "reel-aesthetic", label: "Reel Aesthetic (Foto)" },
                              { id: "bold-impact", label: "Bold Impact" },
                              { id: "chic-luxury", label: "Chic Luxury Serif" },
                              { id: "pill-badge", label: "Pill Tag Badge" },
                            ].map((st) => (
                              <button
                                key={st.id}
                                onClick={() => setTitleConfig((prev) => ({ ...prev, style: st.id as any }))}
                                className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-left ${titleConfig.style === st.id
                                    ? "border-amber-500 bg-amber-950/60 text-amber-200 ring-1 ring-amber-500/40"
                                    : "border-[#27272a] bg-[#09090b] text-slate-400 hover:border-slate-600"
                                  }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* TIMING & DURATION CONTROLS */}
                        <div className="p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-slate-300 flex items-center gap-1">
                              ⏱️ Durasi Tampil Judul
                            </span>
                            <span className="text-amber-400 font-mono font-black">{titleConfig.durationSec ?? 3.8} detik</span>
                          </div>

                          <input
                            type="range"
                            min="1.0"
                            max="12.0"
                            step="0.2"
                            value={titleConfig.durationSec ?? 3.8}
                            onChange={(e) => setTitleConfig((prev) => ({ ...prev, durationSec: parseFloat(e.target.value) }))}
                            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                          />

                          {/* QUICK PRESET BUTTONS */}
                          <div className="grid grid-cols-4 gap-1 pt-1">
                            {[
                              { label: "2.0s (Cepat)", sec: 2.0 },
                              { label: "3.5s (Standar)", sec: 3.5 },
                              { label: "5.0s (Panjang)", sec: 5.0 },
                              { label: "Full Video", sec: totalVideoDurationSec > 0 ? totalVideoDurationSec : 15.0 },
                            ].map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => setTitleConfig((prev) => ({ ...prev, durationSec: p.sec }))}
                                className={`py-1 rounded text-[9px] font-extrabold transition-all cursor-pointer ${
                                  (titleConfig.durationSec ?? 3.8) === p.sec
                                    ? "bg-amber-500 text-black shadow font-black"
                                    : "bg-[#18181c] text-slate-400 hover:text-slate-200 border border-[#27272a]"
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* IN ANIMATION SELECTION (8 OPTIONS) */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Animasi Masuk (In - 8 Opsi)</span>
                            <span className="text-[9px] text-amber-400">Klik untuk Preview</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {TITLE_IN_ANIMATIONS.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => {
                                  setTitleConfig((prev) => ({ ...prev, animationIn: a.id as any }));
                                  setSeekToSec(titleConfig.startSec ?? 0);
                                }}
                                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                                  titleConfig.animationIn === a.id || (!titleConfig.animationIn && a.id === "spring-pop")
                                    ? "bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/30"
                                    : "bg-[#09090b] border-[#27272a] text-slate-400 hover:border-slate-600"
                                }`}
                              >
                                <div className="flex items-center gap-1 font-bold text-[10px] text-slate-200">
                                  <span>{a.icon}</span>
                                  <span className="truncate">{a.label}</span>
                                </div>
                                <p className="text-[8px] text-slate-500 line-clamp-1 mt-0.5">{a.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* OUT ANIMATION SELECTION (6 OPTIONS) */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Animasi Keluar (Out - 6 Opsi)</span>
                            <span className="text-[9px] text-slate-500">Klik untuk Preview</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {TITLE_OUT_ANIMATIONS.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => {
                                  setTitleConfig((prev) => ({ ...prev, animationOut: a.id as any }));
                                  const exitSec = Math.max(0, (titleConfig.startSec ?? 0) + (titleConfig.durationSec ?? 3.8) - 0.4);
                                  setSeekToSec(exitSec);
                                }}
                                className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                                  titleConfig.animationOut === a.id || (!titleConfig.animationOut && a.id === "blur-dissolve")
                                    ? "bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/30"
                                    : "bg-[#09090b] border-[#27272a] text-slate-400 hover:border-slate-600"
                                }`}
                              >
                                <div className="flex items-center gap-1 font-bold text-[10px] text-slate-200">
                                  <span>{a.icon}</span>
                                  <span className="truncate">{a.label}</span>
                                </div>
                                <p className="text-[8px] text-slate-500 line-clamp-1 mt-0.5">{a.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* PRECISE SLIDERS FOR TIMING & POSITION */}
                        <div className="p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] space-y-3">
                          {/* DURATION SLIDER */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-300">Durasi Tampil Judul</span>
                              <span className="text-amber-400 font-mono font-black">{titleConfig.durationSec ?? 3.8}s</span>
                            </div>
                            <input
                              type="range"
                              min="1.5"
                              max="8.0"
                              step="0.2"
                              value={titleConfig.durationSec ?? 3.8}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, durationSec: parseFloat(e.target.value) }))}
                              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                            />
                          </div>

                          {/* START TIME SLIDER */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-300">Waktu Mulai (Start Time)</span>
                              <span className="text-amber-400 font-mono font-black">{titleConfig.startSec ?? 0}s</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="6.0"
                              step="0.2"
                              value={titleConfig.startSec ?? 0}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, startSec: parseFloat(e.target.value) }))}
                              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                            />
                          </div>

                          {/* FONT SIZE SLIDER */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-300">Ukuran Font Judul</span>
                              <span className="text-amber-400 font-mono font-black">{titleConfig.fontSize ?? 84}px</span>
                            </div>
                            <input
                              type="range"
                              min="50"
                              max="130"
                              step="2"
                              value={titleConfig.fontSize ?? 84}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                            />
                          </div>

                          {/* VERTICAL POSITION Y SLIDER */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-300">Posisi Vertikal Y (Atas/Tengah/Bawah)</span>
                              <span className="text-amber-400 font-mono font-black">{titleConfig.positionY ?? 40}%</span>
                            </div>
                            <input
                              type="range"
                              min="15"
                              max="85"
                              step="1"
                              value={titleConfig.positionY ?? 40}
                              onChange={(e) => setTitleConfig((prev) => ({ ...prev, positionY: parseInt(e.target.value) }))}
                              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ════════════════ SECTION 2: AUTO SUBTITLE ════════════════ */}
                    {textTabSection === "subtitle" && (
                      <div className="space-y-3">
                        <textarea
                          rows={3}
                          placeholder="Ketikkan naskah atau overlay video di sini..."
                          value={customTextOverlay}
                          onChange={(e) => setCustomTextOverlay(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] text-slate-100 resize-y select-text focus:border-purple-500 outline-none"
                        />
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gaya Text Subtitle (5 Opsi)</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: "plain-shadow", label: "Clean Shadow" },
                              { id: "yellow-highlight", label: "Yellow Highlight" },
                              { id: "bold-outline", label: "Bold Outline" },
                              { id: "neon-glow", label: "Cyber Neon" },
                              { id: "minimalist", label: "Minimalist Box" },
                            ].map((s) => (
                              <button
                                key={s.id}
                                onClick={() => setSubtitleStyle(s.id)}
                                className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${subtitleStyle === s.id
                                    ? "border-purple-500 bg-purple-950/60 text-purple-200 ring-1 ring-purple-500/40"
                                    : "border-[#27272a] bg-[#09090b] text-slate-400 hover:border-slate-600"
                                  }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* SUBTITLE FONT SIZE CONTROLS */}
                        <div className="p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-slate-300">Ukuran Teks Subtitle</span>
                            <span className="text-purple-400 font-mono font-black">{subtitleFontSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="28"
                            max="96"
                            step="4"
                            value={subtitleFontSize}
                            onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                            className="w-full accent-purple-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                          />
                          <div className="grid grid-cols-4 gap-1 pt-1">
                            {[
                              { label: "Sedang", size: 44 },
                              { label: "Normal", size: 56 },
                              { label: "Besar", size: 72 },
                              { label: "Jumbo", size: 88 },
                            ].map((sz) => (
                              <button
                                key={sz.size}
                                onClick={() => setSubtitleFontSize(sz.size)}
                                className={`py-1 rounded text-[9px] font-extrabold transition-all cursor-pointer ${subtitleFontSize === sz.size
                                    ? "bg-purple-600 text-white shadow"
                                    : "bg-[#18181c] text-slate-400 hover:text-slate-200 border border-[#27272a]"
                                  }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* SUBTITLE POSITION Y CONTROLS */}
                        <div className="p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-slate-300">Posisi Vertikal Subtitle (Atas/Bawah)</span>
                            <span className="text-indigo-400 font-mono font-black">{subtitleBottomPos}px</span>
                          </div>
                          <input
                            type="range"
                            min="100"
                            max="500"
                            step="10"
                            value={subtitleBottomPos}
                            onChange={(e) => setSubtitleBottomPos(parseInt(e.target.value))}
                            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                          />
                          <div className="grid grid-cols-4 gap-1 pt-1">
                            {[
                              { label: "Bawah", pos: 140 },
                              { label: "Ideal", pos: 220 },
                              { label: "Tengah", pos: 340 },
                              { label: "Atas", pos: 460 },
                            ].map((p) => (
                              <button
                                key={p.pos}
                                onClick={() => setSubtitleBottomPos(p.pos)}
                                className={`py-1 rounded text-[9px] font-extrabold transition-all cursor-pointer ${subtitleBottomPos === p.pos
                                    ? "bg-indigo-600 text-white shadow"
                                    : "bg-[#18181c] text-slate-400 hover:text-slate-200 border border-[#27272a]"
                                  }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: GENERATE SCRIPT, VOICE OVER & AUTO CAPTION */}
                {(activeNavTab === "generate" || activeNavTab === "caption") && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Naskah & Voice Over AI</span>
                      <button onClick={handlePolishScript} disabled={isPolishing} className="px-2 py-1 text-[9px] bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold">
                        {isPolishing ? "Polishing..." : "Polish AI"}
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="Masukkan naskah video Anda di sini..."
                      value={rawScript}
                      onChange={(e) => setRawScript(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] text-slate-100 resize-y select-text focus:border-indigo-500 outline-none min-h-[80px]"
                    />

                    {/* 6 VOICE SELECTION CARDS */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Karakter Suara AI (6 Pilihan)</span>
                      <div className="space-y-1">
                        {VOICE_OPTIONS.map((v) => {
                          const isSelected = selectedVoice === v.id;
                          return (
                            <div
                              key={v.id}
                              onClick={() => setSelectedVoice(v.id)}
                              className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${isSelected
                                  ? "border-amber-500 bg-amber-950/40 ring-1 ring-amber-500/30"
                                  : "border-[#27272a] bg-[#09090b] hover:border-slate-600"
                                }`}
                            >
                              <div className="min-w-0 flex-1 mr-2">
                                <p className="font-bold text-slate-200 text-[10px]">{v.name}</p>
                                <p className="text-[8px] text-slate-400">{v.desc}</p>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio}
                        className="py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-[10px] font-extrabold shadow-lg cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        {isGeneratingAudio ? "Membuat..." : "Generate Voice"}
                      </button>

                      <button
                        onClick={() => {
                          if (!rawScript && !polishedScript) return alert("Tuliskan naskah terlebih dahulu!");
                          setAutoCaptionGenerated(true);
                        }}
                        className="py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-extrabold shadow-lg cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Subtitles className="w-3.5 h-3.5" />
                        Auto Caption
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB: AUDIO & BGM MUSIC LIBRARY */}
                {activeNavTab === "audio" && (
                  <div className="space-y-3">
                    {/* ── Voice Over Switcher (Fitur 1) ── */}
                    <div className="p-2.5 rounded-xl bg-[#09090b] border border-violet-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-violet-300">🎙️ Suara Voice Over</span>
                        <button
                          onClick={handleGenerateAudio}
                          disabled={isGeneratingAudio || (!polishedScript && !rawScript)}
                          className="px-2 py-1 text-[9px] bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded font-bold flex items-center gap-1 shadow cursor-pointer disabled:opacity-40"
                        >
                          <RefreshCw className={`w-3 h-3 ${isGeneratingAudio ? "animate-spin" : ""}`} />
                          {isGeneratingAudio ? "Generating..." : "Regen VO"}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {VOICE_OPTIONS.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVoice(v.id)}
                            className={`w-full px-2.5 py-2 rounded-lg text-left transition-all border cursor-pointer ${
                              selectedVoice === v.id
                                ? "border-violet-500 bg-violet-950/40 ring-1 ring-violet-500/30"
                                : "border-[#27272a] bg-[#18181b] hover:border-slate-600"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200 text-[11px]">{v.name}</span>
                              {selectedVoice === v.id && <Check className="w-3 h-3 text-violet-400" />}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-0.5">{v.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Auto Match Footage to VO (Fitur 4) ── */}
                    <div className="p-2.5 rounded-xl bg-[#09090b] border border-amber-900/40 space-y-2">
                      <span className="text-xs font-bold text-amber-300">🎯 Sinkronisasi Footage ke Narasi</span>
                      <p className="text-[9px] text-slate-400">AI mengurutkan klip footage agar sinkron dengan narasi VO.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAutoMatchFootage}
                          disabled={isMatchingFootage || !audioUrl || footages.length < 2}
                          className="flex-1 py-2 text-[10px] bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isMatchingFootage ? "animate-spin" : ""}`} />
                          {isMatchingFootage ? "Matching..." : "✨ Auto Match"}
                        </button>
                        {preMatchFootageOrder && (
                          <button
                            onClick={handleUndoMatch}
                            className="px-3 py-2 text-[10px] bg-[#27272a] hover:bg-[#3f3f46] text-slate-300 rounded-lg font-bold cursor-pointer transition-all border border-[#3f3f46]"
                          >
                            ↩ Undo Match
                          </button>
                        )}
                      </div>
                      {matchExplanation && (
                        <p className="text-[9px] text-amber-300/80 italic">{matchExplanation}</p>
                      )}
                    </div>

                    {/* ── BGM Section ── */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Musik BGM Studio (10 Tracks)</span>
                      <button
                        onClick={handleAutoBgm}
                        disabled={isSelectingBgm}
                        className="px-2 py-1 text-[9px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded font-bold flex items-center gap-1 shadow cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        {isSelectingBgm ? "Pilih AI..." : "Auto BGM AI"}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-300">Volume Musik BGM</span>
                        <span className="text-indigo-400 font-mono">{Math.round(bgmVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={bgmVolume}
                        onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#27272a] rounded-lg"
                      />
                    </div>

                    <div className="space-y-1.5">
                      {PRESET_VIRAL_BGM_TRACKS.map((t) => {
                        const isSelected = bgmUrl === t.url;
                        return (
                          <div
                            key={t.id}
                            className={`p-2.5 rounded-xl bg-[#09090b] border flex items-center justify-between text-xs transition-all ${isSelected ? "border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500/30" : "border-[#27272a] hover:border-slate-600"
                              }`}
                          >
                            <div className="min-w-0 flex-1 mr-2">
                              <p className="font-bold text-slate-200 text-[11px] truncate">{t.title}</p>
                              <p className="text-[9px] text-emerald-400/80 font-medium">{t.category}</p>
                            </div>
                            <button
                              onClick={() => setBgmUrl(t.url)}
                              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold flex-shrink-0 transition-all cursor-pointer ${isSelected
                                  ? "bg-emerald-500 text-black font-extrabold"
                                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
                                }`}
                            >
                              {isSelected ? "✓ Pasang" : "+ Pasang"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
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

                {/* TAB: OVERLAY LAYER */}
                {activeNavTab === "overlay" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Layer Overlay</span>
                      <span className="text-[10px] text-slate-400">Foto / Video</span>
                    </div>

                    {/* Upload Button */}
                    <label className="w-full py-3 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 hover:from-violet-600/30 hover:to-indigo-600/30 border border-violet-500/30 hover:border-violet-400/50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all">
                      <Plus className="w-4 h-4 text-violet-400" />
                      <span className="text-violet-200">Upload Overlay</span>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleOverlayUpload}
                      />
                    </label>

                    {overlayItems.length === 0 && (
                      <div className="py-8 flex flex-col items-center gap-2 text-slate-500">
                        <Layers className="w-8 h-8 opacity-30" />
                        <p className="text-[10px] text-center">Upload foto/video untuk ditempel<br/>di atas video utama (logo, PiP, dll)</p>
                      </div>
                    )}

                    {/* Overlay List */}
                    {overlayItems.map((overlay) => {
                      const isSelected = selectedOverlayId === overlay.id;
                      const POSITION_GRID = [
                        ["topleft", "⬛", "topright"],
                        ["", "center", ""],
                        ["bottomleft", "⬛", "bottomright"],
                      ] as const;

                      return (
                        <div
                          key={overlay.id}
                          className={`rounded-xl border transition-all overflow-hidden ${isSelected ? "border-violet-500/60 bg-[#1c1a2e]" : "border-[#27272a] bg-[#09090b]"}`}
                        >
                          {/* Header */}
                          <div
                            className="flex items-center gap-2 p-2 cursor-pointer"
                            onClick={() => setSelectedOverlayId(isSelected ? null : overlay.id)}
                          >
                            {overlay.isVideo ? (
                              <div className="w-10 h-7 bg-black rounded flex items-center justify-center flex-shrink-0 border border-[#27272a]">
                                <VideoIcon className="w-3 h-3 text-violet-400" />
                              </div>
                            ) : (
                              <img src={overlay.previewUrl} alt={overlay.name} className="w-10 h-7 object-cover rounded flex-shrink-0 border border-[#27272a]" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-slate-200 truncate">{overlay.name}</p>
                              <p className="text-[9px] text-slate-500">{overlay.position} · {overlay.sizePercent}% · {Math.round(overlay.opacity * 100)}%</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveOverlay(overlay.id); }}
                              className="p-1 hover:bg-red-500/20 rounded text-red-400 flex-shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Expanded Controls */}
                          {isSelected && (
                            <div className="px-2.5 pb-2.5 space-y-2.5 border-t border-[#27272a] pt-2">

                              {/* Position Grid 3x3 */}
                              <div>
                                <p className="text-[9px] text-slate-400 mb-1.5">Posisi</p>
                                <div className="grid grid-cols-3 gap-1 w-[90px]">
                                  {[
                                    { id: "topleft", label: "↖" }, { id: "top", label: "" }, { id: "topright", label: "↗" },
                                    { id: "left", label: "" },      { id: "center", label: "●" }, { id: "right", label: "" },
                                    { id: "bottomleft", label: "↙" }, { id: "bottom", label: "" }, { id: "bottomright", label: "↘" },
                                  ].map((pos) => {
                                    if (!pos.label) return <div key={pos.id} className="w-6 h-6" />;
                                    const isPos = overlay.position === pos.id;
                                    return (
                                      <button
                                        key={pos.id}
                                        onClick={() => handleUpdateOverlay(overlay.id, { position: pos.id as any })}
                                        className={`w-6 h-6 rounded text-[11px] flex items-center justify-center transition-all ${isPos ? "bg-violet-600 text-white" : "bg-[#27272a] text-slate-300 hover:bg-[#3f3f46]"}`}
                                      >
                                        {pos.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Size */}
                              <div>
                                <div className="flex justify-between mb-1">
                                  <p className="text-[9px] text-slate-400">Ukuran</p>
                                  <p className="text-[9px] text-violet-300 font-bold">{overlay.sizePercent}%</p>
                                </div>
                                <input
                                  type="range" min={5} max={80} step={1}
                                  value={overlay.sizePercent}
                                  onChange={(e) => handleUpdateOverlay(overlay.id, { sizePercent: parseInt(e.target.value) })}
                                  className="w-full h-1 accent-violet-500"
                                />
                              </div>

                              {/* Opacity */}
                              <div>
                                <div className="flex justify-between mb-1">
                                  <p className="text-[9px] text-slate-400">Opacity</p>
                                  <p className="text-[9px] text-violet-300 font-bold">{Math.round(overlay.opacity * 100)}%</p>
                                </div>
                                <input
                                  type="range" min={10} max={100} step={1}
                                  value={Math.round(overlay.opacity * 100)}
                                  onChange={(e) => handleUpdateOverlay(overlay.id, { opacity: parseInt(e.target.value) / 100 })}
                                  className="w-full h-1 accent-violet-500"
                                />
                              </div>

                              {/* Time Range */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[9px] text-slate-400 mb-1">Mulai (detik)</p>
                                  <input
                                    type="number" min={0} step={0.1}
                                    value={overlay.startSec}
                                    onChange={(e) => handleUpdateOverlay(overlay.id, { startSec: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded text-[10px] text-white px-2 py-1 outline-none focus:border-violet-500"
                                  />
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-400 mb-1">Akhir (-1=selamanya)</p>
                                  <input
                                    type="number" min={-1} step={0.1}
                                    value={overlay.endSec}
                                    onChange={(e) => handleUpdateOverlay(overlay.id, { endSec: parseFloat(e.target.value) || -1 })}
                                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded text-[10px] text-white px-2 py-1 outline-none focus:border-violet-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {overlayItems.length > 0 && (
                      <p className="text-[9px] text-slate-500 text-center">
                        💡 Overlay akan muncul di atas semua klip saat render
                      </p>
                    )}
                  </div>
                )}



                {/* TAB: PHOTOS / GAMBAR */}
                {activeNavTab === "photo" && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-300 flex justify-between items-center">
                      <span>Daftar Foto ({footages.length})</span>
                      <span className="text-[10px] text-slate-400">PNG / JPG / HEIC</span>
                    </div>

                    <label className="w-full py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border border-[#3f3f46] shadow">
                      <Upload className="w-4 h-4 text-indigo-400" />
                      <span>Upload Foto (PNG, JPG, HEIC)</span>
                      <input type="file" multiple accept="image/*,.heic,.heif,.png,.jpg,.jpeg,.webp,.gif" onChange={handlePhotoUpload} className="hidden" />
                    </label>

                    {footages.length === 0 ? (
                      <div className="border-2 border-dashed border-[#27272a] rounded-xl p-6 text-center space-y-2">
                        <ImageIcon className="w-7 h-7 text-slate-500 mx-auto" />
                        <p className="text-xs text-slate-400 font-bold">Belum ada foto</p>
                        <p className="text-[10px] text-slate-500">Klik Upload Foto di atas</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {footages.map((clip, idx) => (
                          <div
                            key={clip.id}
                            onClick={() => setSelectedClipIndex(idx)}
                            className={`rounded-xl overflow-hidden border bg-[#09090b] relative group cursor-pointer transition-all ${selectedClipIndex === idx ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-[#27272a] hover:border-slate-500"
                              }`}
                          >
                            <div className="w-full aspect-video bg-black relative overflow-hidden">
                              <img
                                src={clip.previewUrl}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
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

                {/* TAB: FILTERS (10 COMMERCIAL LOOKS) */}
                {activeNavTab === "filter" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-300">Pilihan Color Grade (10 Filter)</span>
                    <div className="space-y-1.5">
                      {AVAILABLE_FILTERS.map((f) => {
                        const isSelected = editingStyle === f.id;
                        return (
                          <div
                            key={f.id}
                            onClick={() => { pushHistoryState(); setEditingStyle(f.id); }}
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${isSelected
                                ? "border-indigo-500 bg-indigo-950/60 ring-1 ring-indigo-500/30"
                                : "border-[#27272a] bg-[#09090b] hover:border-slate-600"
                              }`}
                          >
                            <div className="min-w-0 flex-1 mr-2">
                              <p className="font-bold text-slate-200 text-[11px]">{f.title}</p>
                              <p className="text-[9px] text-slate-400">{f.desc}</p>
                            </div>
                            <div className="text-[9px] text-amber-400 font-bold flex-shrink-0">{f.rating}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. RIGHT SECTION: PROGRAM MONITOR CANVAS + AI OBROLAN ASSISTANT PANEL */}
            <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
              {/* PROGRAM PREVIEW MONITOR */}
              <div className="flex-1 bg-[#121215] flex flex-col justify-between p-3 sm:p-4 overflow-hidden relative min-w-[280px]">
                {/* ASPECT RATIO SELECTOR TOP BAR */}
                <div className="flex items-center justify-end gap-2 z-20">
                  <div className="flex items-center gap-1 bg-[#18181c] border border-[#27272a] rounded-lg px-2 py-1 text-xs font-bold">
                    <span className="text-slate-400 text-[10px] hidden sm:inline">Ratio:</span>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as any)}
                      className="bg-transparent text-white font-bold text-[11px] outline-none cursor-pointer"
                    >
                      <option value="9:16">9:16 Vertical</option>
                      <option value="16:9">16:9 Landscape</option>
                      <option value="1:1">1:1 Square</option>
                    </select>
                  </div>

                  {/* EXPORT RESOLUTION PRESET SELECTOR */}
                  <div className="flex items-center gap-1 bg-[#18181c] border border-[#27272a] rounded-lg px-2 py-1 text-xs font-bold">
                    <span className="text-slate-400 text-[10px] hidden sm:inline">Kualitas:</span>
                    <select
                      value={exportPreset}
                      onChange={(e) => setExportPreset(e.target.value)}
                      className="bg-transparent text-amber-300 font-bold text-[11px] outline-none cursor-pointer"
                    >
                      <option value="1080p">🌟 1080p FHD (60 FPS)</option>
                      <option value="720p">⚡ 720p HD (30 FPS) ✓</option>
                      <option value="480p">🚀 480p SD (30 FPS)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleExportVideo}
                    disabled={isExporting}
                    className="px-3.5 py-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:from-indigo-500 hover:to-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExporting ? (renderJobStatus === "pending" ? "Mengantri..." : `Rendering ${exportProgress}%...`) : "Export MP4"}</span>
                  </button>
                </div>

                {/* MAIN CENTER DISPLAY CANVAS */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden my-2">
                  <div
                    className={`max-h-full relative flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden border border-[#27272a] bg-black ${aspectRatio === "9:16" ? "w-[260px] sm:w-[310px] h-[460px] sm:h-[540px] aspect-[9/16]" : aspectRatio === "16:9" ? "w-[480px] sm:w-[560px] h-[270px] sm:h-[315px] aspect-[16/9]" : "w-[320px] sm:w-[380px] h-[320px] sm:h-[380px] aspect-square"
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
                <div className="h-9 sm:h-10 bg-[#18181c] border border-[#27272a] rounded-xl px-3 flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Volume2 className="w-4 h-4 text-slate-400 cursor-pointer hover:text-white" />
                    <span className="font-mono text-slate-200 text-[11px]">
                      {formatTimecode(currentTimeSec)} / {formatTimecode(totalVideoDurationSec)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-mono hidden md:inline">CMD+X | DEL</span>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">LIVE SYNC</span>
                  </div>
                </div>
              </div>

              {/* AI OBROLAN ASSISTANT CHAT PANEL (RESPONSIVE COLLAPSIBLE / FLEX ON DESKTOP & TABLET) */}
              <div className="w-full lg:w-80 xl:w-96 h-48 lg:h-auto bg-[#18181c] border-t lg:border-t-0 lg:border-l border-[#27272a] flex flex-col justify-between overflow-hidden z-30 shadow-2xl flex-shrink-0">
                {/* HEADER */}
                <div className="p-2.5 sm:p-3 border-b border-[#27272a] flex items-center justify-between bg-[#121215]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                        AI Assistant
                        <span className="text-[8px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                          Active
                        </span>
                      </h3>
                      <p className="text-[8px] sm:text-[9px] text-slate-400">Creative Director Copilot</p>
                    </div>
                  </div>
                </div>

                {/* QUICK PROMPT CHIPS */}
                <div className="p-1.5 border-b border-[#27272a] bg-[#09090b] flex flex-wrap gap-1">
                  {[
                    "✨ Sarankan gaya warna & transisi",
                    "🎙️ Pilihkan suara AI terbaik",
                    "⚡ Pasang transisi light leak",
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChatMessage(chip)}
                      disabled={isChatSending}
                      className="text-[9px] px-2 py-0.5 bg-[#18181c] hover:bg-[#27272a] text-indigo-300 hover:text-white rounded border border-[#27272a] font-medium transition-all cursor-pointer truncate max-w-full"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* CHAT MESSAGES CONTAINER */}
                <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 text-xs bg-[#121215]">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`p-2.5 rounded-xl max-w-[90%] text-xs leading-relaxed ${msg.sender === "user"
                            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow"
                            : "bg-[#18181c] border border-[#27272a] text-slate-200 rounded-bl-none shadow-md"
                          }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {msg.actionApplied && (
                          <div className="mt-1.5 text-[9px] font-extrabold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                            <span>⚡ Action:</span> {msg.actionApplied}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatSending && (
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold animate-pulse p-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      <span>AI Copilot menganalisis...</span>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* INPUT FOOTER */}
                <div className="p-2 sm:p-2.5 border-t border-[#27272a] bg-[#18181c]">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChatMessage();
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      placeholder="Tanyakan ide editing..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 text-xs p-2 rounded-xl bg-[#09090b] border border-[#27272a] text-slate-100 focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isChatSending}
                      className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-xl shadow cursor-pointer transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
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
                left: `calc(100px + (100% - 100px) * ${currentTimeSec / Math.max(0.1, totalVideoDurationSec)})`,
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
                const clickX = e.clientX - rect.left - 100;
                const trackWidth = rect.width - 100;
                if (trackWidth > 0) {
                  const clickedTime = Math.max(0, Math.min(totalVideoDurationSec, (clickX / trackWidth) * totalVideoDurationSec));
                  setSeekToSec(parseFloat(clickedTime.toFixed(2)));
                  setCurrentTimeSec(parseFloat(clickedTime.toFixed(2)));
                }
              }}
              className="h-10 bg-[#121215] border-b border-[#27272a] px-3 flex items-center relative select-none cursor-pointer overflow-hidden z-20"
            >
              {/* TOOLBAR CONTROLS (SPLIT, COPY, PASTE, DELETE, UNDO, REDO, ZOOM) */}
              <div className="w-[300px] text-[10px] font-extrabold text-slate-400 flex items-center gap-1.5 z-30">
                <button
                  onClick={(e) => { e.stopPropagation(); handleUndo(); }}
                  disabled={historyStack.length === 0}
                  className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-30 text-slate-300 border border-[#3f3f46] cursor-pointer"
                  title="Undo (Cmd+Z)"
                >
                  ↩️ Undo
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRedo(); }}
                  disabled={redoStack.length === 0}
                  className="p-1 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-30 text-slate-300 border border-[#3f3f46] cursor-pointer"
                  title="Redo (Cmd+Shift+Z)"
                >
                  ↪️ Redo
                </button>

                <div className="h-4 w-[1px] bg-[#27272a] mx-0.5" />

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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedClipIndex !== null && footages[selectedClipIndex]) {
                      removeFootage(footages[selectedClipIndex].id);
                      setSelectedClipIndex(null);
                    } else {
                      alert("Klik klip video yang ingin dihapus terlebih dahulu!");
                    }
                  }}
                  className="p-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40 cursor-pointer"
                  title="Hapus Klip (Delete / Backspace)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-[1px] bg-[#27272a] mx-0.5" />

                {/* TIMELINE ZOOM IN / OUT CONTROLS */}
                <div className="flex items-center gap-1 bg-[#09090b] border border-[#27272a] rounded px-1.5 py-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setTimelineZoom((z) => Math.max(1, z - 0.5)); }}
                    className="text-slate-400 hover:text-white font-bold text-[11px]"
                    title="Zoom Out Timeline"
                  >
                    🔍-
                  </button>
                  <span className="text-[9px] font-mono text-indigo-300 font-bold px-0.5">{Math.round(timelineZoom * 100)}%</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setTimelineZoom((z) => Math.min(5, z + 0.5)); }}
                    className="text-slate-400 hover:text-white font-bold text-[11px]"
                    title="Zoom In Timeline"
                  >
                    🔍+
                  </button>
                </div>
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

            {/* SPACIOUS TIMELINE LAYERS CONTAINER (DYNAMIC ZOOM MIN-WIDTH) */}
            <div className="flex-1 p-3 overflow-x-auto space-y-3 text-xs select-none z-10" style={{ width: `${100 * timelineZoom}%` }}>
              {/* LAYER 1: V1 VIDEO TRACK FILMSTRIP (PROPORTIONAL CLIP WIDTHS + ABSOLUTE TRANSITION BADGES) */}
              <div className="flex items-center gap-3 relative">
                <span className="w-20 text-[10px] font-extrabold text-slate-400">Layer 1 (V1)</span>
                <div className="flex-1 flex items-center h-16 bg-[#09090b] rounded-xl border border-[#27272a] p-1.5 overflow-hidden relative">
                  {footages.length === 0 ? (
                    <div className="w-full text-[10px] text-slate-600 italic text-center">Belum ada klip video di Layer 1</div>
                  ) : (
                    <>
                      {footages.map((clip, idx) => {
                        const clipDur = customClipDurations[idx] || clipDuration;
                        const clipPercent = (clipDur / Math.max(0.1, totalVideoDurationSec)) * 100;
                        const isSelected = selectedTimelineItem?.type === "video" && selectedClipIndex === idx;

                        return (
                          <div
                            key={clip.id}
                            draggable={!isEndingClip(clip)}
                            onDragStart={(e) => handleClipDragStart(e, idx)}
                            onDragOver={(e) => handleClipDragOver(e, idx)}
                            onDragEnd={handleClipDragEnd}
                            onDrop={(e) => handleClipDrop(e, idx)}
                            onClick={() => {
                              setSelectedClipIndex(idx);
                              setSelectedTimelineItem({ type: "video", index: idx });
                            }}
                            style={{ width: `${clipPercent}%` }}
                            className={`h-full px-0.5 rounded-xl flex items-center justify-between gap-1 text-indigo-200 border transition-all flex-shrink-0 min-w-[70px] relative group/clip
                              ${isEndingClip(clip) ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}
                              ${draggedClipIdx === idx ? "opacity-40 scale-[0.98]" : ""}
                              ${dragOverClipIdx === idx && draggedClipIdx !== idx ? "border-l-4 border-l-blue-400" : ""}
                              ${isSelected
                                ? "border-indigo-400 bg-indigo-900/90 shadow-lg shadow-indigo-600/30 scale-[1.01] ring-2 ring-indigo-500/60 z-20"
                                : "border-indigo-500/30 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:border-indigo-400"
                              }`}
                          >
                            {/* LEFT DRAG HANDLE GRIP */}
                            <div
                              onMouseDown={(e) => handleClipResizeMouseDown(e, idx, "left")}
                              className="w-2.5 h-full bg-indigo-400/70 hover:bg-white rounded-l-xl cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity z-30 flex items-center justify-center text-[9px] text-black font-extrabold shadow"
                              title="Tarik untuk memperpendek/memperlebar durasi dari kiri"
                            >
                              ‹
                            </div>

                            <div className="w-8 h-10 rounded bg-black overflow-hidden flex-shrink-0 border border-slate-800 pointer-events-none">
                              {clip.isImage || clip.file?.type?.startsWith("image/") || clip.previewUrl.match(/\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)($|\?)/i) || clip.name.match(/\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i) || clip.name.includes("Cover Akhiran") ? (
                                <img
                                  src={clip.previewUrl}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <video src={clip.previewUrl} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 pointer-events-none">
                              <p className="text-[9px] font-bold text-slate-100 truncate">{clip.name}</p>
                              <p className="text-[8px] text-indigo-300 opacity-80 font-mono">{clipDur}s</p>
                            </div>

                            {/* RIGHT DRAG HANDLE GRIP */}
                            <div
                              onMouseDown={(e) => handleClipResizeMouseDown(e, idx, "right")}
                              className="w-2.5 h-full bg-indigo-400/70 hover:bg-white rounded-r-xl cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity z-30 flex items-center justify-center text-[9px] text-black font-extrabold shadow"
                              title="Tarik untuk memperpanjang/memperpendek durasi dari kanan"
                            >
                              ›
                            </div>
                          </div>
                        );
                      })}

                      {/* ABSOLUTE TRANSITION BADGES OVERLAID EXACTLY ON CLIP SEAMS (CLICK THEN PRESS DELETE TO REMOVE) */}
                      {(() => {
                        let accPercent = 0;
                        return footages.map((_, idx) => {
                          if (idx >= footages.length - 1) return null;
                          const clipDur = customClipDurations[idx] || clipDuration;
                          accPercent += (clipDur / Math.max(0.1, totalVideoDurationSec)) * 100;

                          if (!transitionsMap[idx]) return null;

                          const isTransSelected = selectedTimelineItem?.type === "transition" && selectedTimelineItem.index === idx;

                          return (
                            <div
                              key={`trans_${idx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTimelineItem({ type: "transition", index: idx });
                              }}
                              style={{ left: `${accPercent}%` }}
                              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] font-extrabold cursor-pointer z-30 shadow-lg border flex items-center gap-1 transition-all ${isTransSelected
                                  ? "bg-rose-600 text-white border-white ring-2 ring-rose-400 shadow-rose-600/50 scale-110"
                                  : "bg-amber-500/90 hover:bg-amber-400 text-black border-white/60"
                                }`}
                              title="Klik lalu tekan Delete/Backspace untuk menghapus transisi ini"
                            >
                              ⚡ {transitionsMap[idx]}
                            </div>
                          );
                        });
                      })()}
                    </>
                  )}
                </div>
              </div>

              {/* LAYER 2: A1 VOICE OVER TRACK (PROPORTIONAL DURATION WIDTH) */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-[10px] font-extrabold text-amber-400">Layer 2 (A1)</span>
                <div className="flex-1 relative h-10">
                  {audioUrl ? (
                    <div
                      onClick={() => setSelectedTimelineItem({ type: "voiceover" })}
                      style={{ width: `${Math.min(100, (audioDurationSec / Math.max(0.1, totalVideoDurationSec)) * 100)}%` }}
                      className={`h-10 border rounded-xl flex items-center justify-between px-3 text-amber-200 text-[10px] font-extrabold cursor-pointer transition-all ${selectedTimelineItem?.type === "voiceover"
                          ? "border-amber-400 bg-amber-900 ring-2 ring-amber-500/80 shadow-lg"
                          : "bg-gradient-to-r from-amber-950/90 via-amber-900/90 to-amber-950/90 border-amber-500/50 hover:border-amber-400"
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Mic className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="truncate">Voice Over AI ({selectedVoice} - {audioDurationSec}s)</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAudioUrl(null); setAudioFile(null); setSelectedTimelineItem(null); }}
                        className="p-1 text-rose-400 hover:text-rose-200 text-[10px] font-bold flex-shrink-0"
                        title="Hapus Voice Over"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-10 bg-[#09090b]/50 rounded-xl border border-dashed border-[#27272a] flex items-center px-4 text-slate-600 italic text-[10px]">
                      (A1 Voice Over Kosong - Klik Generate Voice Over di Tab Left untuk menambahkan)
                    </div>
                  )}
                </div>
              </div>

              {/* LAYER 3: A2 BGM AUDIO TRACK (FULL DURATION TRACK) */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-[10px] font-extrabold text-emerald-400">Layer 3 (A2)</span>
                <div className="flex-1">
                  {bgmUrl ? (
                    <div
                      onClick={() => setSelectedTimelineItem({ type: "bgm" })}
                      className={`h-10 border rounded-xl flex items-center justify-between px-4 text-emerald-200 text-[10px] font-extrabold cursor-pointer transition-all ${selectedTimelineItem?.type === "bgm"
                          ? "border-emerald-400 bg-emerald-900 ring-2 ring-emerald-500/80 shadow-lg"
                          : "bg-gradient-to-r from-emerald-950/90 via-teal-900/90 to-emerald-950/90 border-emerald-500/50 hover:border-emerald-400"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-emerald-400" />
                        <span>Background Music Track ({Math.round(bgmVolume * 100)}%)</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setBgmUrl(null); setBgmFile(null); setSelectedTimelineItem(null); }}
                        className="p-1 text-rose-400 hover:text-rose-200 text-[10px] font-bold"
                        title="Hapus BGM"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-10 bg-[#09090b]/50 rounded-xl border border-dashed border-[#27272a] flex items-center px-4 text-slate-600 italic text-[10px]">
                      (A2 BGM Music Kosong - Klik Pilih BGM AI di Tab Audio)
                    </div>
                  )}
                </div>
              </div>

              {/* LAYER 4: T0 JUDUL OPENING / VIDEO TITLE TRACK */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-[10px] font-extrabold text-amber-400">Layer 4 (T0)</span>
                <div className="flex-1 relative h-10">
                  {titleConfig.enabled && (titleConfig.line1 || titleConfig.line2) ? (
                    <div
                      onClick={() => {
                        setSelectedTimelineItem({ type: "title" });
                        setActiveNavTab("text");
                        setTextTabSection("title");
                        setSeekToSec(titleConfig.startSec ?? 0);
                      }}
                      className={`w-full h-10 relative overflow-hidden rounded-xl border transition-all cursor-pointer ${
                        selectedTimelineItem?.type === "title"
                          ? "border-amber-400 bg-amber-950/40 ring-2 ring-amber-500/80 shadow-lg"
                          : "border-transparent bg-[#09090b]/30 hover:border-amber-500/30"
                      }`}
                    >
                      {(() => {
                        const start = titleConfig.startSec ?? 0;
                        const dur = titleConfig.durationSec ?? 3.8;
                        const leftPct = (start / Math.max(0.1, totalVideoDurationSec)) * 100;
                        const widthPct = Math.min(100 - leftPct, Math.max(8, (dur / Math.max(0.1, totalVideoDurationSec)) * 100));

                        return (
                          <div
                            style={{ left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)` }}
                            className="absolute top-1 bottom-1 px-3 bg-gradient-to-r from-amber-950/90 via-amber-900/90 to-amber-950/90 border border-amber-500/60 text-amber-200 rounded-lg text-[9px] font-black flex items-center justify-between truncate shadow-lg"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0 animate-pulse" />
                              <span className="truncate">
                                {titleConfig.line1} {titleConfig.line2 ? `• ${titleConfig.line2}` : ""} ({dur.toFixed(1)}s)
                              </span>
                            </div>
                            <span className="text-[8px] text-amber-300 font-mono flex-shrink-0 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                              {titleConfig.animationIn || "spring-pop"}
                            </span>
                          </div>
                        );
                      })()}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTitleConfig((prev) => ({ ...prev, enabled: false }));
                          setSelectedTimelineItem(null);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-rose-400 hover:text-rose-200 text-[10px] font-bold z-20"
                        title="Nonaktifkan Judul"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setActiveNavTab("text");
                        setTextTabSection("title");
                      }}
                      className="w-full h-10 bg-[#09090b]/50 rounded-xl border border-dashed border-[#27272a] hover:border-amber-500/40 flex items-center px-4 text-slate-600 hover:text-amber-400/70 italic text-[10px] cursor-pointer transition-colors"
                    >
                      (T0 Judul Opening Nonaktif - Klik untuk aktifkan di Tab Text)
                    </div>
                  )}
                </div>
              </div>

              {/* LAYER 5: T1 CAPTIONS SUBTITLES TRACK (TIMED CHUNK PILLS) */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-[10px] font-extrabold text-purple-400">Layer 5 (T1)</span>
                <div className="flex-1 relative h-10">
                  {previewSubtitles.length > 0 ? (
                    <div
                      onClick={() => setSelectedTimelineItem({ type: "subtitle" })}
                      className={`w-full h-10 relative overflow-hidden rounded-xl border transition-all cursor-pointer ${selectedTimelineItem?.type === "subtitle"
                          ? "border-purple-400 bg-purple-900/30 ring-2 ring-purple-500/80"
                          : "border-transparent bg-[#09090b]/30"
                        }`}
                    >
                      {previewSubtitles.map((sub, i) => {
                        const leftPct = (sub.start / Math.max(0.1, totalVideoDurationSec)) * 100;
                        const widthPct = Math.max(5, ((sub.end - sub.start) / Math.max(0.1, totalVideoDurationSec)) * 100);

                        return (
                          <div
                            key={i}
                            style={{ left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)` }}
                            className="absolute top-1 bottom-1 px-2 bg-purple-950/90 border border-purple-500/50 text-purple-200 rounded-lg text-[9px] font-extrabold flex items-center gap-1 truncate shadow"
                          >
                            <span className="bg-purple-500/30 px-1 rounded text-purple-300">cc</span>
                            <span className="truncate">{sub.text}</span>
                          </div>
                        );
                      })}
                      <button
                        onClick={(e) => { e.stopPropagation(); setRawScript(""); setPolishedScript(""); setSelectedTimelineItem(null); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-rose-400 hover:text-rose-200 text-[10px] font-bold z-20"
                        title="Hapus Subtitle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-10 bg-[#09090b]/50 rounded-xl border border-dashed border-[#27272a] flex items-center px-4 text-slate-600 italic text-[10px]">
                      (T1 Subtitle Captions Kosong - Tulis Naskah di Tab Left)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER EXPORT PROGRESS MODAL — shows while job is running */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-96 p-6 rounded-2xl border border-[#27272a] bg-[#18181c] text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 mx-auto flex items-center justify-center animate-bounce">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Merender Video MP4</h3>
              <p className="text-xs text-slate-400 mt-1">
                {renderJobStatus === "pending"
                  ? "⏳ Job diterima, menunggu antrian render..."
                  : renderJobStatus === "rendering"
                  ? renderJobFrames.total > 0
                    ? `🎬 Rendering frame ${renderJobFrames.rendered} / ${renderJobFrames.total}`
                    : "🎬 Memulai Chromium render..."
                  : "Menyiapkan..."}
              </p>
              {renderJobId && (
                <p className="text-[10px] text-slate-600 mt-1 font-mono">Job: {renderJobId.slice(0, 8)}...</p>
              )}
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  renderJobStatus === "pending"
                    ? "bg-amber-500 w-[8%] animate-pulse"
                    : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                }`}
                style={renderJobStatus !== "pending" ? { width: `${exportProgress}%` } : undefined}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono font-bold text-indigo-400">{exportProgress}%</span>
              <span className="text-slate-500">Anda boleh tutup tab — render tetap berjalan di server</span>
            </div>
          </div>
        </div>
      )}

      {/* RENDER ERROR MODAL */}
      {renderJobError && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-96 p-6 rounded-2xl border border-red-900/50 bg-[#18181c] text-center space-y-4 shadow-2xl">
            <div className="text-3xl">❌</div>
            <h3 className="text-sm font-black text-red-400">Render Gagal</h3>
            <p className="text-xs text-slate-400 bg-slate-900 rounded-lg p-3 text-left break-words">{renderJobError}</p>
            <button
              onClick={() => setRenderJobError(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >Tutup</button>
          </div>
        </div>
      )}

      {/* EXPORTED VIDEO RESULT MODAL — shows when done */}
      {renderDownloadUrl && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-[380px] p-5 rounded-2xl border border-[#27272a] bg-[#18181c] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Video Siap Didownload!
              </h3>
              <button onClick={() => setRenderDownloadUrl(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-center space-y-2">
              <div className="text-4xl">🎬</div>
              <p className="text-xs text-slate-400">Video berhasil dirender di server.<br />Klik tombol di bawah untuk download.</p>
              {renderJobFrames.total > 0 && (
                <p className="text-[10px] text-slate-600 font-mono">{renderJobFrames.total} frames rendered</p>
              )}
            </div>
            <a
              href={renderDownloadUrl}
              download
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" /> Download Video MP4
            </a>
          </div>
        </div>
      )}
      {/* AI COPILOT CONFIRMATION MODAL (Fitur 3) */}
      {copilotConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="w-96 p-5 rounded-2xl border border-violet-900/50 bg-[#18181c] space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-lg">🤖</div>
              <h3 className="text-xs font-black text-violet-300">Konfirmasi Tindakan AI</h3>
            </div>
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3">
              <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{copilotConfirm.message}</p>
            </div>
            <p className="text-[10px] text-slate-400">Apakah Anda ingin melanjutkan tindakan ini?</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const act = copilotConfirm.action;
                  setCopilotConfirm(null);
                  const desc = await executeCopilotAction(act);
                  if (desc) {
                    setChatMessages(prev => [...prev, { sender: "ai", text: `✅ Tindakan berhasil: ${desc}`, actionApplied: desc }]);
                  }
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                ✅ Ya, Lanjutkan
              </button>
              <button
                onClick={() => setCopilotConfirm(null)}
                className="flex-1 py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-all border border-[#3f3f46]"
              >
                ✕ Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Klip AI tab wrapper */}
        </div>
      )}
    </div>
  );
}
