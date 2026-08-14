import React from "react";
import { useCurrentFrame } from "remotion";
import { SubtitleChunk } from "../types";

interface SubtitleOverlayProps {
  subtitles: SubtitleChunk[];
  fps: number;
  subtitleStyle?: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ subtitles, fps, subtitleStyle = "plain-shadow" }) => {
  const frame = useCurrentFrame();
  const currentTime = frame / fps;

  if (!subtitles || subtitles.length === 0) return null;

  const currentChunk = subtitles.find((c) => currentTime >= c.start && currentTime < c.end);
  if (!currentChunk) return null;

  // Subtitle styling presets
  let containerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "120px",
    left: "5%",
    right: "5%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    pointerEvents: "none",
  };

  let textStyle: React.CSSProperties = {
    fontSize: "28px",
    fontWeight: 800,
    textAlign: "center",
    padding: "8px 16px",
    borderRadius: "12px",
    lineHeight: 1.25,
    fontFamily: "Inter, system-ui, sans-serif",
  };

  if (subtitleStyle === "yellow") {
    textStyle = {
      ...textStyle,
      backgroundColor: "#facc15",
      color: "#000000",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    };
  } else if (subtitleStyle === "neon") {
    textStyle = {
      ...textStyle,
      backgroundColor: "#22d3ee",
      color: "#000000",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    };
  } else if (subtitleStyle === "box") {
    textStyle = {
      ...textStyle,
      backgroundColor: "rgba(0,0,0,0.85)",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.2)",
    };
  } else {
    // plain-shadow default
    textStyle = {
      ...textStyle,
      color: "#ffffff",
      textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.9)",
    };
  }

  return (
    <div style={containerStyle}>
      <div style={textStyle}>{currentChunk.text}</div>
    </div>
  );
};
