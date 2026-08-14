"use client";
import React, { useEffect, useRef } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { MainComposition } from "../remotion/MainComposition";
import { MainCompositionProps } from "../remotion/types";

interface PlayerProps {
  props: MainCompositionProps;
  durationInFrames: number;
  onFrameUpdate?: (frame: number) => void;
  seekToSec?: number | null;
}

export const RemotionPlayerWrapper: React.FC<PlayerProps> = ({
  props,
  durationInFrames,
  onFrameUpdate,
  seekToSec,
}) => {
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrameUpdate = (e: { detail: { frame: number } }) => {
      if (onFrameUpdate) {
        onFrameUpdate(e.detail.frame);
      }
    };

    player.addEventListener("frameupdate", handleFrameUpdate);
    return () => {
      player.removeEventListener("frameupdate", handleFrameUpdate);
    };
  }, [onFrameUpdate]);

  const lastSeekRef = useRef<number | null>(null);

  useEffect(() => {
    if (seekToSec !== undefined && seekToSec !== null && lastSeekRef.current !== seekToSec && playerRef.current) {
      lastSeekRef.current = seekToSec;
      const targetFrame = Math.round(seekToSec * 60);
      playerRef.current.seekTo(targetFrame);
    }
  }, [seekToSec]);

  // Global Spacebar Play / Pause toggle listener
  useEffect(() => {
    const handleGlobalSpace = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        const player = playerRef.current;
        if (!player) return;
        if (player.isPlaying()) {
          player.pause();
        } else {
          player.play();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalSpace);
    return () => {
      window.removeEventListener("keydown", handleGlobalSpace);
    };
  }, []);

  return (
    <Player
      ref={playerRef}
      component={MainComposition as any}
      inputProps={props as any}
      durationInFrames={Math.max(60, durationInFrames)}
      fps={60}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{
        width: "100%",
        height: "100%",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        borderRadius: "16px",
        overflow: "hidden",
        backgroundColor: "#060810",
      }}
      controls
      loop
    />
  );
};
