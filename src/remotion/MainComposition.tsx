import React from "react";
import { Audio, useVideoConfig } from "remotion";
import { MainCompositionProps } from "./types";
import { VideoTracks } from "./components/VideoTracks";
import { OverlayTransitions } from "./components/OverlayTransitions";
import { SubtitleOverlay } from "./components/SubtitleOverlay";
import { OverlayLayer } from "./components/OverlayLayer";
import { resolveMediaSrc } from "./utils";

export const MainComposition: React.FC<MainCompositionProps> = ({
  footages = [],
  transitions = [],
  subtitles = [],
  overlays = [],
  voiceOverUrl,
  bgmUrl,
  bgmVolume = 0.2,
  subtitleStyle = "plain-shadow",
  subtitleFontSize = 56,
  subtitleBottomPos = 220,
  clipDuration = 3,
}) => {
  const { fps } = useVideoConfig();

  const resolvedVo = resolveMediaSrc(voiceOverUrl);
  const resolvedBgm = resolveMediaSrc(bgmUrl);

  // Calculate total duration for overlay timing reference
  const totalDurationSec = footages.reduce((s, f) => s + (f.duration || clipDuration), 0);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* 1. Base Video Sequence Track */}
      <VideoTracks footages={footages} defaultClipDuration={clipDuration} fps={fps} />

      {/* 2. Overlay Transitions Track */}
      <OverlayTransitions footages={footages} transitions={transitions} defaultClipDuration={clipDuration} fps={fps} />

      {/* 3. Overlay Layer (PiP, watermark, logo, etc.) */}
      <OverlayLayer overlays={overlays} fps={fps} totalDurationSec={totalDurationSec} />

      {/* 4. Subtitles Overlay Track */}
      <SubtitleOverlay subtitles={subtitles} fps={fps} subtitleStyle={subtitleStyle} subtitleFontSize={subtitleFontSize} subtitleBottomPos={subtitleBottomPos} />

      {/* 5. Voice Over Audio Track */}
      {resolvedVo && <Audio src={resolvedVo} volume={1.0} />}

      {/* 6. Background Music Audio Track */}
      {resolvedBgm && <Audio src={resolvedBgm} volume={bgmVolume} loop />}
    </div>
  );
};
