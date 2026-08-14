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

        // CSS Color grading presets
        let filterStyle = "contrast(1.1) saturate(1.22)";
        if (clip.colorGrade === "fast-viral") filterStyle = "contrast(1.14) saturate(1.28)";
        else if (clip.colorGrade === "cinematic-aesthetic") filterStyle = "contrast(1.15) brightness(0.98) saturate(1.08)";
        else if (clip.colorGrade === "brand-commercial") filterStyle = "contrast(1.08) saturate(1.16)";
        else if (clip.colorGrade === "soft-sweet") filterStyle = "brightness(1.03) saturate(1.12)";

        return (
          <Sequence key={index} from={startFrame} durationInFrames={durationFrames}>
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
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
