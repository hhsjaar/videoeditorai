import React from "react";
import { Composition } from "remotion";
import { MainComposition } from "./MainComposition";
import { MainCompositionProps } from "./types";

export const RemotionRoot: React.FC = () => {
  const defaultProps: MainCompositionProps = {
    footages: [],
    transitions: [],
    subtitles: [],
    clipDuration: 3,
    bgmVolume: 0.2,
    subtitleStyle: "plain-shadow",
  };

  return (
    <>
      <Composition
        id="MainComposition"
        component={MainComposition as any}
        durationInFrames={600}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={defaultProps as any}
        calculateMetadata={({ props }) => {
          const p = props as any;
          const fps = 60;
          let totalDurationSec = 0;
          if (p.footages && p.footages.length > 0) {
            totalDurationSec = p.footages.reduce(
              (acc: number, item: any) => acc + (item.duration || p.clipDuration || 3),
              0
            );
          } else {
            totalDurationSec = 10;
          }
          const durationInFrames = Math.max(60, Math.round(totalDurationSec * fps));
          return {
            durationInFrames,
          };
        }}
      />
    </>
  );
};
