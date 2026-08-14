import React from "react";
import { Sequence, OffthreadVideo } from "remotion";
import { FootageItem } from "../types";

interface VideoTracksProps {
  footages: FootageItem[];
  defaultClipDuration: number;
  fps: number;
}

export const VideoTracks: React.FC<VideoTracksProps> = ({ footages, defaultClipDuration, fps }) => {
  if (!footages || footages.length === 0) return null;

  let currentFrameAcc = 0;

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#060810" }}>
      {footages.map((clip, index) => {
        const durationSec = clip.duration || defaultClipDuration || 3;
        const durationFrames = Math.max(1, Math.round(durationSec * fps));
        const startFrame = currentFrameAcc;
        currentFrameAcc += durationFrames;

        // Bold, distinct CSS Color grading presets
        let filterStyle = "contrast(1.15) saturate(1.25)";
        if (clip.colorGrade === "fast-viral") {
          filterStyle = "contrast(1.22) saturate(1.45) brightness(1.04)";
        } else if (clip.colorGrade === "cinematic-aesthetic") {
          filterStyle = "contrast(1.28) saturate(1.12) hue-rotate(-12deg) brightness(0.95)";
        } else if (clip.colorGrade === "moody-lowsat") {
          filterStyle = "saturate(0.55) contrast(1.22) brightness(0.92)";
        } else if (clip.colorGrade === "vintage-gold") {
          filterStyle = "sepia(0.35) contrast(1.12) saturate(1.25) brightness(1.02)";
        } else if (clip.colorGrade === "brand-commercial") {
          filterStyle = "brightness(1.06) contrast(1.1) saturate(1.18)";
        } else if (clip.colorGrade === "soft-sweet") {
          filterStyle = "brightness(1.05) saturate(1.15) contrast(0.98)";
        }

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
              <OffthreadVideo
                src={clip.url}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          </Sequence>
        );
      })}
    </div>
  );
};
