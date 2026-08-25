// Curated color-grade presets. Each preset layers three things on top of the
// raw clip: a CSS `filter` (tone/contrast/saturation), a tinted gradient overlay
// composited with a CSS blend mode (split-toning — the actual "trendy cinematic"
// look, not achievable with `filter` alone), and a vignette for depth/focus.
export interface ColorGradePreset {
  filter: string;
  overlay?: {
    background: string;
    blendMode: React.CSSProperties["mixBlendMode"];
    opacity: number;
  };
  vignetteStrength?: number; // 0-1, darkens the edges
}

import type React from "react";

export const COLOR_GRADE_PRESETS: Record<string, ColorGradePreset> = {
  "clean-commercial": {
    filter: "brightness(1.08) contrast(1.07) saturate(1.08)",
    overlay: {
      background: "radial-gradient(circle at 50% 20%, rgba(255,255,255,0.5), rgba(255,255,255,0) 65%)",
      blendMode: "screen",
      opacity: 0.08,
    },
    vignetteStrength: 0.1,
  },
  "warm-commercial": {
    filter: "brightness(1.05) contrast(1.06) saturate(1.14) sepia(0.06)",
    overlay: {
      background: "linear-gradient(135deg, rgba(255,196,120,0.9) 0%, rgba(255,196,120,0) 55%)",
      blendMode: "soft-light",
      opacity: 0.22,
    },
    vignetteStrength: 0.16,
  },
  "modern-cinematic": {
    // Classic blockbuster teal-shadow / orange-highlight split tone.
    filter: "contrast(1.22) saturate(0.92) brightness(0.97)",
    overlay: {
      background:
        "linear-gradient(135deg, rgba(255,140,60,0.55) 0%, rgba(255,140,60,0) 40%, rgba(20,140,150,0) 60%, rgba(20,140,150,0.55) 100%)",
      blendMode: "overlay",
      opacity: 0.3,
    },
    vignetteStrength: 0.28,
  },
  "soft-teal": {
    filter: "contrast(1.08) saturate(1.06) brightness(1.0)",
    overlay: {
      background: "radial-gradient(circle at 50% 50%, rgba(20,150,160,0) 40%, rgba(20,150,160,0.5) 100%)",
      blendMode: "soft-light",
      opacity: 0.2,
    },
    vignetteStrength: 0.14,
  },
  "muted-luxury": {
    // Desaturated, deep-contrast "arthouse film" look.
    filter: "saturate(0.7) contrast(1.2) brightness(0.94)",
    overlay: {
      background: "linear-gradient(180deg, rgba(30,32,40,0) 40%, rgba(15,16,22,0.6) 100%)",
      blendMode: "multiply",
      opacity: 0.35,
    },
    vignetteStrength: 0.32,
  },
  "warm-clean": {
    filter: "sepia(0.1) brightness(1.06) contrast(1.05) saturate(1.06)",
    overlay: {
      background: "radial-gradient(circle at 50% 30%, rgba(255,220,180,0.6), rgba(255,220,180,0) 60%)",
      blendMode: "screen",
      opacity: 0.12,
    },
    vignetteStrength: 0.08,
  },
  "cinematic-neutral": {
    filter: "contrast(1.2) saturate(0.9) brightness(0.96)",
    overlay: {
      background: "linear-gradient(180deg, rgba(10,15,25,0) 55%, rgba(8,12,22,0.65) 100%)",
      blendMode: "multiply",
      opacity: 0.28,
    },
    vignetteStrength: 0.26,
  },
  "pastel-commercial": {
    // Airy, lifted-blacks Y2K/dreamy look.
    filter: "brightness(1.12) saturate(0.72) contrast(0.9)",
    overlay: {
      background:
        "linear-gradient(135deg, rgba(255,200,230,0.5) 0%, rgba(255,200,230,0) 45%, rgba(190,210,255,0) 55%, rgba(190,210,255,0.5) 100%)",
      blendMode: "soft-light",
      opacity: 0.3,
    },
    vignetteStrength: 0.06,
  },
  "urban-clean": {
    // Cool steel-blue street/commercial look.
    filter: "contrast(1.18) hue-rotate(-6deg) saturate(1.02) brightness(0.98)",
    overlay: {
      background: "linear-gradient(180deg, rgba(30,60,90,0.35) 0%, rgba(30,60,90,0) 45%)",
      blendMode: "overlay",
      opacity: 0.3,
    },
    vignetteStrength: 0.22,
  },
  "editorial-commercial": {
    filter: "contrast(1.14) brightness(1.05) saturate(1.16)",
    overlay: {
      background:
        "linear-gradient(120deg, rgba(230,140,200,0.4) 0%, rgba(230,140,200,0) 45%, rgba(255,190,120,0) 55%, rgba(255,190,120,0.4) 100%)",
      blendMode: "soft-light",
      opacity: 0.2,
    },
    vignetteStrength: 0.14,
  },
  "fast-viral": {
    // Punchy, saturated short-form/TikTok look.
    filter: "contrast(1.32) saturate(1.55) brightness(1.06)",
    overlay: {
      background: "radial-gradient(circle at 50% 25%, rgba(255,230,180,0.5), rgba(255,230,180,0) 60%)",
      blendMode: "screen",
      opacity: 0.14,
    },
    vignetteStrength: 0.12,
  },
  "cinematic-aesthetic": {
    // Moody teal-shadow / warm-highlight with a heavier vignette.
    filter: "contrast(1.34) saturate(1.08) brightness(0.92)",
    overlay: {
      background:
        "linear-gradient(160deg, rgba(255,170,90,0.5) 0%, rgba(255,170,90,0) 40%, rgba(15,110,120,0) 60%, rgba(15,110,120,0.6) 100%)",
      blendMode: "overlay",
      opacity: 0.34,
    },
    vignetteStrength: 0.4,
  },
};

export function getColorGradePreset(id: string | undefined): ColorGradePreset | null {
  if (!id) return null;
  return COLOR_GRADE_PRESETS[id] ?? null;
}
