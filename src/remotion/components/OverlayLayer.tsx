import React from "react";
import { Sequence, OffthreadVideo, Img, useVideoConfig } from "remotion";
import { OverlayItem } from "../types";
import { resolveMediaSrc } from "../utils";

interface OverlayLayerProps {
  overlays: OverlayItem[];
  fps: number;
  totalDurationSec: number;
}

function getPositionStyle(
  pos: OverlayItem["position"],
  sizePercent: number,
  x?: number,
  y?: number
): React.CSSProperties {
  const size = `${sizePercent}%`;
  const padding = "3%";

  const base: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: "auto",
    objectFit: "contain",
    zIndex: 10,
  };

  if (pos === "custom" && x !== undefined && y !== undefined) {
    return { ...base, left: `${x}%`, top: `${y}%`, transform: "none" };
  }

  switch (pos) {
    case "topleft":
      return { ...base, top: padding, left: padding };
    case "topright":
      return { ...base, top: padding, right: padding };
    case "bottomleft":
      return { ...base, bottom: padding, left: padding };
    case "bottomright":
      return { ...base, bottom: padding, right: padding };
    case "center":
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    default:
      return { ...base, top: padding, right: padding };
  }
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({
  overlays,
  fps,
  totalDurationSec,
}) => {
  const { durationInFrames } = useVideoConfig();

  if (!overlays || overlays.length === 0) return null;

  return (
    <>
      {overlays.map((overlay, idx) => {
        const resolvedUrl = resolveMediaSrc(overlay.url);
        if (!resolvedUrl) return null;

        const startFrame = Math.round(overlay.startSec * fps);
        const endFrame =
          overlay.endSec < 0
            ? durationInFrames
            : Math.min(durationInFrames, Math.round(overlay.endSec * fps));
        const durFrames = Math.max(1, endFrame - startFrame);

        const posStyle = getPositionStyle(
          overlay.position,
          overlay.sizePercent,
          overlay.x,
          overlay.y
        );

        const wrapStyle: React.CSSProperties = {
          ...posStyle,
          opacity: overlay.opacity,
          // Drop shadow for better visibility on any background
          filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.5))",
        };

        return (
          <Sequence
            key={`overlay_${idx}`}
            from={startFrame}
            durationInFrames={durFrames}
            layout="none"
          >
            {overlay.isVideo ? (
              <OffthreadVideo
                src={resolvedUrl}
                volume={0}
                style={wrapStyle}
              />
            ) : (
              <Img
                src={resolvedUrl}
                style={wrapStyle}
              />
            )}
          </Sequence>
        );
      })}
    </>
  );
};
