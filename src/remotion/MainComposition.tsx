import React from "react";
import { Audio, useVideoConfig } from "remotion";
import { MainCompositionProps } from "./types";
import { VideoTracks } from "./components/VideoTracks";
import { OverlayTransitions } from "./components/OverlayTransitions";
import { SubtitleOverlay } from "./components/SubtitleOverlay";
import { resolveMediaSrc } from "./utils";

export const MainComposition: React.FC<MainCompositionProps> = ({
  footages = [],
  transitions = [],
  subtitles = [],
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* 1. Base Video Sequence Track */}
      <VideoTracks footages={footages} defaultClipDuration={clipDuration} fps={fps} />

      {/* 2. Overlay Transitions Track */}
      <OverlayTransitions footages={footages} transitions={transitions} defaultClipDuration={clipDuration} fps={fps} />

      {/* 3. Subtitles Overlay Track */}
      <SubtitleOverlay subtitles={subtitles} fps={fps} subtitleStyle={subtitleStyle} subtitleFontSize={subtitleFontSize} subtitleBottomPos={subtitleBottomPos} />

      {/* 4. Voice Over Audio Track */}
      {resolvedVo && <Audio src={resolvedVo} volume={1.0} />}

      {/* 5. Background Music Audio Track */}
      {resolvedBgm && <Audio src={resolvedBgm} volume={bgmVolume} loop />}
    </div>
  );
};
