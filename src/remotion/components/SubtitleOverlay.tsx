import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleChunk } from "../types";

interface SubtitleOverlayProps {
  subtitles: SubtitleChunk[];
  fps: number;
  subtitleStyle?: string;
  subtitleFontSize?: number;
  subtitleBottomPos?: number;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  subtitles,
  fps,
  subtitleStyle = "plain-shadow",
  subtitleFontSize = 44,
  subtitleBottomPos = 220,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const currentTime = frame / fps;

  if (!subtitles || subtitles.length === 0) return null;

  const currentChunk = subtitles.find((c) => currentTime >= c.start && currentTime < c.end);
  if (!currentChunk) return null;

  // Scale font size and bottom position dynamically based on target composition dimensions (base: 1080x1920)
  const scaledFontSize = Math.round(((subtitleFontSize || 44) / 1080) * width);
  const scaledBottomPos = Math.round(((subtitleBottomPos || 220) / 1920) * height);

  // Subtitle styling presets
  let containerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: `${scaledBottomPos}px`,
    left: "5%",
    right: "5%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    pointerEvents: "none",
  };

  let textStyle: React.CSSProperties = {
    fontSize: `${scaledFontSize}px`,
    fontWeight: 400, // Regular Light font weight
    textAlign: "center",
    padding: "6px 14px",
    borderRadius: "12px",
    lineHeight: 1.25,
    fontFamily: "Inter, system-ui, sans-serif",
    maxWidth: "90%",
    wordBreak: "break-word",
  };

  if (subtitleStyle === "yellow" || subtitleStyle === "yellow-highlight") {
    textStyle = {
      ...textStyle,
      fontWeight: 400,
      backgroundColor: "#facc15",
      color: "#000000",
      padding: "6px 14px",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    };
  } else if (subtitleStyle === "neon" || subtitleStyle === "neon-glow") {
    textStyle = {
      ...textStyle,
      fontWeight: 400,
      backgroundColor: "#22d3ee",
      color: "#000000",
      padding: "6px 14px",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    };
  } else if (subtitleStyle === "bold-outline") {
    textStyle = {
      ...textStyle,
      fontWeight: 500,
      color: "#ffffff",
      textShadow: "-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 4px 12px rgba(0,0,0,0.9)",
    };
  } else if (subtitleStyle === "box" || subtitleStyle === "minimalist") {
    textStyle = {
      ...textStyle,
      fontWeight: 400,
      backgroundColor: "rgba(0,0,0,0.85)",
      color: "#ffffff",
      padding: "5px 12px",
      border: "1px solid rgba(255,255,255,0.2)",
    };
  } else {
    // plain-shadow default
    textStyle = {
      ...textStyle,
      fontWeight: 400,
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
