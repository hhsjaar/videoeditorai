/**
 * veoPricing.ts — Shared constants for AI video generation quality tiers.
 * Split out from veoQueue.ts so client components can import pricing/labels
 * without pulling in server-only deps (fs/promises, @google/genai).
 *
 * "kling" is a different PROVIDER (fal.ai, not Google) folded into the same
 * quality picker for a simpler UI — added as an alternative to Veo, not a
 * replacement, mainly to sidestep Veo's tight per-minute/per-day rate limits.
 */

export type VeoQuality = "lite" | "fast" | "standard" | "kling";

export const QUALITY_TO_MODEL: Record<VeoQuality, string> = {
  lite: "veo-3.1-lite-generate-preview",
  fast: "veo-3.1-fast-generate-preview",
  standard: "veo-3.1-generate-preview",
  kling: "fal-ai/kling-video/v2.5-turbo/pro",
};

// USD per second of generated video (720p tier). Veo: ai.google.dev/gemini-api/docs/pricing.
// Kling 2.5 Turbo Pro: fal.ai/pricing (fal.ai-hosted, not Google).
export const QUALITY_PRICE_PER_SEC: Record<VeoQuality, number> = {
  lite: 0.05,
  fast: 0.10,
  standard: 0.40,
  kling: 0.07,
};

export const QUALITY_LABELS: Record<VeoQuality, string> = {
  lite: "Veo Lite (termurah)",
  fast: "Veo Fast (lebih cepat)",
  standard: "Veo Standard (kualitas terbaik)",
  kling: "Kling 2.5 Turbo Pro (fal.ai, limit lebih longgar, VO via TTS terpisah)",
};

// Google's Veo needs a request-provider distinction so the queue knows which
// API to call and how to snap durations (4/6/8s vs Kling's 5/10s).
export function providerForQuality(quality: VeoQuality): "veo" | "kling" {
  return quality === "kling" ? "kling" : "veo";
}
