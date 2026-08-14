"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Sparkles, Wand2, Volume2, Video, Music, Image as ImageIcon, Play, Pause,
  Download, Loader2, CheckCircle2, Layers, Smartphone, Film, Scissors, Plus,
  Trash2, VolumeX, Type, Check, LayoutGrid, Sun, Moon, Link as LinkIcon, X,
  Zap, Sliders, FileVideo, Palette, Clock, ChevronRight, MessageSquare, Send,
  SkipBack, SkipForward, ZoomIn, ZoomOut, Mic, Cpu, AlignLeft, Square, Triangle,
  Minus, Settings, RefreshCw, Eye, EyeOff, ChevronDown, GripVertical, Maximize2,
  Move, CornerDownRight, Repeat, Radio, Layers3, PanelLeft, PanelRight,
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Footage {
  file: File;
  duration?: number;
  previewUrl?: string;
}
interface Transition {
  type: "light-leak" | "passerby" | "dissolve-fade" | "zoom-blur" | "glitch" | "cross-fade" | "flash-white" | "fade-black" | "iris-circle" | "wipe-horizontal" | "wipe-diagonal" | "film-burn" | "wipe-fade" | "lens-flare" | "vignette" | "color-split" | "slow-shutter";
  afterClipIndex: number;
  duration: number;
  label: string;
  color: string;
}
interface ChatMessage {
  role: "user" | "ai";
  text: string;
  actions?: any[];
  timestamp: Date;
}
interface SubtitleChunk {
  text: string;
  start: number;
  end: number;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const EDITING_PRESETS = [
  { id: "fast-viral", title: "⚡ Fast Viral Beat", desc: "TikTok pacing", badge: "TikTok", defaultDuration: 1.2, badgeColor: "bg-orange-500/20 text-orange-300" },
  { id: "cinematic-aesthetic", title: "☕ Cinematic", desc: "Slow aesthetic", badge: "Reels", defaultDuration: 3.2, badgeColor: "bg-blue-500/20 text-blue-300" },
  { id: "brand-commercial", title: "🔥 Commercial", desc: "Medium pacing", badge: "Brand", defaultDuration: 2.0, badgeColor: "bg-red-500/20 text-red-300" },
  { id: "soft-sweet", title: "🍰 Sweet Soft", desc: "Gentle cuts", badge: "Bakery", defaultDuration: 2.5, badgeColor: "bg-pink-500/20 text-pink-300" },
] as const;

const TRANSITION_LIBRARY = [
  { type: "light-leak" as const, label: "Light Leak", desc: "Cinematic light slice", color: "#f59e0b", icon: "✨" },
  { type: "passerby" as const, label: "Passerby", desc: "Slide pass effect", color: "#06b6d4", icon: "💨" },
  { type: "dissolve-fade" as const, label: "Dissolve Fade", desc: "Smooth dissolve", color: "#8b5cf6", icon: "🌫" },
  { type: "zoom-blur" as const, label: "Zoom Blur", desc: "Dynamic zoom motion", color: "#ec4899", icon: "🔍" },
  { type: "glitch" as const, label: "Glitch Pixel", desc: "Digital pixelize distortion", color: "#22c55e", icon: "⚡" },
  { type: "cross-fade" as const, label: "Cross Fade", desc: "Classic cross fade", color: "#6366f1", icon: "⟺" },
  { type: "flash-white" as const, label: "Flash White", desc: "Cinematic white flash", color: "#f8fafc", icon: "⚪" },
  { type: "fade-black" as const, label: "Fade Black", desc: "Dramatic black fade", color: "#334155", icon: "⚫" },
  { type: "iris-circle" as const, label: "Iris Circle", desc: "Circular iris reveal", color: "#a855f7", icon: "⭕" },
  { type: "wipe-horizontal" as const, label: "Wipe Horizontal", desc: "Horizontal slice wipe", color: "#f43f5e", icon: "↔️" },
  { type: "wipe-diagonal" as const, label: "Wipe Diagonal", desc: "Diagonal sweep", color: "#10b981", icon: "↗️" },
];

const SUBTITLE_STYLES = [
  { id: "plain-shadow", name: "Polos + Shadow", preview: "text-white drop-shadow-lg" },
  { id: "yellow", name: "Yellow Punch", preview: "bg-amber-400 text-black" },
  { id: "white", name: "Minimal White", preview: "bg-white text-black" },
  { id: "neon", name: "Neon Cyan", preview: "bg-cyan-400 text-black" },
  { id: "box", name: "Black Box", preview: "bg-black text-white" },
] as const;

function splitIntoChunks(text: string, wordsPerChunk = 3): string[] {
  const words = text
    .replace(/[.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}

function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AutoVideoStudio() {
  // ── Navigation
  const [viewMode, setViewMode] = useState<"wizard" | "timeline">("wizard");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // ── Script & Audio
  const [rawScript, setRawScript] = useState("Burjolevelup menjual bukan hanya sekadar makanan, tapi juga rasa kehangatan dalam setiap sajian cita rasa Indonesia.");
  const [polishedScript, setPolishedScript] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(15);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // ── Media
  const [footages, setFootages] = useState<Footage[]>([]);
  const [bgm, setBgm] = useState<File | null>(null);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState<number>(0.2);
  const [isSelectingBgm, setIsSelectingBgm] = useState(false);
  const [bgmReasoning, setBgmReasoning] = useState("");
  const [selectedBgmTitle, setSelectedBgmTitle] = useState("");
  const [isBgmPreviewPlaying, setIsBgmPreviewPlaying] = useState(false);
  const [endingLogo, setEndingLogo] = useState<{ file?: File; previewUrl: string } | null>({
    previewUrl: "/ending-logo.png",
  });

  // ── Clip Duration (Detik per klip)
  const [clipDuration, setClipDuration] = useState<number>(3);

  // ── Subtitle
  const [subtitleStyle, setSubtitleStyle] = useState<"plain-shadow" | "yellow" | "white" | "neon" | "box">("plain-shadow");
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(22);

  // ── Render
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // ── Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);

  // ── Transitions
  const [transitions, setTransitions] = useState<Transition[]>([]);

  // ── AI Chat Copilot
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "Halo! Saya adalah AI Copilot. Ketik perintah untuk memodifikasi video Anda, contoh: \"percepat klip\", \"tambah transisi dissolve\", \"subtitle lebih besar\", \"ganti BGM volume 30%\".",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // ── Studio Panel State
  const [mobileStudioTab, setMobileStudioTab] = useState<"monitor" | "assets" | "copilot">("monitor");
  const [activeLeftTab, setActiveLeftTab] = useState<"media" | "text" | "elements" | "transitions">("media");
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [selectedTrackItem, setSelectedTrackItem] = useState<{ track: string; index: number } | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [styleUrlInput, setStyleUrlInput] = useState("");

  // ── Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const footageVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  // ── Keyboard shortcuts: Spacebar (Play/Pause), Backspace/Delete (Remove Selected Item)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === "Backspace" || e.code === "Delete") {
        if (selectedTrackItem) {
          e.preventDefault();
          if (selectedTrackItem.track === "V1") {
            setFootages((prev) => prev.filter((_, i) => i !== selectedTrackItem.index));
          } else if (selectedTrackItem.track === "V2") {
            setTransitions((prev) => prev.filter((_, i) => i !== selectedTrackItem.index));
          }
          setSelectedTrackItem(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTrackItem]);

  // ── Drag-to-resize element state (supports Footage, Transitions, Ending Cover, Subtitles)
  const [dragResizeTarget, setDragResizeTarget] = useState<{
    type: "footage" | "transition" | "ending";
    index: number;
    handle: "left" | "right";
    startX: number;
    initialDuration: number;
  } | null>(null);

  const [endingDuration, setEndingDuration] = useState<number>(2.5);

  // ── Helper functions for per-footage individual durations
  const getFootageDuration = useCallback((idx: number) => {
    return footages[idx]?.duration || clipDuration || 3;
  }, [footages, clipDuration]);

  const getFootageStart = useCallback((idx: number) => {
    let start = 0;
    for (let i = 0; i < idx; i++) {
      start += footages[i]?.duration || clipDuration || 3;
    }
    return start;
  }, [footages, clipDuration]);

  const totalFootageDuration = useMemo(() => {
    return footages.reduce((acc, f) => acc + (f.duration || clipDuration || 3), 0);
  }, [footages, clipDuration]);

  const mainContentDuration = Math.max(totalFootageDuration, audioDuration || 0);
  const totalTimelineDuration = Math.max(mainContentDuration + (endingLogo ? endingDuration : 0), 1);

  // ── Computed subtitle chunks (3 words per chunk, character-length weighted audio sync)
  const subtitleChunks = useMemo<SubtitleChunk[]>(() => {
    const text = (polishedScript || rawScript).trim();
    if (!text) return [];
    const chunks = splitIntoChunks(text, 3);
    if (chunks.length === 0) return [];

    const voTime = Math.max(audioDuration || 15, 1);
    const totalChars = chunks.reduce((acc, c) => acc + c.length, 0);

    let currentStart = 0;
    return chunks.map((chunkText) => {
      const ratio = totalChars > 0 ? chunkText.length / totalChars : 1 / chunks.length;
      const chunkDur = Math.max(0.5, ratio * voTime);
      const start = currentStart;
      const end = Math.min(voTime, start + chunkDur);
      currentStart = end;
      return {
        text: chunkText,
        start,
        end,
      };
    });
  }, [polishedScript, rawScript, audioDuration]);

  // ── Current footage clip for preview (based on individual footage start & end times)
  const currentFootageIdx = useMemo(() => {
    if (footages.length === 0) return 0;
    let accumulated = 0;
    for (let i = 0; i < footages.length; i++) {
      const dur = footages[i]?.duration || clipDuration || 3;
      if (currentTime >= accumulated && currentTime < accumulated + dur) {
        return i;
      }
      accumulated += dur;
    }
    return Math.min(footages.length - 1, Math.max(0, footages.length - 1));
  }, [footages, currentTime, clipDuration]);

  // ── 60 FPS Active Transition Calculation (V2 Track Visual FX + V1 Clip Transforms)
  const transitionProgress = useMemo(() => {
    if (footages.length === 0 || transitions.length === 0) return null;
    let accumulated = 0;

    for (let i = 0; i < footages.length - 1; i++) {
      const dur = footages[i]?.duration || clipDuration || 3;
      accumulated += dur; // boundary timestamp

      const customT = transitions.find((t) => t.afterClipIndex === i);
      if (!customT) continue;

      const tDur = customT.duration || 0.8;
      const HALF = tDur / 2;
      const dist = currentTime - accumulated;
      if (Math.abs(dist) <= HALF) {
        const rawProgress = (dist + HALF) / tDur;
        const progress = Math.max(0, Math.min(1, rawProgress));
        const flareOpacity = Math.sin(progress * Math.PI);
        return {
          clipIndex: i,
          type: customT.type,
          progress,
          flareOpacity,
        };
      }
    }
    return null;
  }, [footages, transitions, currentTime, clipDuration]);



  // ── Current subtitle chunk
  const currentChunk = useMemo(() => {
    return subtitleChunks.find(
      (c) => currentTime >= c.start && currentTime < c.end
    ) || subtitleChunks[subtitleChunks.length - 1];
  }, [subtitleChunks, currentTime]);

  // ── BGM URL sync
  useEffect(() => {
    if (bgm) {
      const url = URL.createObjectURL(bgm);
      setBgmUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBgmUrl(null);
    }
  }, [bgm]);

  // ── 60 FPS Smooth Playback & Video Frame Sync Engine
  useEffect(() => {
    let animFrame: number;
    let lastTimestamp: number | null = null;

    if (isPlaying) {
      const step = (timestamp: number) => {
        if (lastTimestamp !== null) {
          const deltaSec = (timestamp - lastTimestamp) / 1000;
          setCurrentTime((prev) => {
            const next = prev + deltaSec;
            if (next >= totalTimelineDuration) {
              setIsPlaying(false);
              return 0;
            }

            // Sync footage videos accurately during playback (60 FPS Shared Math Engine)
            let accStart = 0;
            const activeTrans = transitionProgress;

            footageVideoRefs.current.forEach((v, idx) => {
              if (!v) return;
              const durSec = footages[idx]?.duration || clipDuration || 3;
              const startSec = accStart;
              accStart += durSec;

              v.muted = true;
              const isCurrent = currentFootageIdx === idx;
              const isTransActive = activeTrans && (activeTrans.clipIndex === idx || activeTrans.clipIndex + 1 === idx);

              if (isCurrent || isTransActive) {
                // Sync video time accurately matching timeline position
                const targetInClipTime = Math.max(0, Math.min(durSec, next - startSec));
                if (Math.abs(v.currentTime - targetInClipTime) > 0.15) {
                  v.currentTime = targetInClipTime;
                }
                if (isPlaying) v.play().catch(() => {});
                else v.pause();
              } else {
                v.pause();
                if (idx > currentFootageIdx) {
                  v.currentTime = 0;
                }
              }
            });

            // Auto-scroll timeline to track red needle smoothly
            if (timelineScrollContainerRef.current) {
              const container = timelineScrollContainerRef.current;
              const needleX = next * (60 * timelineZoom);
              const containerWidth = container.clientWidth;
              const scrollLeft = container.scrollLeft;
              if (needleX > scrollLeft + containerWidth * 0.75 || needleX < scrollLeft) {
                container.scrollLeft = Math.max(0, needleX - containerWidth * 0.2);
              }
            }
            return next;
          });
        }
        lastTimestamp = timestamp;
        animFrame = requestAnimationFrame(step);
      };
      animFrame = requestAnimationFrame(step);

      if (renderedVideoUrl && videoRef.current) videoRef.current.play().catch(() => {});
      if (audioUrl && audioPreviewRef.current && !mutedTracks.has("A1")) {
        audioPreviewRef.current.muted = isMuted;
        audioPreviewRef.current.play().catch(() => {});
      }
      if (bgmUrl && bgmAudioRef.current && !mutedTracks.has("A2")) {
        bgmAudioRef.current.volume = bgmVolume;
        bgmAudioRef.current.muted = isMuted;
        bgmAudioRef.current.play().catch(() => {});
      }
    } else {
      if (videoRef.current) videoRef.current.pause();
      if (audioPreviewRef.current) audioPreviewRef.current.pause();
      if (bgmAudioRef.current) bgmAudioRef.current.pause();
      footageVideoRefs.current.forEach((v) => {
        if (v) v.pause();
      });
      setIsBgmPreviewPlaying(false);
    }
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [isPlaying, totalTimelineDuration, renderedVideoUrl, audioUrl, bgmUrl, isMuted, bgmVolume, mutedTracks, currentFootageIdx, footages, clipDuration, timelineZoom]);

  // ── Seek
  const handleSeek = useCallback((newTime: number) => {
    const t = Math.max(0, Math.min(totalTimelineDuration, newTime));
    setCurrentTime(t);
    if (renderedVideoUrl && videoRef.current) videoRef.current.currentTime = t;
    if (audioUrl && audioPreviewRef.current) audioPreviewRef.current.currentTime = t;
    if (bgmUrl && bgmAudioRef.current) {
      bgmAudioRef.current.currentTime = t % (bgmAudioRef.current.duration || 60);
    }
    // Update all footage video element offsets accurately on seek
    let accStart = 0;
    footageVideoRefs.current.forEach((v, idx) => {
      if (!v) return;
      const durSec = footages[idx]?.duration || clipDuration || 3;
      const startSec = accStart;
      accStart += durSec;
      v.muted = true;

      if (t >= startSec && t < startSec + durSec) {
        v.currentTime = t - startSec;
        if (isPlaying) v.play().catch(() => {});
      } else if (t < startSec) {
        v.currentTime = 0;
        v.pause();
      } else {
        v.currentTime = durSec;
        v.pause();
      }
    });
  }, [totalTimelineDuration, renderedVideoUrl, audioUrl, bgmUrl, isPlaying, footages, clipDuration]);

  // ── VO duration & auto-fit clips to VO duration
  useEffect(() => {
    if (audioUrl) {
      const tmp = new Audio(audioUrl);
      tmp.onloadedmetadata = () => {
        if (tmp.duration && !isNaN(tmp.duration) && tmp.duration > 0) {
          setAudioDuration(tmp.duration);
          if (footages.length > 0) {
            const fitted = Number((tmp.duration / footages.length).toFixed(1));
            setClipDuration(Math.max(0.5, Math.min(15, fitted)));
          }
        }
      };
    }
  }, [audioUrl, footages.length]);

  // ── Proportional clip width calculator (px per second)
  const PX_PER_SEC = 60 * timelineZoom;

  // ── Drag-to-resize drag listener for ALL timeline elements (Footage, Transitions, Ending scene)
  const handleGenericResizeDrag = useCallback((e: MouseEvent) => {
    if (!dragResizeTarget) return;
    const pxPerSec = 60 * timelineZoom;
    const deltaX = e.clientX - dragResizeTarget.startX;
    const deltaSec = deltaX / pxPerSec;
    const isRight = dragResizeTarget.handle === "right";
    const change = isRight ? deltaSec : -deltaSec;

    if (dragResizeTarget.type === "footage") {
      const idx = dragResizeTarget.index;
      const newDur = Math.max(0.5, Math.min(30, Number((dragResizeTarget.initialDuration + change).toFixed(1))));
      // UPDATE ONLY THIS SPECIFIC FOOTAGE — OTHER FOOTAGES REMAIN 100% UNTOUCHED!
      setFootages((prev) => prev.map((f, i) => i === idx ? { ...f, duration: newDur } : f));
    } else if (dragResizeTarget.type === "transition") {
      const idx = dragResizeTarget.index;
      const newDur = Math.max(0.1, Math.min(3.0, Number((dragResizeTarget.initialDuration + change).toFixed(2))));
      setTransitions((prev) => prev.map((t, i) => i === idx ? { ...t, duration: newDur } : t));
    } else if (dragResizeTarget.type === "ending") {
      const newDur = Math.max(0.5, Math.min(10.0, Number((dragResizeTarget.initialDuration + change).toFixed(1))));
      setEndingDuration(newDur);
    }
  }, [dragResizeTarget, timelineZoom]);

  useEffect(() => {
    if (dragResizeTarget) {
      const handleMouseUp = () => setDragResizeTarget(null);
      window.addEventListener("mousemove", handleGenericResizeDrag);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleGenericResizeDrag);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragResizeTarget, handleGenericResizeDrag]);

  // ── Timeline drag
  const handleTimelineDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingPlayhead || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(ratio * totalTimelineDuration);
  }, [isDraggingPlayhead, totalTimelineDuration, handleSeek]);

  useEffect(() => {
    if (isDraggingPlayhead) {
      window.addEventListener("mousemove", handleTimelineDrag);
      window.addEventListener("mouseup", () => setIsDraggingPlayhead(false));
    }
    return () => {
      window.removeEventListener("mousemove", handleTimelineDrag);
      window.removeEventListener("mouseup", () => setIsDraggingPlayhead(false));
    };
  }, [isDraggingPlayhead, handleTimelineDrag]);

  // ── Chat scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Theme class
  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#060810]" : "bg-[#f1f5f9]";
  const cardBg = isDark ? "bg-[#0b0f1e] border-[rgba(255,255,255,0.06)]" : "bg-white border-[rgba(0,0,0,0.08)]";
  const inputCls = isDark ? "studio-input" : "studio-input-light";
  const textSub = isDark ? "text-slate-400" : "text-slate-500";
  const textHead = isDark ? "text-slate-100" : "text-slate-800";
  const panelBg = isDark ? "bg-[#08091a]" : "bg-[#f8fafc]";
  const headerBg = isDark ? "bg-[#0a0d1e] border-[rgba(255,255,255,0.06)]" : "bg-white border-[rgba(0,0,0,0.08)]";
  const trackHeaderBg = isDark ? "bg-[#0d1128]" : "bg-[#eef2ff]";
  const trackAreaBg = isDark ? "bg-[#080a18]" : "bg-[#f0f4ff]";
  const rulerBg = isDark ? "bg-[#0b0e20]" : "bg-[#e8edff]";

  // ─── API CALLS ─────────────────────────────────────────────────────────────

  const handlePolishScript = async () => {
    if (!rawScript.trim()) return;
    setIsPolishing(true);
    try {
      const res = await fetch("/api/polish-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText: rawScript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPolishedScript(data.polishedScript);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPolishing(false);
    }
  };

  const [userApiKey, setUserApiKey] = useState("");

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setUserApiKey(savedKey);
  }, []);

  const handleGenerateAudio = async () => {
    const text = polishedScript || rawScript;
    if (!text.trim()) return alert("Tuliskan naskah terlebih dahulu!");
    setIsGeneratingAudio(true);
    try {
      const res = await fetch("/api/generate-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: "Zephyr", apiKey: userApiKey }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
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

  const handleFootageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setFootages((prev) => [...prev, ...newFiles]);
    }
  };

  const handleSelectPresetBgm = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      setBgm(new File([blob], `${name}.mp3`, { type: "audio/mp3" }));
      setSelectedBgmTitle(name);
      setBgmReasoning("Pilihan manual dari pustaka BGM.");
    } catch (e: any) {
      alert("Gagal memuat BGM: " + e.message);
    }
  };

