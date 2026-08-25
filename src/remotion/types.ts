export interface FootageItem {
  url: string;
  duration: number; // in seconds
  startFromSec?: number; // start offset in seconds for center-cut trimming
  colorGrade?: string;
  isImage?: boolean;
}

export interface TransitionItem {
  type: string;
  afterClipIndex: number;
  duration: number; // in seconds
}

export interface SubtitleChunk {
  text: string;
  start: number; // in seconds
  end: number; // in seconds
}

export interface OverlayItem {
  url: string;          // filename (resolved to http URL by mini server)
  position: "topleft" | "topright" | "bottomleft" | "bottomright" | "center" | "custom";
  sizePercent: number;  // 10-80% of video width
  opacity: number;      // 0.1 - 1.0
  startSec: number;     // when overlay appears (0 = from start)
  endSec: number;       // when overlay disappears (-1 = till end)
  isVideo: boolean;
  x?: number;           // custom x% (0-100), used when position=custom
  y?: number;           // custom y% (0-100), used when position=custom
}

export interface TitleOverlayConfig {
  enabled: boolean;
  line1: string;          // e.g. "Renovasi"
  line2?: string;         // e.g. "Coffee Bar"
  subtitle?: string;      // e.g. "burjolevelup"
  style?: "reel-aesthetic" | "bold-impact" | "chic-luxury" | "neon-glow" | "pill-badge";
  italicLine2?: boolean;  // default true
  fontFamily?: string;    // font registry id, see src/remotion/fonts.ts (default "inter")
  fontSize?: number;      // base size (default 80 for 1080p base)
  fontColor?: string;     // default #FFFFFF
  positionX?: number;     // horizontal percentage from left, center-anchored (default 50%)
  positionY?: number;     // vertical percentage from top, center-anchored (default 42%)
  scale?: number;         // user-set size multiplier via drag-resize handle (default 1.0)
  startSec?: number;      // default 0.0
  durationSec?: number;   // default 5
  animationIn?:
    | "spring-pop"
    | "kinetic-zoom"
    | "slide-up"
    | "stagger-cascade"
    | "mask-reveal"
    | "neon-flash"
    | "flip-drop"
    | "blur-fade";
  animationOut?:
    | "blur-dissolve"
    | "slide-up-out"
    | "slide-down-out"
    | "scale-fade"
    | "zoom-explode"
    | "flip-out";
}

export interface MainCompositionProps {
  footages: FootageItem[];
  transitions: TransitionItem[];
  subtitles: SubtitleChunk[];
  overlays?: OverlayItem[];
  titleConfig?: TitleOverlayConfig;
  voiceOverUrl?: string;
  bgmUrl?: string;
  bgmVolume?: number;
  subtitleStyle?: string;
  subtitleFontSize?: number;
  subtitleBottomPos?: number;
  clipDuration?: number;
}

