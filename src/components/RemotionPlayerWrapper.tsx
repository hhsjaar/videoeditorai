"use client";
import React from "react";
import { Player } from "@remotion/player";
import { MainComposition } from "../remotion/MainComposition";
import { MainCompositionProps } from "../remotion/types";

interface PlayerProps {
  props: MainCompositionProps;
  durationInFrames: number;
}

export const RemotionPlayerWrapper: React.FC<PlayerProps> = ({ props, durationInFrames }) => {
  return (
    <Player
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