  const handleSelectBgmAI = async () => {
    const text = polishedScript || rawScript;
    if (!text.trim()) return alert("Masukkan naskah terlebih dahulu!");
    setIsSelectingBgm(true);
    try {
      const res = await fetch("/api/select-bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const audioRes = await fetch(data.track.url);
      const blob = await audioRes.blob();
      setBgm(new File([blob], `${data.track.id}.mp3`, { type: "audio/mp3" }));
      setBgmVolume(data.recommendedVolume || 0.2);
      setBgmReasoning(data.reasoning);
      setSelectedBgmTitle(data.track.title);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSelectingBgm(false);
    }
  };

  const handleRenderVideo = async () => {
    if (!audioBlob) return alert("Hasilkan Voice Over terlebih dahulu!");
    if (footages.length === 0) return alert("Upload minimal 1 video footage!");
    setIsRendering(true);
    setRenderProgress("Memproses seluruh editan timeline...");
    try {
      const formData = new FormData();
      formData.append("voiceover", audioBlob, "vo.mp3");
      formData.append("subtitleText", polishedScript || rawScript);
      formData.append("bgmVolume", bgmVolume.toString());
      formData.append("subtitleStyle", subtitleStyle);
      formData.append("subtitleFontSize", subtitleFontSize.toString());
      formData.append("clipDuration", clipDuration.toString());
      formData.append("clipDurations", JSON.stringify(footages.map((f) => f.duration || clipDuration)));
      formData.append("endingDuration", endingDuration.toString());
      formData.append("transitions", JSON.stringify(transitions));
      footages.forEach((item, idx) => formData.append(`footage_${idx}`, item.file));
      if (bgm) formData.append("bgm", bgm);
      if (endingLogo?.file) formData.append("endingLogo", endingLogo.file);

      const res = await fetch("/api/render-video", { method: "POST", body: formData });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      const videoBlob = await res.blob();
      setRenderedVideoUrl(URL.createObjectURL(videoBlob));
      setTimeout(() => setViewMode("timeline"), 300);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRendering(false);
    }
  };

  const handleExportAndDownload = async () => {
    if (!audioBlob) return alert("Hasilkan Voice Over terlebih dahulu!");
    if (footages.length === 0) return alert("Upload minimal 1 video footage!");

    setIsRendering(true);
    setRenderProgress("Memproses & Menyimpan Seluruh Editan Timeline...");
    try {
      const formData = new FormData();
      formData.append("voiceover", audioBlob, "vo.mp3");
      formData.append("subtitleText", polishedScript || rawScript);
      formData.append("bgmVolume", bgmVolume.toString());
      formData.append("subtitleStyle", subtitleStyle);
      formData.append("subtitleFontSize", subtitleFontSize.toString());
      formData.append("clipDuration", clipDuration.toString());
      formData.append("clipDurations", JSON.stringify(footages.map((f) => f.duration || clipDuration)));
      formData.append("endingDuration", endingDuration.toString());
      formData.append("transitions", JSON.stringify(transitions));
      footages.forEach((item, idx) => formData.append(`footage_${idx}`, item.file));
      if (bgm) formData.append("bgm", bgm);
      if (endingLogo?.file) formData.append("endingLogo", endingLogo.file);

      const res = await fetch("/api/render-video", { method: "POST", body: formData });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      const videoBlob = await res.blob();
      const downloadUrl = URL.createObjectURL(videoBlob);
      setRenderedVideoUrl(downloadUrl);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `video_burjolevelup_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRendering(false);
    }
  };

  // ── AI Chat Copilot
  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg || isChatLoading) return;
    setChatInput("");
    const userMsg: ChatMessage = { role: "user", text: msg, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const context = {
        clipDuration,
        subtitleStyle,
        subtitleFontSize,
        bgmVolume,
        footagesCount: footages.length,
        transitions: transitions.length,
        hasBgm: !!bgm,
        hasVoiceOver: !!audioUrl,
        totalDuration: totalTimelineDuration,
      };
      const res = await fetch("/api/ai-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context }),
      });
      const data = await res.json();

      // Apply actions
      if (data.actions) {
        for (const action of data.actions) {
          if (action.type === "change_bgm_volume" && action.payload?.volume !== undefined) {
            setBgmVolume(action.payload.volume);
          } else if (action.type === "change_subtitle_style" && action.payload?.style) {
            setSubtitleStyle(action.payload.style);
          } else if (action.type === "change_subtitle_font_size" && action.payload?.size) {
            setSubtitleFontSize(action.payload.size);
          } else if (action.type === "change_clip_duration" && typeof action.payload?.duration === "number") {
            setClipDuration(action.payload.duration);
          } else if (action.type === "add_transition" && action.payload) {
            const tLib = TRANSITION_LIBRARY.find((t) => t.type === action.payload.type);
            if (tLib) {
              setTransitions((prev) => [
                ...prev.filter((t) => t.afterClipIndex !== action.payload.afterClipIndex),
                {
                  type: action.payload.type,
                  afterClipIndex: action.payload.afterClipIndex || 0,
                  duration: action.payload.duration || 0.5,
                  label: tLib.label,
                  color: tLib.color,
                },
              ]);
            }
          } else if (action.type === "add_all_transitions" || action.type === "add_transition_all") {
            const transType = action.payload?.type || "dissolve-fade";
            const targetSlots = Math.max(2, footages.length > 1 ? footages.length - 1 : 4);
            const batch: Transition[] = [];
            for (let k = 0; k < targetSlots; k++) {
              const libItem = TRANSITION_LIBRARY[k % TRANSITION_LIBRARY.length];
              batch.push({
                type: action.payload?.type ? (action.payload.type as any) : libItem.type,
                afterClipIndex: k,
                duration: 0.5,
                label: action.payload?.type ? TRANSITION_LIBRARY.find(t=>t.type===action.payload.type)?.label || libItem.label : libItem.label,
                color: action.payload?.type ? TRANSITION_LIBRARY.find(t=>t.type===action.payload.type)?.color || libItem.color : libItem.color,
              });
            }
            setTransitions(batch);
          } else if (action.type === "remove_transition") {
            setTransitions((prev) =>
              prev.filter((t) => t.afterClipIndex !== action.payload.afterClipIndex)
            );
          } else if (action.type === "remove_all_transitions") {
            setTransitions([]);
          } else if (action.type === "update_script" && action.payload?.script) {
            setRawScript(action.payload.script);
          } else if (action.type === "polish_script") {
            handlePolishScript();
          } else if (action.type === "generate_vo") {
            handleGenerateAudio();
          } else if (action.type === "select_bgm_ai") {
            handleSelectBgmAI();
          } else if (action.type === "render_video") {
            handleRenderVideo();
          } else if (action.type === "zoom_timeline") {
            if (action.payload?.direction === "in") setTimelineZoom((z) => Math.min(4, z + 0.5));
            else if (action.payload?.direction === "out") setTimelineZoom((z) => Math.max(0.25, z - 0.5));
          }
        }
      }

      const aiMsg: ChatMessage = {
        role: "ai",
        text: data.message || "Selesai!",
        actions: data.actions,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: "Maaf, terjadi kesalahan: " + err.message, timestamp: new Date() },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ── Add transition from panel
  const addTransition = (tType: Transition["type"], afterIdx: number) => {
    const tLib = TRANSITION_LIBRARY.find((t) => t.type === tType)!;
    setTransitions((prev) => [
      ...prev.filter((t) => t.afterClipIndex !== afterIdx),
      { type: tType, afterClipIndex: afterIdx, duration: 0.5, label: tLib.label, color: tLib.color },
    ]);
  };

  const toggleMuteTrack = (trackId: string) => {
    setMutedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  // ── Timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(ratio * totalTimelineDuration);
  };



  const getClipLeft = (startSec: number) => startSec * PX_PER_SEC;
  const getClipWidth = (durationSec: number) => Math.max(durationSec * PX_PER_SEC, 30);
  const totalTimelineWidth = Math.max(totalTimelineDuration * PX_PER_SEC, 800);



  // ── Subtitle style preview
  const getSubtitleClassName = () => {
    const base = "inline-block max-w-[88%] px-3 py-1.5 rounded-xl leading-snug text-center";
    switch (subtitleStyle) {
      case "plain-shadow": return `${base} text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] [text-shadow:_0_1px_6px_rgb(0_0_0_/_60%)]`;
      case "yellow": return `${base} bg-amber-400 text-black shadow-md`;
      case "neon": return `${base} bg-cyan-400 text-black shadow-md`;
      case "box": return `${base} bg-black/90 text-white border border-slate-600`;
      case "white": return `${base} bg-white text-black shadow-sm`;
      default: return base;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <main className={`${viewMode === "timeline" ? "h-screen max-h-screen overflow-hidden" : "min-h-screen"} flex flex-col font-sans transition-colors duration-300 ${isDark ? "bg-[#060810] text-slate-100" : "bg-[#f1f5f9] text-slate-900"}`}>

      {/* ═══════════ HEADER ═══════════ */}
      <header className={`h-14 border-b px-5 flex items-center justify-between z-40 transition-colors shrink-0 ${isDark ? "bg-[#0a0d1e] border-[rgba(255,255,255,0.06)]" : "bg-white border-[rgba(0,0,0,0.1)] shadow-sm"}`}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-purple-500/30">
            AV
          </div>
          <div>
            <h1 className="font-extrabold text-xs tracking-tight flex items-center gap-2 text-indigo-400">
              AUTO VIDEO EDITOR
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-bold border border-indigo-500/25">
                F&B PRO
              </span>
            </h1>
            <p className={`text-[9px] ${textSub}`}>AI Automated Short Video Generator 9:16</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? "bg-[#0d1028] border-[rgba(255,255,255,0.06)]" : "bg-slate-100 border-slate-200"}`}>
          <button
            onClick={() => setViewMode("wizard")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${viewMode === "wizard"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
              : `${textSub} hover:text-white`
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Mode Input
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${viewMode === "timeline"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
              : `${textSub} hover:text-white`
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            Studio Timeline
            {renderedVideoUrl && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAndDownload}
            disabled={isRendering || !audioBlob || footages.length === 0}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40"
            title="Simpan seluruh editan timeline & download MP4"
          >
            {isRendering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{renderProgress || "Memproses..."}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor & Download</span>
              </>
            )}
          </button>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isDark ? "bg-[#111827] border border-[rgba(255,255,255,0.08)] text-slate-300 hover:border-indigo-500/40" : "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200"}`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* WIZARD VIEW (Responsive Mobile, Tablet & Desktop) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === "wizard" && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden p-3 sm:p-5 gap-4 lg:gap-5 max-w-7xl mx-auto w-full">

          {/* LEFT COLUMN: 4 Steps */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">

            {/* STEP 1 — Script & Voice Over */}
            <div className={`border rounded-2xl p-5 space-y-4 ${cardBg}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 font-black flex items-center justify-center text-xs border border-indigo-500/25">1</div>
                  <div>
                    <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                      <Type className="w-4 h-4 text-indigo-400" /> Script & Voice Over AI
                    </h2>
                    <p className={`text-[10px] ${textSub}`}>Ketik naskah → Polish AI → Generate suara Zephyr</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePolishScript}
                    disabled={isPolishing}
                    className={`px-3.5 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${isDark ? "bg-[#111827] border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/40" : "bg-slate-100 border-indigo-200 text-indigo-700 hover:bg-indigo-50"}`}
                  >
                    {isPolishing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Wand2 className="w-3.5 h-3.5 text-purple-400" />}
                    Polish AI
                  </button>
                  <button
                    onClick={handleGenerateAudio}
                    disabled={isGeneratingAudio}
                    className="px-4 py-1.5 btn-glow-indigo text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
                  >
                    {isGeneratingAudio ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Membuat Suara AI...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-amber-300" />
                        <span>Generate VO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <input
                    type="password"
                    placeholder="Gemini API Key Opsional (diawali AIzaSy...)"
                    value={userApiKey}
                    onChange={(e) => {
                      setUserApiKey(e.target.value);
                      localStorage.setItem("gemini_api_key", e.target.value);
                    }}
                    className={`w-full text-[10px] px-3 py-1 rounded-lg border ${inputCls}`}
                  />
                </div>
                {userApiKey ? (
                  <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Key Tersimpan
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-400">Atau diisi via .env.local VPS</span>
                )}
              </div>

              <textarea
                rows={4}
                placeholder="Masukkan naskah video promosi brand F&B Anda di sini..."
                value={rawScript}
                onChange={(e) => setRawScript(e.target.value)}
                className={`w-full text-xs p-3.5 rounded-xl resize-none leading-relaxed transition-all ${inputCls}`}
              />

              {polishedScript && (
                <div className={`p-3 rounded-xl text-xs border space-y-1 ${isDark ? "bg-indigo-950/30 border-indigo-500/25 text-indigo-200" : "bg-indigo-50 border-indigo-200 text-indigo-800"}`}>
                  <div className="flex justify-between font-semibold">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Polish AI Result:</span>
                    <button onClick={() => setPolishedScript("")} className={`text-[10px] ${textSub} hover:text-red-400`}>Reset</button>
                  </div>
                  <p className="italic leading-relaxed">{polishedScript}</p>
                </div>
              )}

              {audioUrl && (
                <div className={`p-3 rounded-xl flex items-center justify-between border ${isDark ? "bg-emerald-950/20 border-emerald-500/25" : "bg-emerald-50 border-emerald-200"}`}>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => {
                        if (audioPreviewRef.current) {
                          if (audioPreviewRef.current.paused) audioPreviewRef.current.play();
                          else audioPreviewRef.current.pause();
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer shadow-md transition-all shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>
                    <div>
                      <span className="text-xs font-bold text-emerald-400 block">Voice Over Zephyr Siap!</span>
                      <span className="text-[10px] text-slate-400 font-mono">Durasi: {audioDuration.toFixed(1)}s</span>
                    </div>
                  </div>
                  <audio controls src={audioUrl} className="h-7 w-40 opacity-80" />
                </div>
              )}
            </div>

            {/* STEP 2 — Footage & Durasi Pemotongan Klip Video */}
            <div className={`border rounded-2xl p-5 space-y-4 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 font-black flex items-center justify-center text-xs border border-indigo-500/25">2</div>
                  <div>
                    <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                      <Video className="w-4 h-4 text-indigo-400" /> Footage & Durasi Pemotongan Klip
                    </h2>
                    <p className={`text-[10px] ${textSub}`}>Upload klip video & tentukan berapa detik tiap klip akan dipotong</p>
                  </div>
                </div>
                <label className="cursor-pointer px-3 py-1.5 btn-glow-indigo text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Tambah Footage
                  <input type="file" accept="video/*" multiple onChange={handleFootageChange} className="hidden" />
                </label>
              </div>

              {/* Manual Clip Duration Input Control Box */}
              <div className={`p-4 rounded-xl border space-y-3 ${isDark ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)]" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className={`text-xs font-bold ${textHead} flex items-center gap-1.5`}>
                      <Clock className="w-4 h-4 text-indigo-400" /> Durasi Pemotongan per Klip Video:
                    </span>
                    <p className={`text-[10px] ${textSub} mt-0.5`}>Berapa lama (dalam detik) setiap klip video akan ditampilkan</p>
                  </div>

                  {/* Manual Numeric Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.5}
                      max={15}
                      step={0.5}
                      value={clipDuration}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) setClipDuration(val);
                      }}
                      className={`w-28 px-3 py-1.5 text-sm rounded-xl font-mono font-extrabold border text-center outline-none transition-all ${isDark ? "bg-[#0d1128] border-indigo-500/50 text-cyan-400 focus:border-indigo-400" : "bg-white border-indigo-300 text-indigo-700 focus:border-indigo-500"}`}
                    />
                    <span className={`text-xs font-extrabold ${textHead}`}>Detik</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="pt-2 border-t flex items-center gap-2 flex-wrap text-xs">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Pilih Cepat:</span>
                  {[1.5, 2, 2.5, 3, 4, 5].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setClipDuration(sec)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer border ${
                        clipDuration === sec
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md scale-105"
                          : isDark
                          ? "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] text-slate-300 hover:border-indigo-400/50"
                          : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                      }`}
                    >
                      {sec} Detik
                    </button>
                  ))}
                </div>
              </div>

              {/* Footage Grid */}
              {footages.length === 0 ? (
                <div className={`border-2 border-dashed rounded-xl p-6 text-center ${isDark ? "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]" : "border-slate-200 bg-slate-50"}`}>
                  <FileVideo className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                  <p className={`text-xs ${textSub}`}>Belum ada footage. Upload klip video makanan/minuman.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {footages.map((item, idx) => (
                    <div key={idx} className={`relative rounded-xl overflow-hidden border group ${isDark ? "border-[rgba(255,255,255,0.06)]" : "border-slate-200"}`}>
                      <video src={item.previewUrl} className="w-full aspect-[9/16] object-cover bg-black" />
                      <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center`}>
                        <button
                          onClick={() => setFootages((prev) => prev.filter((_, i) => i !== idx))}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className={`absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] truncate font-mono ${isDark ? "bg-black/70 text-slate-300" : "bg-black/60 text-white"}`}>
                        {item.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 3 — BGM */}
            <div className={`border rounded-2xl p-5 space-y-4 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-pink-600/20 text-pink-400 font-black flex items-center justify-center text-xs border border-pink-500/25">3</div>
                  <div>
                    <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                      <Music className="w-4 h-4 text-pink-400" /> Musik Latar (BGM)
                    </h2>
                    <p className={`text-[10px] ${textSub}`}>Pilih BGM manual atau biarkan AI memilihkan</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectBgmAI}
                    disabled={isSelectingBgm}
                    className="px-3 py-1.5 btn-glow-pink text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    {isSelectingBgm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                    AI BGM
                  </button>
                  <label className={`cursor-pointer px-3 py-1.5 border rounded-lg text-xs font-semibold ${isDark ? "bg-[#111827] border-[rgba(255,255,255,0.08)] text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                    {bgm ? "Ganti" : "+ Upload"}
                    <input type="file" accept="audio/*" onChange={(e) => setBgm(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "bsl1", name: "BGM 1 - Modern Chill", url: "/bgm/bsl1.mp3" },
                  { id: "bsl2", name: "BGM 2 - Culinary Beat", url: "/bgm/bsl2.mp3" },
                  { id: "bsl3", name: "BGM 3 - Cafe Aesthetic", url: "/bgm/bsl3.mp3" },
                  { id: "bsl4", name: "BGM 4 - Premium Gourmet", url: "/bgm/bsl4.mp3" },
                  { id: "bsl5", name: "BGM 5 - Commercial Anthem", url: "/bgm/bsl5.mp3" },
                  { id: "bsl6", name: "BGM 6 - Sweet Bakery", url: "/bgm/bsl6.mp3" },
                  { id: "bsl7", name: "BGM 7 - Summer Beverage", url: "/bgm/bsl7.mp3" },
                  { id: "bsl8", name: "BGM 8 - Viral Foodie", url: "/bgm/bsl8.mp3" },
                ].map((track) => (
                  <button
                    key={track.id}
                    onClick={() => handleSelectPresetBgm(track.url, track.name)}
                    className={`p-2 rounded-lg border text-left text-[10px] transition-all flex items-center justify-between cursor-pointer ${selectedBgmTitle === track.name
                      ? "border-pink-500 bg-pink-500/10 text-pink-300 font-bold"
                      : isDark ? "border-[rgba(255,255,255,0.06)] text-slate-400 hover:border-[rgba(255,255,255,0.12)]" : "border-slate-200 text-slate-500 hover:border-pink-200"
                    }`}
                  >
                    <span className="truncate">{track.name}</span>
                    {selectedBgmTitle === track.name && <Check className="w-3 h-3 text-pink-400 shrink-0 ml-1" />}
                  </button>
                ))}
              </div>

              {bgm && (
                <div className={`p-3 rounded-xl border space-y-2.5 ${isDark ? "bg-pink-950/20 border-pink-500/25" : "bg-pink-50 border-pink-200"}`}>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (bgmAudioRef.current) {
                            if (bgmAudioRef.current.paused) {
                              bgmAudioRef.current.play();
                              setIsBgmPreviewPlaying(true);
                            } else {
                              bgmAudioRef.current.pause();
                              setIsBgmPreviewPlaying(false);
                            }
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center cursor-pointer shadow-md transition-all shrink-0"
                      >
                        {isBgmPreviewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      </button>
                      <span className="font-bold text-pink-400 truncate max-w-[180px]">{bgm.name}</span>
                    </div>
                    <span className="font-mono text-pink-400 text-[11px] font-bold">Volume: {Math.round(bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range" min="0.05" max="0.5" step="0.05" value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="w-full accent-pink-500"
                  />
                </div>
              )}
            </div>

            {/* STEP 4 — Subtitle */}
            <div className={`border rounded-2xl p-5 space-y-4 ${cardBg}`}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 font-black flex items-center justify-center text-xs border border-purple-500/25">4</div>
                <div>
                  <h2 className={`text-sm font-bold flex items-center gap-2 ${textHead}`}>
                    <Type className="w-4 h-4 text-purple-400" /> Gaya Subtitle
                  </h2>
                  <p className={`text-[10px] ${textSub}`}>Pilih tampilan teks per 4 kata yang muncul di video</p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {SUBTITLE_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubtitleStyle(s.id as any)}
                    className={`p-2.5 rounded-xl border transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer ${subtitleStyle === s.id
                      ? `border-purple-500 ${isDark ? "bg-purple-500/10" : "bg-purple-50"}`
                      : isDark ? "border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]" : "border-slate-200 hover:border-purple-200"
                    }`}
                  >
                    <span className={`px-2 py-0.5 text-[9px] rounded font-bold ${s.preview}`}>Aa</span>
                    <span className={`text-[9px] font-semibold leading-tight ${textSub}`}>{s.name}</span>
                  </button>
                ))}
              </div>

              {/* Font size slider & preset buttons */}
              <div className={`p-3.5 rounded-xl border space-y-3 ${isDark ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)]" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className={textSub}>Ukuran Font (Font Size):</span>
                  <span className="text-purple-400 font-mono font-bold text-xs">{subtitleFontSize}px</span>
                </div>
                <input
                  type="range" min="14" max="38" step="2" value={subtitleFontSize}
                  onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    { size: 18, label: "Kecil (18px)" },
                    { size: 22, label: "Sedang (22px)" },
                    { size: 28, label: "Besar (28px)" },
                    { size: 34, label: "Jumbo (34px)" },
                  ].map((btn) => (
                    <button
                      key={btn.size}
                      onClick={() => setSubtitleFontSize(btn.size)}
                      className={`flex-1 py-1 rounded text-[9px] font-bold border cursor-pointer transition-all ${subtitleFontSize === btn.size
                        ? "bg-purple-600 text-white border-purple-500 shadow-sm"
                        : isDark ? "bg-[#0d1128] border-[rgba(255,255,255,0.08)] text-slate-400 hover:text-slate-200" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ending Logo */}
              <div className={`pt-3 border-t flex items-center justify-between text-xs ${isDark ? "border-[rgba(255,255,255,0.06)]" : "border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 border rounded-xl overflow-hidden p-1 ${isDark ? "border-[rgba(255,255,255,0.08)]" : "border-slate-200"}`}>
                    <img src={endingLogo?.previewUrl} alt="Ending" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className={`font-bold text-xs flex items-center gap-1 ${textHead}`}>
                      <ImageIcon className="w-3 h-3 text-amber-400" /> Akhiran Dissolve (2.5s)
                    </span>
                    <p className={`text-[10px] ${textSub}`}>Cover akhiran brand di akhir video</p>
                  </div>
                </div>
                <label className="cursor-pointer text-amber-400 text-xs font-bold hover:underline">
                  Ganti
                  <input type="file" accept="image/*" onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const f = e.target.files[0];
                      setEndingLogo({ file: f, previewUrl: URL.createObjectURL(f) });
                    }
                  }} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Preview + Render */}
          <div className={`w-full lg:w-80 border rounded-2xl p-4 flex flex-col items-center gap-4 shrink-0 ${cardBg}`}>
            {/* Timecode */}
            <div className="w-full flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                <span className="font-mono font-bold text-emerald-400">CANVAS 9:16</span>
              </div>
              <span className={`font-mono text-xs px-2 py-0.5 rounded border font-bold ${isDark ? "bg-[#0d1128] border-[rgba(255,255,255,0.08)] text-cyan-400" : "bg-slate-100 border-slate-200 text-indigo-600"}`}>
                {formatTimecode(currentTime)}
              </span>
            </div>

            {/* 9:16 Preview Canvas */}
            <div className="w-full aspect-[9/16] bg-black rounded-2xl overflow-hidden relative border border-[rgba(255,255,255,0.08)] shadow-2xl shadow-indigo-900/30">
              {renderedVideoUrl ? (
                <video ref={videoRef} src={renderedVideoUrl} controls className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full relative bg-slate-950 flex flex-col items-center justify-center">
                  {footages.length > 0 ? (
                    <video
                      ref={previewVideoRef}
                      src={footages[currentFootageIdx]?.previewUrl}
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                      muted loop playsInline
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center p-6">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Smartphone className="w-8 h-8 text-indigo-400 animate-pulse" />
                      </div>
                      <p className="text-xs text-slate-400">Pratinjau Live 9:16</p>
                      <p className="text-[10px] text-slate-600">Isi naskah & upload footage</p>
                    </div>
                  )}

                  {/* Subtitle overlay */}
                  {currentChunk && (
                    <div className="absolute bottom-12 left-3 right-3 text-center z-20 pointer-events-none flex justify-center subtitle-chunk">
                      <span
                        style={{
                          fontSize: `${Math.round(subtitleFontSize * 0.9)}px`,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                          fontWeight: 500,
                        }}
                        className={getSubtitleClassName()}
                      >
                        {currentChunk.text}
                      </span>
                    </div>
                  )}

                  {/* Ending dissolve */}
                  {endingLogo && totalTimelineDuration > 2.5 && currentTime >= (totalTimelineDuration - 2.5) && (
                    <div className="absolute inset-0 bg-black z-30 flex items-center justify-center transition-opacity duration-700">
                      <img src={endingLogo.previewUrl} alt="Ending" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Playback controls */}
            <div className="w-full flex items-center justify-center gap-3">
              <button onClick={() => handleSeek(0)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)]" : "bg-slate-100 hover:bg-slate-200"} cursor-pointer transition-all`}>
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/30 hover:scale-105 transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              <button onClick={() => handleSeek(totalTimelineDuration)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)]" : "bg-slate-100 hover:bg-slate-200"} cursor-pointer transition-all`}>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${isMuted ? "bg-rose-600/20 text-rose-400" : isDark ? "bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-500"}`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Seek bar */}
            <div className="w-full">
              <input
                type="range" min={0} max={totalTimelineDuration} step={0.1} value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] font-mono mt-0.5">
                <span className={textSub}>{formatTimecode(currentTime)}</span>
                <span className={textSub}>{formatTimecode(totalTimelineDuration)}</span>
              </div>
            </div>

            {/* Render CTA */}
            <div className="w-full space-y-2">
              {renderedVideoUrl ? (
                <>
                  <a
                    href={renderedVideoUrl}
                    download="video_9x16.mp4"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <Download className="w-4 h-4" /> DOWNLOAD MP4 (9:16)
                  </a>
                  <button
                    onClick={() => setViewMode("timeline")}
                    className="w-full py-2.5 btn-glow-indigo text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5" /> Buka Studio Timeline
                  </button>
                </>
              ) : (
                <button
                  onClick={handleRenderVideo}
                  disabled={isRendering || !audioBlob || footages.length === 0}
                  className="w-full py-3.5 btn-glow-indigo disabled:opacity-40 text-white rounded-xl text-xs flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer font-black"
                >
                  {isRendering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{renderProgress || "Memproses Video..."}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current text-amber-300" />
                      <span>RENDER & BUKA STUDIO</span>
                    </>
                  )}
                </button>
              )}
              {isRendering && <div className="render-progress-bar w-full" />}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STUDIO TIMELINE VIEW — TOTAL REDESIGN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === "timeline" && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* ── Studio Sub-Header (Transport & Mobile Selector) ── */}
          <div className={`h-10 border-b px-3 md:px-4 flex items-center justify-between shrink-0 ${isDark ? "bg-[#090c1c] border-[rgba(255,255,255,0.05)]" : "bg-white border-[rgba(0,0,0,0.08)]"}`}>
            {/* Left transport */}
            <div className="flex items-center gap-2">
              <button onClick={() => handleSeek(0)} className={`w-7 h-7 rounded flex items-center justify-center text-xs cursor-pointer transition-all ${isDark ? "hover:bg-[rgba(255,255,255,0.08)] text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-500"}`}>
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button onClick={() => handleSeek(totalTimelineDuration)} className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-all ${isDark ? "hover:bg-[rgba(255,255,255,0.08)] text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-500"}`}>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <div className={`px-2 md:px-3 py-1 rounded font-mono text-[11px] md:text-xs font-bold border ml-1 md:ml-2 ${isDark ? "bg-[#060810] border-[rgba(255,255,255,0.08)] text-cyan-400" : "bg-slate-50 border-slate-200 text-indigo-600"}`}>
                {formatTimecode(currentTime)} / {formatTimecode(totalTimelineDuration)}
              </div>
            </div>

            {/* Center: Tool controls */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className={`text-xs font-bold ${textSub} hidden sm:inline`}>Zoom:</span>
              <button onClick={() => setTimelineZoom((z) => Math.max(0.25, z - 0.25))} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-[rgba(255,255,255,0.08)] text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className={`text-[10px] font-mono font-bold ${textSub} w-8 sm:w-10 text-center`}>{Math.round(timelineZoom * 100)}%</span>
              <button onClick={() => setTimelineZoom((z) => Math.min(4, z + 0.25))} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-[rgba(255,255,255,0.08)] text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {audioDuration > 0 && footages.length > 0 && (
                <button
                  onClick={() => {
                    const fitted = Number((audioDuration / footages.length).toFixed(1));
                    setClipDuration(Math.max(0.5, Math.min(15, fitted)));
                  }}
                  className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-600/30 transition-all cursor-pointer flex items-center gap-1"
                  title="Pas kan durasi klip tepat dengan durasi Voice Over"
                >
                  ⚡ Auto-Fit VO ({Number((audioDuration / footages.length).toFixed(1))}s/klip)
                </button>
              )}
              <div className={`h-4 w-px mx-1 ${isDark ? "bg-[rgba(255,255,255,0.08)]" : "bg-slate-200"}`} />
              <button
                onClick={handleExportAndDownload}
                disabled={isRendering || !audioBlob || footages.length === 0}
                className="px-2.5 sm:px-3 py-1.5 btn-glow-indigo text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="hidden sm:inline">{renderProgress || "Memproses..."}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3 text-amber-300" />
                    <span className="hidden sm:inline">Simpan & Download</span>
                  </>
                )}
              </button>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer ${isMuted ? "text-rose-400" : textSub} transition-all hover:text-white`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Mobile/Tablet Panel Switcher Bar */}
          <div className={`flex lg:hidden border-b px-2 py-1 gap-1 text-xs shrink-0 ${isDark ? "bg-[#0b0e24] border-[rgba(255,255,255,0.06)]" : "bg-slate-100 border-slate-200"}`}>
            <button
              onClick={() => setMobileStudioTab("assets")}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] cursor-pointer ${mobileStudioTab === "assets" ? "bg-indigo-600 text-white shadow-sm" : `${textSub} hover:text-white`}`}
            >
              <Layers className="w-3.5 h-3.5" /> Assets & Media
            </button>
            <button
              onClick={() => setMobileStudioTab("monitor")}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] cursor-pointer ${mobileStudioTab === "monitor" ? "bg-indigo-600 text-white shadow-sm" : `${textSub} hover:text-white`}`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Monitor 9:16
            </button>
            <button
              onClick={() => setMobileStudioTab("copilot")}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] cursor-pointer ${mobileStudioTab === "copilot" ? "bg-indigo-600 text-white shadow-sm" : `${textSub} hover:text-white`}`}
            >
              <Cpu className="w-3.5 h-3.5" /> AI Copilot
            </button>
          </div>

          {/* ── Main Studio 3-Panel Layout (Responsive) ── */}
          <div className="flex-1 flex overflow-hidden min-h-0">

            {/* ══ LEFT PANEL — Media Bin & Elements ══ */}
            <div className={`w-full lg:w-64 border-r flex flex-col shrink-0 ${mobileStudioTab === "assets" ? "flex" : "hidden lg:flex"} ${isDark ? "bg-[#08091a] border-[rgba(255,255,255,0.05)]" : "bg-[#f8fafc] border-[rgba(0,0,0,0.08)]"}`}>
              {/* Panel Tabs */}
              <div className={`flex border-b ${isDark ? "bg-[#0a0c1e] border-[rgba(255,255,255,0.05)]" : "bg-slate-100 border-slate-200"}`}>
                {(["media", "text", "elements", "transitions"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveLeftTab(tab)}
                    className={`panel-tab ${activeLeftTab === tab ? "active" : ""}`}
                  >
                    {tab === "media" ? "Media" : tab === "text" ? "Text" : tab === "elements" ? "Elemen" : "Transisi"}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">

                {/* MEDIA TAB */}
                {activeLeftTab === "media" && (
                  <div className="space-y-3 animate-fade-slide-in">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Video Clips ({footages.length})</span>
                      <label className="cursor-pointer text-[10px] px-2 py-1 bg-indigo-600/20 text-indigo-400 rounded font-bold hover:bg-indigo-600/30 transition-all">
                        + Add
                        <input type="file" accept="video/*" multiple onChange={handleFootageChange} className="hidden" />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {footages.map((item, idx) => (
                        <div key={idx} className="media-thumb group relative">
                          <video src={item.previewUrl} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-end p-1.5">
                            <span className="text-[8px] font-mono text-white/0 group-hover:text-white/80 transition-all truncate">{item.file.name}</span>
                          </div>
                          <button
                            onClick={() => setFootages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                          <div className="absolute top-1 left-1 text-[8px] font-mono text-white/60 bg-black/50 px-1 rounded">
                            {(idx + 1).toString().padStart(2, "0")}
                          </div>
                        </div>
                      ))}
                    </div>

                    {footages.length === 0 && (
                      <label className={`cursor-pointer flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center gap-2 transition-all hover:border-indigo-500/50 ${isDark ? "border-[rgba(255,255,255,0.08)]" : "border-slate-300"}`}>
                        <FileVideo className="w-8 h-8 text-slate-500" />
                        <span className={`text-[10px] ${textSub}`}>Upload footage</span>
                        <input type="file" accept="video/*" multiple onChange={handleFootageChange} className="hidden" />
                      </label>
                    )}

                    {/* BGM Section */}
                    <div className={`mt-2 pt-2 border-t ${isDark ? "border-[rgba(255,255,255,0.05)]" : "border-slate-200"}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>BGM</span>
                      {bgm ? (
                        <div className={`mt-2 p-2 rounded-lg border flex items-center gap-2 ${isDark ? "bg-pink-950/20 border-pink-500/20" : "bg-pink-50 border-pink-200"}`}>
                          <Music className="w-4 h-4 text-pink-400 shrink-0" />
                          <span className="text-[10px] truncate text-pink-400 font-bold">{bgm.name}</span>
                          <button onClick={() => setBgm(null)} className="ml-auto shrink-0"><X className="w-3 h-3 text-rose-400" /></button>
                        </div>
                      ) : (
                        <label className={`mt-2 flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:border-pink-500/40 transition-all ${isDark ? "border-[rgba(255,255,255,0.06)]" : "border-slate-200"}`}>
                          <Music className="w-4 h-4 text-pink-400" />
                          <span className={`text-[10px] ${textSub}`}>Upload BGM...</span>
                          <input type="file" accept="audio/*" onChange={(e) => setBgm(e.target.files?.[0] || null)} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* TEXT TAB */}
                {activeLeftTab === "text" && (
                  <div className="space-y-3 animate-fade-slide-in">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Elemen Teks</span>
                    {[
                      { label: "Script Utama", icon: AlignLeft },
                      { label: "Subtitle Style", icon: Type },
                      { label: "Font Size", icon: Sliders },
                    ].map(({ label, icon: Icon }, i) => (
                      <div key={i} className={`p-3 rounded-xl border ${isDark ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)]" : "bg-white border-slate-200"}`}>
                        <div className={`flex items-center gap-2 text-xs font-bold mb-2 ${textHead}`}>
                          <Icon className="w-3.5 h-3.5 text-purple-400" /> {label}
                        </div>
                        {i === 0 && (
                          <textarea
                            rows={4} value={rawScript} onChange={(e) => setRawScript(e.target.value)}
                            className={`w-full text-[10px] p-2 rounded-lg resize-none ${inputCls}`}
                            placeholder="Naskah video..."
                          />
                        )}
                        {i === 1 && (
                          <div className="grid grid-cols-3 gap-1">
                            {SUBTITLE_STYLES.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => setSubtitleStyle(s.id as any)}
                                className={`px-1.5 py-1 rounded text-[9px] font-bold transition-all cursor-pointer ${subtitleStyle === s.id ? "ring-2 ring-purple-500 bg-purple-500/10 text-purple-300" : `${textSub} ${isDark ? "bg-[rgba(255,255,255,0.03)]" : "bg-slate-50"}`}`}
                              >
                                {s.name.split(" ")[0]}
                              </button>
                            ))}
                          </div>
                        )}
                        {i === 2 && (
                          <div className="flex items-center gap-2">
                            <input
                              type="range" min="14" max="38" step="2" value={subtitleFontSize}
                              onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                              className="flex-1 accent-purple-500"
                            />
                            <span className="text-[10px] font-mono text-purple-400 font-bold w-8">{subtitleFontSize}px</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ELEMENTS TAB */}
                {activeLeftTab === "elements" && (
                  <div className="space-y-3 animate-fade-slide-in">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Elemen Visual</span>
                    {/* Ending Logo */}
                    <div className={`p-3 rounded-xl border space-y-2 ${isDark ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)]" : "bg-white border-slate-200"}`}>
                      <span className={`text-xs font-bold ${textHead}`}>Ending Dissolve Logo</span>
                      {endingLogo && (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-amber-500/30 bg-black">
                            <img src={endingLogo.previewUrl} alt="Ending" className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <p className={`text-[10px] font-bold ${textHead}`}>Cover akhir (2.5s)</p>
                            <label className="text-[10px] text-amber-400 cursor-pointer hover:underline font-bold">
                              Ganti foto
                              <input type="file" accept="image/*" onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  const f = e.target.files[0];
                                  setEndingLogo({ file: f, previewUrl: URL.createObjectURL(f) });
                                }
                              }} className="hidden" />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Durasi Pemotongan Klip */}
                    <div className={`p-3 rounded-xl border space-y-2 ${isDark ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)]" : "bg-white border-slate-200"}`}>
                      <span className={`text-xs font-bold ${textHead}`}>Durasi per Klip</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0.5}
                          max={15}
                          step={0.5}
                          value={clipDuration}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) setClipDuration(val);
                          }}
                          className={`w-20 px-2 py-1 text-xs rounded-lg font-mono font-bold border text-center outline-none ${isDark ? "bg-[#0d1128] border-indigo-500/50 text-cyan-400" : "bg-white border-slate-200 text-indigo-700"}`}
                        />
                        <span className={`text-xs ${textSub}`}>Detik</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TRANSITIONS TAB */}
                {activeLeftTab === "transitions" && (
                  <div className="space-y-3 animate-fade-slide-in">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Pustaka Transisi</span>
                    <p className={`text-[10px] ${textSub} leading-relaxed`}>Pilih transisi & klik klip mana setelah klip yang ingin ditambahkan transisi.</p>

                    {/* Transition Library */}
                    <div className="space-y-1.5">
                      {TRANSITION_LIBRARY.map((t) => (
                        <div
                          key={t.type}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] group ${isDark ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)]" : "bg-white border-slate-200 hover:border-slate-300"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{t.icon}</span>
                              <div>
                                <p className={`text-xs font-bold ${textHead}`}>{t.label}</p>
                                <p className={`text-[9px] ${textSub}`}>{t.desc}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {footages.length > 0 && footages.slice(0, footages.length - 1).map((_, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => addTransition(t.type, idx)}
                                  className="text-[9px] px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer"
                                  style={{ background: t.color + "30", color: t.color }}
                                  title={`Setelah klip ${idx + 1}`}
                                >
                                  {idx + 1}→
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Active Transitions */}
                    {transitions.length > 0 && (
                      <div className={`mt-2 pt-2 border-t ${isDark ? "border-[rgba(255,255,255,0.05)]" : "border-slate-200"}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Transisi Aktif ({transitions.length})</span>
                        <div className="mt-2 space-y-1">
                          {transitions.map((t, i) => (
                            <div key={i} className={`flex items-center justify-between p-2 rounded-lg border ${isDark ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)]" : "bg-white border-slate-200"}`}>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                                <span className="text-[10px] font-bold" style={{ color: t.color }}>{t.label}</span>
                                <span className={`text-[9px] ${textSub}`}>setelah klip {t.afterClipIndex + 1}</span>
                              </div>
                              <button onClick={() => setTransitions((prev) => prev.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ══ CENTER — Program Monitor ══ */}
            <div className={`flex-1 flex flex-col items-center justify-between p-3 lg:p-4 gap-3 lg:gap-4 relative overflow-hidden ${mobileStudioTab === "monitor" ? "flex" : "hidden lg:flex"} ${isDark ? "bg-[#060811]" : "bg-[#eef2ff]"}`}>
              {/* Program Monitor Label */}
              <div className={`w-full flex items-center justify-between text-xs`}>
                <span className={`font-bold uppercase tracking-wider text-[10px] ${textSub}`}>Program Monitor</span>
                <div className="flex items-center gap-2">
                  {renderedVideoUrl && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Video Render Siap
                    </span>
                  )}
                </div>
              </div>

              {/* 9:16 Video Preview (Live Composition driven 100% by Studio Timeline) */}
              <div className="relative h-[calc(100%-48px)] max-h-[460px] 2xl:max-h-[520px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl shadow-indigo-900/40 border border-[rgba(255,255,255,0.07)]">
                <div className="w-full h-full relative bg-[#0a0c18]">
                  {footages.length > 0 ? (
                    footages.map((item, idx) => {
                      const isCurrent = currentFootageIdx === idx;
                      const activeTrans = transitionProgress;
                      const isTransClip = activeTrans && (activeTrans.clipIndex === idx || activeTrans.clipIndex + 1 === idx);
                      const isVisibleInDOM = isCurrent || isTransClip;

                      let opacity = 1;
                      let clipPath = "none";
                      let transform = "none";
                      let filter = "none";

                      if (activeTrans) {
                        if (activeTrans.clipIndex === idx) {
                          // Outgoing Clip (Clip A)
                          if (activeTrans.type === "passerby") {
                            // Dynamic Slide Left (Slide Clip A out to the left)
                            transform = `translateX(${-activeTrans.progress * 100}%)`;
                            opacity = 1;
                          } else if (activeTrans.type === "zoom-blur") {
                            // Rapid Camera Zoom In
                            opacity = 1 - activeTrans.progress;
                            transform = `scale(${1 + activeTrans.progress * 0.25})`;
                            filter = `blur(${activeTrans.flareOpacity * 8}px)`;
                          } else if (activeTrans.type === "glitch") {
                            // Digital Pixel Glitch Shift
                            opacity = 1 - activeTrans.progress * 0.4;
                            filter = `contrast(140%) hue-rotate(${activeTrans.flareOpacity * 120}deg)`;
                          } else if (activeTrans.type === "dissolve-fade") {
                            // Cinematic Fade to Black
                            opacity = activeTrans.progress < 0.5 ? 1 - activeTrans.progress * 2 : 0;
                          } else {
                            opacity = 1 - activeTrans.progress;
                          }
                        } else if (activeTrans.clipIndex + 1 === idx) {
                          // Incoming Clip (Clip B)
                          if (activeTrans.type === "passerby") {
                            // Dynamic Slide Left (Slide Clip B in from the right)
                            transform = `translateX(${(1 - activeTrans.progress) * 100}%)`;
                            opacity = 1;
                          } else if (activeTrans.type === "zoom-blur") {
                            // Rapid Camera Zoom In Reveal
                            opacity = activeTrans.progress;
                            transform = `scale(${1.25 - activeTrans.progress * 0.25})`;
                            filter = `blur(${(1 - activeTrans.progress) * 8}px)`;
                          } else if (activeTrans.type === "glitch") {
                            opacity = activeTrans.progress;
                            transform = `translateX(${Math.sin(activeTrans.progress * 24) * 10}px)`;
                          } else if (activeTrans.type === "dissolve-fade") {
                            // Cinematic Fade to Black Reveal
                            opacity = activeTrans.progress >= 0.5 ? (activeTrans.progress - 0.5) * 2 : 0;
                          } else {
                            opacity = activeTrans.progress;
                          }
                        }
                      }

                      return (
                        <video
                          key={idx}
                          src={item.previewUrl}
                          ref={(el) => {
                            footageVideoRefs.current[idx] = el;
                            if (isCurrent) previewVideoRef.current = el;
                          }}
                          preload="auto"
                          className="absolute inset-0 w-full h-full object-cover border-0 outline-none"
                          style={{
                            display: isVisibleInDOM ? "block" : "none",
                            opacity,
                            clipPath,
                            transform,
                            filter,
                            zIndex: (activeTrans && activeTrans.clipIndex + 1 === idx) ? 20 : isCurrent ? 10 : 5,
                            pointerEvents: isVisibleInDOM ? "auto" : "none",
                            willChange: "opacity, transform, filter, clip-path",
                          }}
                          muted
                          playsInline
                        />
                      );
                    })
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center p-6">
                      <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Film className="w-10 h-10 text-indigo-400 opacity-50" />
                      </div>
                      <p className="text-xs text-slate-500">Upload footage dan atur timeline</p>
                    </div>
                  )}

                    {/* Subtitle Chunk Overlay */}
                    {currentChunk && (
                      <div className="absolute bottom-10 left-2 right-2 text-center z-20 pointer-events-none flex justify-center subtitle-chunk">
                        <span
                          style={{
                            fontSize: `${Math.round(subtitleFontSize * 0.9)}px`,
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                            fontWeight: 500,
                            lineHeight: 1.4,
                          }}
                          className={getSubtitleClassName()}
                        >
                          {currentChunk.text}
                        </span>
                      </div>
                    )}

                    {/* Ending dissolve cover */}
                    {endingLogo && currentTime >= mainContentDuration - 0.5 && (
                      <div
                        className="absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-500"
                        style={{
                          opacity: Math.max(0, Math.min(1, (currentTime - (mainContentDuration - 0.5)) / 0.5)),
                        }}
                      >
                        <img src={endingLogo.previewUrl} alt="Ending" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Transition Visual Overlay - matches FFmpeg xfade exactly */}
                    {transitionProgress && (() => {
                      const { type, progress, flareOpacity } = transitionProgress;
                      const p = progress;

                      // hlslice / light-leak: horizontal light streak sweeps across
                      if (type === "light-leak" || type === "film-burn") {
                        const color = type === "film-burn" ? "from-orange-500/80 via-red-400/60 to-transparent" : "from-transparent via-amber-200/90 to-transparent";
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                            <div className={`absolute top-0 bottom-0 w-32 bg-gradient-to-r ${color} blur-sm`}
                              style={{ left: `${(p - 0.25) * 130}%`, opacity: flareOpacity * 0.9 }} />
                          </div>
                        );
                      }

                      // fadewhite / flash-white: whole screen flashes white
                      if (type === "flash-white") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none bg-white"
                            style={{ opacity: flareOpacity * 0.95 }} />
                        );
                      }

                      // fadeblack / fade-black / slow-shutter: whole screen fades to black
                      if (type === "fade-black" || type === "slow-shutter") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none bg-black"
                            style={{ opacity: flareOpacity * 0.9 }} />
                        );
                      }

                      // dissolve: cross dissolve — fades between clips (handled by video opacity)
                      if (type === "dissolve-fade" || type === "cross-fade") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none bg-white/10"
                            style={{ opacity: flareOpacity * 0.3 }} />
                        );
                      }

                      // zoomin / zoom-blur: scale + blur effect
                      if (type === "zoom-blur") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none"
                            style={{ backdropFilter: `blur(${flareOpacity * 8}px)`, opacity: flareOpacity * 0.6 }}>
                            <div className="absolute inset-0 bg-white/5" />
                          </div>
                        );
                      }

                      // pixelize / glitch: glitch scanlines
                      if (type === "glitch") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                            {[...Array(6)].map((_, i) => (
                              <div key={i} className="absolute w-full bg-cyan-400/40"
                                style={{ top: `${(i / 6) * 100 + Math.sin(p * Math.PI + i) * 5}%`, height: `${flareOpacity * 6}px`, opacity: flareOpacity * 0.8 }} />
                            ))}
                          </div>
                        );
                      }

                      // circlecrop / iris-circle: radial circle reveal
                      if (type === "iris-circle") {
                        const size = p < 0.5 ? (1 - p * 2) * 150 : (p - 0.5) * 2 * 150;
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none bg-black"
                            style={{ clipPath: `circle(${size}% at 50% 50%)`, opacity: 1 - flareOpacity }} />
                        );
                      }

                      // hrslice / wipe-horizontal: horizontal wipe
                      if (type === "wipe-horizontal" || type === "wipe-fade") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                            <div className="absolute top-0 bottom-0 right-0 bg-black/30"
                              style={{ left: `${p * 100}%`, opacity: 0.5 }} />
                            <div className="absolute top-0 bottom-0 w-1 bg-white/50"
                              style={{ left: `${p * 100}%` }} />
                          </div>
                        );
                      }

                      // wipetl / wipe-diagonal: diagonal wipe
                      if (type === "wipe-diagonal") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none bg-black/20"
                            style={{ clipPath: `polygon(0 0, ${p * 120}% 0, ${p * 120 - 20}% 100%, 0 100%)`, opacity: 0.7 }} />
                        );
                      }

                      // slideleft / passerby: slide
                      if (type === "passerby") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                            <div className="absolute top-0 bottom-0 w-2 bg-white/60"
                              style={{ left: `${p * 100}%`, opacity: flareOpacity }} />
                          </div>
                        );
                      }

                      // lens-flare / radial: radial sweep glow
                      if (type === "lens-flare") {
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none">
                            <div className="absolute w-40 h-40 rounded-full bg-cyan-300/50 blur-xl"
                              style={{ top: "40%", left: `${(p - 0.1) * 120}%`, opacity: flareOpacity * 0.8 }} />
                          </div>
                        );
                      }

                      // vignette / color-split: color glow
                      if (type === "vignette" || type === "color-split") {
                        const color = type === "color-split" ? "255,50,80" : "100,50,200";
                        return (
                          <div className="absolute inset-0 z-30 pointer-events-none rounded-[inherit]"
                            style={{ boxShadow: `inset 0 0 80px rgba(${color},${flareOpacity * 0.6})` }} />
                        );
                      }

                      return null;
                    })()}
                </div>
              </div>

              {/* Transport bar */}
              <div className={`w-full max-w-xs border rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-xl ${isDark ? "bg-[#0d1128] border-[rgba(255,255,255,0.07)]" : "bg-white border-slate-200"}`}>
                <button onClick={() => handleSeek(0)} className={`cursor-pointer ${textSub} hover:text-white transition-all`}><SkipBack className="w-4 h-4" /></button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center cursor-pointer shadow-lg hover:scale-105 transition-all">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <button onClick={() => handleSeek(totalTimelineDuration)} className={`cursor-pointer ${textSub} hover:text-white transition-all`}><SkipForward className="w-4 h-4" /></button>
                <span className={`font-mono text-xs font-bold flex-1 text-center ${isDark ? "text-cyan-400" : "text-indigo-600"}`}>{formatTimecode(currentTime)}</span>
                <button onClick={() => setIsMuted(!isMuted)} className={`cursor-pointer transition-all ${isMuted ? "text-rose-400" : textSub}`}>
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ══ RIGHT PANEL — AI Chat Copilot ══ */}
            <div className={`w-full lg:w-72 border-l flex flex-col shrink-0 ${mobileStudioTab === "copilot" ? "flex" : "hidden lg:flex"} ${isDark ? "bg-[#08091a] border-[rgba(255,255,255,0.05)]" : "bg-[#f8fafc] border-[rgba(0,0,0,0.08)]"}`}>
              {/* Chat Header */}
              <div className={`px-4 py-3 border-b flex items-center gap-3 ${isDark ? "bg-[#0a0c1e] border-[rgba(255,255,255,0.05)]" : "bg-white border-slate-200"}`}>
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <Cpu className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h3 className={`text-xs font-extrabold ${textHead}`}>AI Copilot</h3>
                  <p className={`text-[9px] ${textSub}`}>Perintah natural language editing</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] text-emerald-400 font-bold">Online</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col animate-fade-slide-up`}>
                    <div className={isDark
                      ? (msg.role === "user" ? "chat-bubble-user self-end" : "chat-bubble-ai self-start")
                      : (msg.role === "user" ? "chat-bubble-user-light self-end" : "chat-bubble-ai-light self-start")
                    }>
                      {msg.text}
                    </div>
                    {msg.actions && msg.actions.length > 0 && msg.actions[0].type !== "none" && (
                      <div className="flex flex-wrap gap-1 mt-1 self-start">
                        {msg.actions.map((action: any, j: number) => (
                          <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-mono border border-indigo-500/25">
                            ✓ {action.type}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className={`text-[8px] mt-0.5 ${textSub} ${msg.role === "user" ? "self-end" : "self-start"}`}>
                      {msg.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {isChatLoading && (
                  <div className={isDark ? "chat-bubble-ai self-start" : "chat-bubble-ai-light self-start"}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick prompts */}
              <div className={`px-3 py-2 border-t ${isDark ? "border-[rgba(255,255,255,0.05)]" : "border-slate-200"}`}>
                <p className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${textSub}`}>Quick Prompts</p>
                <div className="flex flex-wrap gap-1">
                  {["percepat klip", "tambah dissolve", "subtitle lebih besar", "volume BGM 30%", "ganti subtitle neon"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); chatInputRef.current?.focus(); }}
                      className={`text-[9px] px-2 py-0.5 rounded-full border cursor-pointer transition-all hover:border-indigo-500/50 ${isDark ? "border-[rgba(255,255,255,0.08)] text-slate-400 hover:text-indigo-300" : "border-slate-200 text-slate-500 hover:text-indigo-600"}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input */}
              <div className={`p-3 border-t ${isDark ? "border-[rgba(255,255,255,0.05)]" : "border-slate-200"}`}>
                <div className={`flex gap-2 items-center p-2 rounded-xl border ${isDark ? "bg-[#0d1128] border-[rgba(255,255,255,0.08)]" : "bg-white border-slate-200"}`}>
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                    placeholder="Ketik perintah editing..."
                    className={`flex-1 bg-transparent text-xs outline-none ${isDark ? "text-slate-200 placeholder-slate-600" : "text-slate-800 placeholder-slate-400"}`}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center cursor-pointer disabled:opacity-40 transition-all hover:scale-105 shrink-0"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ══ BOTTOM TIMELINE ══ */}
          <div className={`border-t flex flex-col shrink-0 ${isDark ? "bg-[#09091f] border-[rgba(255,255,255,0.05)]" : "bg-white border-slate-200"}`} style={{ height: "220px" }}>

            {/* Timeline Header Bar */}
            <div className={`h-8 border-b px-3 flex items-center justify-between text-[10px] shrink-0 ${isDark ? "bg-[#0b0c22] border-[rgba(255,255,255,0.05)]" : "bg-slate-100 border-slate-200"}`}>
              <span className={`font-extrabold uppercase tracking-wider text-indigo-400`}>Studio Timeline</span>
              <div className="flex items-center gap-3">
                <span className={`font-mono ${textSub}`}>{subtitleChunks.length} subtitles · {footages.length} klip · {transitions.length} transisi</span>
                <span className={`font-mono ${textSub}`}>{totalTimelineDuration.toFixed(1)}s total</span>
              </div>
            </div>

            {/* Tracks + Ruler Area */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Track Headers */}
              <div className={`w-28 border-r shrink-0 flex flex-col ${isDark ? "bg-[#0b0c22] border-[rgba(255,255,255,0.05)]" : "bg-[#eef2ff] border-slate-200"}`}>
                {/* Ruler header corner */}
                <div className={`h-6 border-b ${isDark ? "border-[rgba(255,255,255,0.05)]" : "border-slate-200"}`} />
                {/* Track name rows */}
                {[
                  { id: "CC", label: "CC · Text", color: "text-purple-400", trackId: "CC" },
                  { id: "V1", label: "V1 · Video", color: "text-indigo-400", trackId: "V1" },
                  { id: "V2", label: "V2 · FX", color: "text-amber-400", trackId: "V2" },
                  { id: "A1", label: "A1 · Voice", color: "text-emerald-400", trackId: "A1" },
                  { id: "A2", label: "A2 · BGM", color: "text-pink-400", trackId: "A2" },
                ].map((track) => (
                  <div
                    key={track.id}
                    className={`h-8 border-b flex items-center justify-between px-2 ${isDark ? "border-[rgba(255,255,255,0.04)]" : "border-slate-200"}`}
                  >
                    <span className={`text-[9px] font-extrabold font-mono ${track.color}`}>{track.label}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => toggleMuteTrack(track.trackId)}
                        className={`track-mute-btn ${mutedTracks.has(track.trackId) ? "bg-rose-600/30 text-rose-400" : `${isDark ? "bg-[rgba(255,255,255,0.05)] text-slate-500" : "bg-slate-200 text-slate-500"} hover:bg-rose-600/20 hover:text-rose-400`}`}
                        title={mutedTracks.has(track.trackId) ? "Unmute" : "Mute"}
                      >
                        {mutedTracks.has(track.trackId) ? "M" : "◐"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline Tracks Content */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={timelineScrollContainerRef}>
                <div
                  style={{ width: `${totalTimelineWidth + 40}px`, position: "relative", minHeight: "100%" }}
                  ref={timelineRef}
                  onClick={handleTimelineClick}
                  onMouseDown={(e) => {
                    setIsDraggingPlayhead(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    handleSeek(ratio * totalTimelineDuration);
                  }}
                  className="cursor-crosshair"
                >
                  {/* ─ RULER ─ */}
                  <div
                    className={`h-6 border-b sticky top-0 z-20 ${rulerBg} ${isDark ? "border-[rgba(255,255,255,0.05)]" : "border-slate-200"}`}
                    style={{ position: "relative" }}
                  >
                    {Array.from({ length: Math.ceil(totalTimelineDuration) + 1 }, (_, i) => {
                      const x = i * PX_PER_SEC;
                      const isMinor = i % 5 !== 0;
                      return (
                        <div
                          key={i}
                          style={{ position: "absolute", left: `${x}px`, top: 0, bottom: 0 }}
                          className="flex flex-col justify-end items-center"
                        >
                          <div className={`w-px ${isMinor ? "h-2 bg-slate-700" : "h-3.5 bg-indigo-500/50"}`} />
                          {!isMinor && (
                            <span className={`text-[8px] font-mono absolute top-0 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                              style={{ transform: "translateX(-50%)" }}>
                              {i}s
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {/* Sub-second ticks */}
                    {Array.from({ length: Math.ceil(totalTimelineDuration * 5) + 1 }, (_, i) => {
                      const x = (i / 5) * PX_PER_SEC;
                      return i % 5 === 0 ? null : (
                        <div key={`s${i}`} style={{ position: "absolute", left: `${x}px`, bottom: 0, width: "1px", height: "4px" }}
                          className={isDark ? "bg-slate-800" : "bg-slate-300"} />
                      );
                    })}
                  </div>

                  {/* ─ CC: Subtitle Chunks ─ */}
                  <div className={`h-8 border-b relative ${isDark ? "border-[rgba(255,255,255,0.04)]" : "border-slate-200"} ${isDark ? "bg-[rgba(124,58,237,0.04)]" : "bg-purple-50/50"}`}>
                    {subtitleChunks.map((chunk, idx) => (
                      <div
                        key={idx}
                        className={`timeline-clip timeline-clip-subtitle ${selectedTrackItem?.track === "CC" && selectedTrackItem?.index === idx ? "selected" : ""}`}
                        style={{ left: `${getClipLeft(chunk.start)}px`, width: `${getClipWidth(chunk.end - chunk.start)}px` }}
                        onClick={(e) => { e.stopPropagation(); setSelectedTrackItem({ track: "CC", index: idx }); }}
                      >
                        {chunk.text}
                      </div>
                    ))}
                  </div>

                  {/* ─ V1: Video Clips ─ */}
                  <div className={`h-8 border-b relative ${isDark ? "border-[rgba(255,255,255,0.04)]" : "border-slate-200"} ${isDark ? "bg-[rgba(99,102,241,0.04)]" : "bg-indigo-50/50"}`}>
                    {footages.map((item, idx) => {
                      const dur = getFootageDuration(idx);
                      const startSec = getFootageStart(idx);
                      const w = getClipWidth(dur);
                      return (
                        <div
                          key={idx}
                          className={`timeline-clip timeline-clip-video waveform-pattern relative group/clip ${selectedTrackItem?.track === "V1" && selectedTrackItem?.index === idx ? "selected border-indigo-400 ring-2 ring-indigo-500/50" : ""}`}
                          style={{ left: `${getClipLeft(startSec)}px`, width: `${w}px` }}
                          onClick={(e) => { e.stopPropagation(); setSelectedTrackItem({ track: "V1", index: idx }); }}
                        >
                          {/* Left Drag handle to widen / narrow THIS specific clip duration */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-3 bg-indigo-400/40 hover:bg-indigo-400 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-all flex items-center justify-center rounded-l z-20"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDragResizeTarget({
                                type: "footage",
                                index: idx,
                                handle: "left",
                                startX: e.clientX,
                                initialDuration: dur,
                              });
                            }}
                            title="Drag ke kiri/kanan untuk ubah durasi klip ini saja"
                          >
                            <div className="w-0.5 h-3 bg-white rounded-full" />
                          </div>

                          <span className="truncate px-3 font-bold text-[10px]">{item.file.name.replace(/\.[^/.]+$/, "")} ({dur}s)</span>

                          {/* Right Drag handle to widen / narrow THIS specific clip duration */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-3 bg-indigo-400/40 hover:bg-indigo-400 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-all flex items-center justify-center rounded-r z-20"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDragResizeTarget({
                                type: "footage",
                                index: idx,
                                handle: "right",
                                startX: e.clientX,
                                initialDuration: dur,
                              });
                            }}
                            title="Drag ke kiri/kanan untuk ubah durasi klip ini saja"
                          >
                            <div className="w-0.5 h-3 bg-white rounded-full" />
                          </div>
                        </div>
                      );
                    })}

                    {/* Automatic Ending Logo Cover Block */}
                    {endingLogo && (
                      <div
                        className="timeline-clip border border-amber-500/80 bg-amber-500/25 text-amber-300 text-[10px] font-extrabold flex items-center justify-between px-1 shadow-md z-10 cursor-pointer relative group/ending"
                        style={{ left: `${getClipLeft(mainContentDuration)}px`, width: `${getClipWidth(endingDuration)}px` }}
                        title={`Cover Akhiran Burjolevelup (${endingDuration}s)`}
                      >
                        {/* Left Drag Handle for Ending Cover */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2.5 bg-amber-400/50 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover/ending:opacity-100 transition-all flex items-center justify-center rounded-l z-20"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDragResizeTarget({
                              type: "ending",
                              index: 0,
                              handle: "left",
                              startX: e.clientX,
                              initialDuration: endingDuration,
                            });
                          }}
                          title="Drag untuk ubah durasi Akhiran Cover"
                        >
                          <div className="w-0.5 h-3 bg-white rounded-full" />
                        </div>

                        <div className="flex items-center gap-1 truncate px-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                          <span className="truncate">⭐ Akhiran ({endingDuration}s)</span>
                        </div>

                        {/* Right Drag Handle for Ending Cover */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2.5 bg-amber-400/50 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover/ending:opacity-100 transition-all flex items-center justify-center rounded-r z-20"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDragResizeTarget({
                              type: "ending",
                              index: 0,
                              handle: "right",
                              startX: e.clientX,
                              initialDuration: endingDuration,
                            });
                          }}
                          title="Drag untuk ubah durasi Akhiran Cover"
                        >
                          <div className="w-0.5 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─ V2: Transitions (FX Track) ─ */}
                  <div className={`h-8 border-b relative ${isDark ? "border-[rgba(255,255,255,0.04)]" : "border-slate-200"} ${isDark ? "bg-[rgba(245,158,11,0.03)]" : "bg-amber-50/50"}`}>
                    {transitions.map((t, idx) => {
                      const boundaryTime = getFootageStart(t.afterClipIndex + 1);
                      const transStart = boundaryTime - t.duration / 2;
                      return (
                        <div
                          key={idx}
                          className="timeline-clip timeline-clip-transition relative group/trans flex items-center justify-between px-1"
                          style={{ left: `${getClipLeft(Math.max(0, transStart))}px`, width: `${getClipWidth(t.duration)}px`, borderColor: t.color + "60" }}
                          onClick={(e) => { e.stopPropagation(); setSelectedTrackItem({ track: "V2", index: idx }); }}
                        >
                          {/* Left Drag Handle for Transition Duration */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2.5 bg-amber-400/60 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover/trans:opacity-100 transition-all flex items-center justify-center rounded-l z-20"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDragResizeTarget({
                                type: "transition",
                                index: idx,
                                handle: "left",
                                startX: e.clientX,
                                initialDuration: t.duration,
                              });
                            }}
                            title="Drag ke kiri/kanan untuk ubah durasi transisi ini"
                          >
                            <div className="w-0.5 h-2 bg-white rounded-full" />
                          </div>

                          <span className="truncate px-1.5 text-[9px] font-extrabold" style={{ color: t.color }}>{t.label} ({t.duration}s)</span>

                          {/* Right Drag Handle for Transition Duration */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2.5 bg-amber-400/60 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover/trans:opacity-100 transition-all flex items-center justify-center rounded-r z-20"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDragResizeTarget({
                                type: "transition",
                                index: idx,
                                handle: "right",
                                startX: e.clientX,
                                initialDuration: t.duration,
                              });
                            }}
                            title="Drag ke kiri/kanan untuk ubah durasi transisi ini"
                          >
                            <div className="w-0.5 h-2 bg-white rounded-full" />
                          </div>
                        </div>
                      );
                    })}

                    {/* Automatic Dissolve Transition to Ending Cover */}
                    {endingLogo && (
                      <div
                        className="timeline-clip border border-amber-300 bg-gradient-to-r from-amber-500/60 to-purple-600/60 text-amber-100 text-[9px] font-extrabold flex items-center justify-center shadow-lg shadow-amber-500/20 z-10 animate-pulse cursor-pointer"
                        style={{ left: `${getClipLeft(Math.max(0, mainContentDuration - 0.35))}px`, width: `${getClipWidth(0.7)}px` }}
                        title="Transisi Dissolve ke Akhiran Cover"
                      >
                        ✨ Dissolve (Akhiran)
                      </div>
                    )}
                  </div>

                  {/* ─ A1: Voice Over ─ */}
                  <div className={`h-8 border-b relative ${isDark ? "border-[rgba(255,255,255,0.04)]" : "border-slate-200"} ${isDark ? "bg-[rgba(5,150,105,0.04)]" : "bg-emerald-50/50"}`}>
                    {audioUrl && (
                      <div
                        className={`timeline-clip timeline-clip-voice waveform-pattern ${mutedTracks.has("A1") ? "opacity-40" : ""}`}
                        style={{ left: "0px", width: `${getClipWidth(audioDuration)}px` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Voice Over Zephyr ({audioDuration.toFixed(1)}s)
                      </div>
                    )}
                  </div>

                  {/* ─ A2: BGM ─ */}
                  <div className={`h-8 relative ${isDark ? "" : "bg-pink-50/50"}`}>
                    {bgm && (
                      <div
                        className={`timeline-clip timeline-clip-bgm waveform-pattern ${mutedTracks.has("A2") ? "opacity-40" : ""}`}
                        style={{ left: "0px", width: `${getClipWidth(totalTimelineDuration)}px` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {bgm.name.replace(/\.[^/.]+$/, "")}
                      </div>
                    )}
                  </div>

                  {/* ─ PLAYHEAD NEEDLE ─ */}
                  <div
                    className="playhead-needle"
                    style={{ left: `${getClipLeft(currentTime)}px` }}
                  >
                    <div
                      className="playhead-head"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsDraggingPlayhead(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden audio refs */}
      {audioUrl && (
        <audio ref={audioPreviewRef} src={audioUrl} />
      )}
      {bgmUrl && <audio ref={bgmAudioRef} src={bgmUrl} loop />}
    </main>
  );
}
