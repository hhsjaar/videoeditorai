import React from "react";
import { Sequence, OffthreadVideo, Img } from "remotion";
import { FootageItem } from "../types";
import { resolveMediaSrc } from "../utils";

interface VideoTracksProps {
  footages: FootageItem[];
  defaultClipDuration: number;
  fps: number;
}

export const VideoTracks: React.FC<VideoTracksProps> = ({ footages, defaultClipDuration, fps }) => {
  if (!footages || footages.length === 0) return null;

  // Pre-compute exact integer frame boundaries to prevent cumulative rounding drift
  const frameBoundaries: { startFrame: number; durationFrames: number }[] = [];
  {
    let acc = 0;
    for (const clip of footages) {
      const durationSec = clip.duration || defaultClipDuration || 3;
      const exactFrames = durationSec * fps;
      const durationFrames = Math.max(1, Math.round(exactFrames)); // round to nearest whole frame
      frameBoundaries.push({ startFrame: acc, durationFrames });
      acc += durationFrames; // accumulate EXACT integer frames, zero drift
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#060810" }}>
      {footages.map((clip, index) => {
        const durationSec = clip.duration || defaultClipDuration || 3;
        const { startFrame, durationFrames } = frameBoundaries[index];

        // 10 Curated Color Filter Presets
        let filterStyle = "none";
        if (clip.colorGrade === "clean-commercial") {
          filterStyle = "brightness(1.05) contrast(1.04) saturate(1.05)";
        } else if (clip.colorGrade === "warm-commercial") {
          filterStyle = "sepia(0.12) saturate(1.08) contrast(1.02) hue-rotate(-5deg)";
        } else if (clip.colorGrade === "modern-cinematic") {
          filterStyle = "contrast(1.15) saturate(0.95) hue-rotate(5deg)";
        } else if (clip.colorGrade === "soft-teal") {
          filterStyle = "contrast(1.05) saturate(1.02) hue-rotate(15deg) sepia(0.08)";
        } else if (clip.colorGrade === "muted-luxury") {
          filterStyle = "saturate(0.8) contrast(1.1) brightness(0.98)";
        } else if (clip.colorGrade === "warm-clean") {
          filterStyle = "sepia(0.08) brightness(1.03) contrast(1.02)";
        } else if (clip.colorGrade === "cinematic-neutral") {
          filterStyle = "contrast(1.1) saturate(0.92) brightness(0.99)";
        } else if (clip.colorGrade === "pastel-commercial") {
          filterStyle = "brightness(1.06) saturate(0.85) contrast(0.95)";
        } else if (clip.colorGrade === "urban-clean") {
          filterStyle = "contrast(1.12) hue-rotate(-8deg) saturate(1.02)";
        } else if (clip.colorGrade === "editorial-commercial") {
          filterStyle = "contrast(1.08) brightness(1.04) saturate(1.1)";
        } else if (clip.colorGrade === "fast-viral") {
          filterStyle = "contrast(1.22) saturate(1.45) brightness(1.04)";
        } else if (clip.colorGrade === "cinematic-aesthetic") {
          filterStyle = "contrast(1.28) saturate(1.12) hue-rotate(-12deg) brightness(0.95)";
        }

        const resolvedUrl = resolveMediaSrc(clip.url) || clip.url;
        // Detect images by explicit isImage flag OR file extension / data URL
        const isImage = clip.isImage ?? (
          Boolean(clip.url) && (
            /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)($|\?)/i.test(clip.url) ||
            clip.url.startsWith("data:image/") ||
            clip.url.includes("ending") ||
            clip.url.includes("akhiran")
          )
        );
        const startFromFrame = clip.startFromSec && clip.startFromSec > 0 ? Math.round(clip.startFromSec * fps) : undefined;

        return (
          <Sequence key={`${index}_${clip.url}`} from={startFrame} durationInFrames={durationFrames} layout="none">
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                overflow: "hidden",
                filter: filterStyle,
              }}
            >
              {isImage ? (
                <Img
                  src={resolvedUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <OffthreadVideo
                  src={resolvedUrl}
                  {...(startFromFrame ? { startFrom: startFromFrame } : {})}
                  volume={0}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )}
            </div>
          </Sequence>
        );
      })}
    </div>
  );
};
