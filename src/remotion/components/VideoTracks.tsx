import React from "react";
import { Sequence, OffthreadVideo, Img } from "remotion";
import { FootageItem } from "../types";
import { resolveMediaSrc } from "../utils";
import { getColorGradePreset } from "../colorGrades";

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

        const gradePreset = getColorGradePreset(clip.colorGrade);
        const filterStyle = gradePreset?.filter ?? "none";

        const resolvedUrl = resolveMediaSrc(clip.url) || clip.url;
        // Detect images by explicit isImage flag OR file extension / data URL
        const isImage = Boolean(
          clip.isImage ||
          (clip.url && (
            /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)($|\?)/i.test(clip.url) ||
            clip.url.startsWith("data:image/") ||
            clip.url.includes("ending") ||
            clip.url.includes("akhiran")
          ))
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

            {/* Split-tone tint overlay (composited via blend mode, sits above the filtered media) */}
            {gradePreset?.overlay && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: gradePreset.overlay.background,
                  mixBlendMode: gradePreset.overlay.blendMode,
                  opacity: gradePreset.overlay.opacity,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Vignette for depth/focus */}
            {gradePreset?.vignetteStrength ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${gradePreset.vignetteStrength}) 100%)`,
                  pointerEvents: "none",
                }}
              />
            ) : null}
          </Sequence>
        );
      })}
    </div>
  );
};
