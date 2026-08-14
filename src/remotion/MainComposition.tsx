import React from "react";
import { Audio } from "remotion";
import { MainCompositionProps } from "./types";
import { VideoTracks } from "./components/VideoTracks";
import { OverlayTransitions } from "./components/OverlayTransitions";
import { SubtitleOverlay } from "./components/SubtitleOverlay";

export const MainComposition: React.FC<MainCompositionProps> = ({
  footages = [],
  transitions = [],
  subtitles = [],
  voiceOverUrl,
  bgmUrl,
  bgmVolume = 0.2,
  subtitleStyle = "plain-shadow",
  clipDuration = 3,
}) => {
  const fps = 60;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* 1. Base Video Sequence Track */}
      <VideoTracks footages={footages} defaultClipDuration={clipDuration} fps={fps} />

      {/* 2. Overlay Transitions Track */}
      <OverlayTransitions footages={footages} transitions={transitions} defaultClipDuration={clipDuration} fps={fps} />

      {/* 3. Subtitles Overlay Track */}
      <SubtitleOverlay subtitles={subtitles} fps={fps} subtitleStyle={subtitleStyle} />

      {/* 4. Voice Over Audio Track */}
      {voiceOverUrl && <Audio src={voiceOverUrl} volume={1.0} />}

      {/* 5. Background Music Audio Track */}
      {bgmUrl && <Audio src={bgmUrl} volume={bgmVolume} loop />}
    </div>
  );
};
