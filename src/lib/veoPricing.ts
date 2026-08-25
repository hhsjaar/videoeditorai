/**
 * veoPricing.ts — Shared constants for Veo quality tiers.
 * Split out from veoQueue.ts so client components can import pricing/labels
 * without pulling in server-only deps (fs/promises, @google/genai).
 */

export type VeoQuality = "lite" | "fast" | "standard";

export const QUALITY_TO_MODEL: Record<VeoQuality, string> = {
  lite: "veo-3.1-lite-generate-preview",
  fast: "veo-3.1-fast-generate-preview",
  standard: "veo-3.1-generate-preview",
};

// USD per second of generated video (720p tier), per ai.google.dev/gemini-api/docs/pricing.
export const QUALITY_PRICE_PER_SEC: Record<VeoQuality, number> = {
  lite: 0.05,
  fast: 0.10,
  standard: 0.40,
};

export const QUALITY_LABELS: Record<VeoQuality, string> = {
  lite: "Lite (termurah)",
  fast: "Fast (lebih cepat)",
  standard: "Standard (kualitas terbaik)",
};
