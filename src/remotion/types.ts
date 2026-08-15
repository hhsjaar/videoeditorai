export interface FootageItem {
  url: string;
  duration: number; // in seconds
  startFromSec?: number; // start offset in seconds for center-cut trimming
  colorGrade?: string;
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

export interface MainCompositionProps {
  footages: FootageItem[];
  transitions: TransitionItem[];
  subtitles: SubtitleChunk[];
  voiceOverUrl?: string;
  bgmUrl?: string;
  bgmVolume?: number;
  subtitleStyle?: string;
  subtitleFontSize?: number;
  subtitleBottomPos?: number;
  clipDuration?: number;
}
