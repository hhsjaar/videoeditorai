import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { FootageItem, TransitionItem } from "../types";

interface OverlayTransitionsProps {
  footages: FootageItem[];
  transitions: TransitionItem[];
  defaultClipDuration: number;
  fps: number;
}

export const OverlayTransitions: React.FC<OverlayTransitionsProps> = ({
  footages,
  transitions,
  defaultClipDuration,
  fps,
}) => {
  const frame = useCurrentFrame();

  if (!footages || footages.length <= 1 || !transitions || transitions.length === 0) {
    return null;
  }

  // Calculate clip boundary timestamps in frames
  let accumulatedFrames = 0;
  const boundaries: { clipIndex: number; frame: number; transition?: TransitionItem }[] = [];

  for (let i = 0; i < footages.length - 1; i++) {
    const durSec = footages[i]?.duration || defaultClipDuration || 3;
    accumulatedFrames += Math.round(durSec * fps);
    const customT = transitions.find((t) => t.afterClipIndex === i) || transitions[i];
    boundaries.push({ clipIndex: i, frame: accumulatedFrames, transition: customT });
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
      {boundaries.map(({ clipIndex, frame: boundaryFrame, transition }) => {
        if (!transition || !transition.type) return null;

        const tDurSec = transition.duration || 0.8;
        const tDurFrames = Math.max(10, Math.round(tDurSec * fps));
        const halfDur = Math.round(tDurFrames / 2);
        const startFrame = boundaryFrame - halfDur;
        const endFrame = boundaryFrame + halfDur;

        if (frame < startFrame || frame > endFrame) return null;

        const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Bell curve opacity for light flares (peaks at middle of transition)
        const flareOpacity = Math.sin(progress * Math.PI);
        const type = transition.type;

        // 1. Light Leak & Film Burn: Warm golden / orange light streak sweeping horizontally
        if (type === "light-leak" || type === "film-burn") {
          const colorGradient =
            type === "film-burn"
              ? "linear-gradient(to right, transparent, rgba(249,115,22,0.85), rgba(239,68,68,0.7), transparent)"
              : "linear-gradient(to right, transparent, rgba(251,191,36,0.9), rgba(245,158,11,0.7), transparent)";
          const streakLeft = (progress - 0.25) * 130;

          return (
            <div key={clipIndex} style={{ position: "absolute", inset: 0, overflow: "hidden", mixBlendMode: "screen" }}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "35%",
                  left: `${streakLeft}%`,
                  background: colorGradient,
                  filter: "blur(12px)",
                  opacity: flareOpacity * 0.95,
                }}
              />
            </div>
          );
        }

        // 2. Flash White: Instant white flash
        if (type === "flash-white") {
          return (
            <div
              key={clipIndex}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#ffffff",
                opacity: flareOpacity * 0.95,
              }}
            />
          );
        }

        // 3. Fade Black & Slow Shutter: Dramatic black fade out/in
        if (type === "fade-black" || type === "slow-shutter") {
          return (
            <div
              key={clipIndex}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#000000",
                opacity: flareOpacity * 0.9,
              }}
            />
          );
        }

        // 4. Zoom Blur: Zoom scale + backdrop blur
        if (type === "zoom-blur") {
          const blurVal = flareOpacity * 12;
          return (
            <div
              key={clipIndex}
              style={{
                position: "absolute",
                inset: 0,
                backdropFilter: `blur(${blurVal}px)`,
                WebkitBackdropFilter: `blur(${blurVal}px)`,
                backgroundColor: "rgba(255,255,255,0.08)",
                opacity: flareOpacity * 0.7,
              }}
            />
          );
        }

        // 5. Glitch: Anamorphic RGB scanlines
        if (type === "glitch") {
          return (
            <div key={clipIndex} style={{ position: "absolute", inset: 0, overflow: "hidden", mixBlendMode: "screen" }}>
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const topPos = (idx / 6) * 100 + Math.sin(progress * Math.PI * 3 + idx) * 8;
                return (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: `${flareOpacity * 8}px`,
                      top: `${topPos}%`,
                      backgroundColor: idx % 2 === 0 ? "rgba(34,211,238,0.8)" : "rgba(244,63,94,0.8)",
                      opacity: flareOpacity * 0.85,
                    }}
                  />
                );
              })}
            </div>
          );
        }

        // 6. Iris Circle: Radial expanding/contracting clip-path mask
        if (type === "iris-circle") {
          const circleSize = progress < 0.5 ? (1 - progress * 2) * 150 : (progress - 0.5) * 2 * 150;
          return (
            <div
              key={clipIndex}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#000000",
                clipPath: `circle(${circleSize}% at 50% 50%)`,
                opacity: 1 - flareOpacity,
              }}
            />
          );
        }

        // 7. Wipe Horizontal & Wipe Fade: Horizontal wipe edge
        if (type === "wipe-horizontal" || type === "wipe-fade") {
          const wipePos = progress * 100;
          return (
            <div key={clipIndex} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: 0,
                  left: `${wipePos}%`,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "4px",
                  left: `${wipePos}%`,
                  backgroundColor: "rgba(255,255,255,0.8)",
                  boxShadow: "0 0 10px rgba(255,255,255,0.9)",
                }}
              />
            </div>
          );
        }

        // 8. Wipe Diagonal: Diagonal clip-path polygon
        if (type === "wipe-diagonal") {
          const p = progress * 130;
          return (
            <div
              key={clipIndex}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.3)",
                clipPath: `polygon(0 0, ${p}% 0, ${p - 25}% 100%, 0 100%)`,
                opacity: 0.7,
              }}
            />
          );
        }

        // 9. Passerby: Sliding anamorphic light bar
        if (type === "passerby") {
          return (
            <div key={clipIndex} style={{ position: "absolute", inset: 0, overflow: "hidden", mixBlendMode: "screen" }}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "8px",
                  left: `${progress * 100}%`,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  boxShadow: "0 0 25px rgba(99,102,241,1)",
                  opacity: flareOpacity,
                }}
              />
            </div>
          );
        }

        // 10. Lens Flare: Anamorphic cyan lens flare sphere
        if (type === "lens-flare") {
          const flareX = (progress - 0.1) * 120;
          return (
            <div key={clipIndex} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
              <div
                style={{
                  position: "absolute",
                  width: "200px",
                  height: "200px",
                  borderRadius: "50%",
                  top: "40%",
                  left: `${flareX}%`,
                  background: "radial-gradient(circle, rgba(56,189,248,0.9) 0%, rgba(99,102,241,0.4) 60%, transparent 100%)",
                  filter: "blur(16px)",
                  opacity: flareOpacity * 0.85,
                }}
              />
            </div>
          );
        }

        // 11. Vignette & Color Split: Color glow border
        if (type === "vignette" || type === "color-split") {
          const shadowColor = type === "color-split" ? "255, 50, 80" : "120, 50, 220";
          return (
            <div
              key={clipIndex}
              style={{
                position: "absolute",
                inset: 0,
                boxShadow: `inset 0 0 100px rgba(${shadowColor}, ${flareOpacity * 0.7})`,
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
};
