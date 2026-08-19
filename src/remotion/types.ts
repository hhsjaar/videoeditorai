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

export interface MainCompositionProps {
  footages: FootageItem[];
  transitions: TransitionItem[];
  subtitles: SubtitleChunk[];
  overlays?: OverlayItem[];
  voiceOverUrl?: string;
  bgmUrl?: string;
  bgmVolume?: number;
  subtitleStyle?: string;
  subtitleFontSize?: number;
  subtitleBottomPos?: number;
  clipDuration?: number;
}
