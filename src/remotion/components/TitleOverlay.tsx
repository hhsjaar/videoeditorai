import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TitleOverlayConfig } from "../types";
import { resolveTitleFontFamily } from "../fonts";

interface TitleOverlayProps {
  titleConfig?: TitleOverlayConfig;
  fps: number;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ titleConfig, fps }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  if (!titleConfig || !titleConfig.enabled || (!titleConfig.line1 && !titleConfig.line2)) {
    return null;
  }

  const startSec = titleConfig.startSec ?? 0;
  const durationSec = titleConfig.durationSec ?? 5;
  const startFrame = Math.round(startSec * fps);
  const endFrame = Math.round((startSec + durationSec) * fps);

  // If outside timing bounds, do not render
  if (frame < startFrame || frame > endFrame) {
    return null;
  }

  const localFrame = frame - startFrame;
  const totalFrames = Math.max(1, endFrame - startFrame);

  // Responsive scale base relative to 1080p
  const scaleFactor = width / 1080;
  const baseFontSize = (titleConfig.fontSize || 84) * scaleFactor;
  const positionXPercent = titleConfig.positionX ?? 50;
  const positionYPercent = titleConfig.positionY ?? 40;
  const userScale = titleConfig.scale ?? 1;

  // Animation durations
  const inDurationFrames = Math.min(Math.round(0.75 * fps), Math.floor(totalFrames / 2));
  const outDurationFrames = Math.min(Math.round(0.6 * fps), Math.floor(totalFrames / 2));
  const outStartFrame = totalFrames - outDurationFrames;

  const animIn = titleConfig.animationIn || "spring-pop";
  const animOut = titleConfig.animationOut || "blur-dissolve";

  // ── IN ANIMATION SPRINGS ───────────────────────────────────────────────────
  const springIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.75 },
  });

  const springPunchy = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 190, mass: 0.6 },
  });

  const springLine2 = spring({
    frame: Math.max(0, localFrame - 5),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.75 },
  });

  const springSub = spring({
    frame: Math.max(0, localFrame - 9),
    fps,
    config: { damping: 13, stiffness: 130, mass: 0.7 },
  });

  // ── OUT ANIMATION PROGRESS ─────────────────────────────────────────────────
  const isExiting = localFrame >= outStartFrame;
  const exitProgress = isExiting
    ? interpolate(localFrame, [outStartFrame, totalFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Calculate master transform & opacity
  let containerOpacity = 1;
  let containerTransform = "scale(1)";
  let containerFilter = "none";
  let containerClipPath: string | undefined = undefined;

  // ── ENTRANCE CALCULATIONS ──────────────────────────────────────────────────
  if (localFrame < inDurationFrames) {
    const inProgress = Math.min(1, localFrame / inDurationFrames);

    switch (animIn) {
      case "spring-pop": {
        const scale = interpolate(springIn, [0, 1], [0.65, 1]);
        const blur = interpolate(inProgress, [0, 0.6, 1], [14, 2, 0]);
        const brightness = interpolate(inProgress, [0, 0.3, 1], [1.6, 1.2, 1.0]);
        containerOpacity = Math.min(1, inProgress * 1.8);
        containerTransform = `scale(${scale})`;
        containerFilter = blur > 0.2 ? `blur(${blur}px) brightness(${brightness})` : `brightness(${brightness})`;
        break;
      }
      case "kinetic-zoom": {
        // High impact zoom slam from 1.45x down to 1.0x with rapid settle
        const scale = interpolate(springPunchy, [0, 1], [1.45, 1.0]);
        const blur = interpolate(inProgress, [0, 0.5, 1], [16, 0, 0]);
        containerOpacity = Math.min(1, inProgress * 2.2);
        containerTransform = `scale(${scale})`;
        containerFilter = blur > 0.2 ? `blur(${blur}px)` : "none";
        break;
      }
      case "slide-up": {
        const translateY = interpolate(springIn, [0, 1], [90 * scaleFactor, 0]);
        const scale = interpolate(springIn, [0, 1], [0.92, 1.0]);
        containerOpacity = Math.min(1, inProgress * 1.8);
        containerTransform = `translateY(${translateY}px) scale(${scale})`;
        break;
      }
      case "mask-reveal": {
        // Cinematic clip-path curtain wipe
        const clipPercent = interpolate(springIn, [0, 1], [100, 0]);
        const translateY = interpolate(springIn, [0, 1], [25 * scaleFactor, 0]);
        containerOpacity = Math.min(1, inProgress * 2);
        containerTransform = `translateY(${translateY}px)`;
        containerClipPath = `inset(0 0 ${clipPercent}% 0)`;
        break;
      }
      case "neon-flash": {
        // Cyber neon strobe flash & brightness burst
        const scale = interpolate(springPunchy, [0, 1], [0.85, 1.0]);
        const flash = Math.sin(inProgress * Math.PI * 4) * 0.5 + 0.5; // Strobe flicker
        const brightness = inProgress < 0.4 ? 1.8 + flash * 0.8 : 1.0;
        containerOpacity = Math.min(1, inProgress * 3);
        containerTransform = `scale(${scale})`;
        containerFilter = `brightness(${brightness}) drop-shadow(0 0 ${20 * scaleFactor}px rgba(245, 158, 11, 0.9))`;
        break;
      }
      case "flip-drop": {
        // 3D Perspective Flip Drop
        const rotateX = interpolate(springIn, [0, 1], [-70, 0]);
        const translateY = interpolate(springIn, [0, 1], [-45 * scaleFactor, 0]);
        containerOpacity = Math.min(1, inProgress * 1.6);
        containerTransform = `perspective(800px) rotateX(${rotateX}deg) translateY(${translateY}px)`;
        break;
      }
      case "blur-fade": {
        const blur = interpolate(inProgress, [0, 1], [24, 0]);
        const scale = interpolate(inProgress, [0, 1], [1.08, 1.0]);
        containerOpacity = inProgress;
        containerTransform = `scale(${scale})`;
        containerFilter = blur > 0.2 ? `blur(${blur}px)` : "none";
        break;
      }
      case "stagger-cascade":
      default: {
        containerOpacity = Math.min(1, inProgress * 2);
        break;
      }
    }
  }

  // ── EXIT CALCULATIONS ──────────────────────────────────────────────────────
  if (isExiting) {
    switch (animOut) {
      case "blur-dissolve": {
        const blur = interpolate(exitProgress, [0, 1], [0, 18]);
        const scale = interpolate(exitProgress, [0, 1], [1, 1.08]);
        containerOpacity = 1 - exitProgress;
        containerTransform = `scale(${scale})`;
        containerFilter = `blur(${blur}px)`;
        break;
      }
      case "slide-up-out": {
        const translateY = interpolate(exitProgress, [0, 1], [0, -75 * scaleFactor]);
        const scale = interpolate(exitProgress, [0, 1], [1, 0.95]);
        containerOpacity = 1 - Math.pow(exitProgress, 1.5);
        containerTransform = `translateY(${translateY}px) scale(${scale})`;
        break;
      }
      case "slide-down-out": {
        const translateY = interpolate(exitProgress, [0, 1], [0, 70 * scaleFactor]);
        const scale = interpolate(exitProgress, [0, 1], [1, 0.94]);
        containerOpacity = 1 - Math.pow(exitProgress, 1.5);
        containerTransform = `translateY(${translateY}px) scale(${scale})`;
        break;
      }
      case "scale-fade": {
        const scale = interpolate(exitProgress, [0, 1], [1, 0.72]);
        const blur = interpolate(exitProgress, [0, 1], [0, 10]);
        containerOpacity = 1 - exitProgress;
        containerTransform = `scale(${scale})`;
        containerFilter = blur > 0.5 ? `blur(${blur}px)` : "none";
        break;
      }
      case "zoom-explode": {
        const scale = interpolate(exitProgress, [0, 1], [1, 1.38]);
        const brightness = interpolate(exitProgress, [0, 0.6, 1], [1.0, 1.9, 2.5]);
        containerOpacity = 1 - Math.pow(exitProgress, 1.8);
        containerTransform = `scale(${scale})`;
        containerFilter = `brightness(${brightness}) drop-shadow(0 0 ${15 * scaleFactor}px rgba(255,255,255,0.8))`;
        break;
      }
      case "flip-out": {
        const rotateX = interpolate(exitProgress, [0, 1], [0, 65]);
        const translateY = interpolate(exitProgress, [0, 1], [0, -35 * scaleFactor]);
        containerOpacity = 1 - exitProgress;
        containerTransform = `perspective(800px) rotateX(${rotateX}deg) translateY(${translateY}px)`;
        break;
      }
    }
  }

  // ── TYPOGRAPHY STYLING ─────────────────────────────────────────────────────
  const isStaggerMode = animIn === "stagger-cascade" && localFrame < inDurationFrames;

  // titleConfig.fontFamily (a registry id, see src/remotion/fonts.ts) takes priority.
  // Falls back to the legacy "chic-luxury style = Playfair Display" behavior for titles
  // saved before font selection existed.
  const resolvedFontFamily = titleConfig.fontFamily
    ? resolveTitleFontFamily(titleConfig.fontFamily)
    : titleConfig.style === "chic-luxury"
      ? resolveTitleFontFamily("playfair-display")
      : resolveTitleFontFamily("inter");

  const line1Style: React.CSSProperties = {
    fontFamily: resolvedFontFamily,
    fontWeight: 900,
    fontSize: `${baseFontSize}px`,
    lineHeight: 1.05,
    letterSpacing: titleConfig.style === "bold-impact" ? "0.04em" : "-0.03em",
    textTransform: titleConfig.style === "bold-impact" ? "uppercase" : "none",
    color: titleConfig.fontColor || "#FFFFFF",
    textShadow:
      "0 3px 20px rgba(0,0,0,0.9), 0 1px 5px rgba(0,0,0,0.95), 0 0 50px rgba(0,0,0,0.5)",
    transform: isStaggerMode
      ? `translateY(${interpolate(springIn, [0, 1], [35 * scaleFactor, 0])}px) scale(${interpolate(springIn, [0, 1], [0.88, 1])})`
      : undefined,
    opacity: isStaggerMode ? interpolate(springIn, [0, 0.4, 1], [0, 0.85, 1]) : 1,
    transition: "color 0.2s ease",
  };

  const isItalic = titleConfig.italicLine2 ?? true;
  const line2Style: React.CSSProperties = {
    fontFamily: resolvedFontFamily,
    fontWeight: isItalic ? 800 : 700,
    fontStyle: isItalic ? "italic" : "normal",
    fontSize: `${baseFontSize * 1.02}px`,
    lineHeight: 1.05,
    letterSpacing: isItalic ? "-0.01em" : "-0.03em",
    color: titleConfig.fontColor || "#FFFFFF",
    textShadow:
      "0 3px 20px rgba(0,0,0,0.9), 0 1px 5px rgba(0,0,0,0.95), 0 0 50px rgba(0,0,0,0.5)",
    marginTop: `${4 * scaleFactor}px`,
    transform: isStaggerMode
      ? `translateY(${interpolate(springLine2, [0, 1], [40 * scaleFactor, 0])}px) scale(${interpolate(springLine2, [0, 1], [0.85, 1])})`
      : undefined,
    opacity: isStaggerMode ? interpolate(springLine2, [0, 0.4, 1], [0, 0.85, 1]) : 1,
    transition: "color 0.2s ease",
  };

  const subtitleFontSize = baseFontSize * 0.38;
  const subtitleStyle: React.CSSProperties = {
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: 700,
    fontSize: `${subtitleFontSize}px`,
    letterSpacing: "0.02em",
    lineHeight: 1.2,
    color: "rgba(255, 255, 255, 0.95)",
    marginTop: `${12 * scaleFactor}px`,
    textShadow: "0 2px 10px rgba(0,0,0,0.85)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: isStaggerMode
      ? `translateY(${interpolate(springSub, [0, 1], [30 * scaleFactor, 0])}px) scale(${interpolate(springSub, [0, 1], [0.8, 1])})`
      : undefined,
    opacity: isStaggerMode ? interpolate(springSub, [0, 0.4, 1], [0, 0.85, 1]) : 1,
  };

  const isPill = titleConfig.style === "pill-badge";

  return (
    <div
      style={{
        position: "absolute",
        top: `${positionYPercent}%`,
        left: `${positionXPercent}%`,
        maxWidth: "90%",
        // Center-anchor at (positionX%, positionY%), then apply the user's manual
        // drag-resize scale — kept as its own transform layer so it never fights
        // with the in/out animation transform below.
        transform: `translate(-50%, -50%) scale(${userScale})`,
        zIndex: 45,
      }}
    >
      <div
        style={{
          transform: containerTransform,
          opacity: containerOpacity,
          filter: containerFilter,
          clipPath: containerClipPath,
          WebkitClipPath: containerClipPath,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          pointerEvents: "none",
          userSelect: "none",
          willChange: "transform, opacity, filter, clip-path",
        }}
      >
      {/* LINE 1 */}
      {titleConfig.line1 && <div style={line1Style}>{titleConfig.line1}</div>}

      {/* LINE 2 (Italic / Accent) */}
      {titleConfig.line2 && <div style={line2Style}>{titleConfig.line2}</div>}

      {/* LINE 3 (Subtitle / Handle / Tag) */}
      {titleConfig.subtitle && (
        <div
          style={{
            ...subtitleStyle,
            ...(isPill
              ? {
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  padding: `${6 * scaleFactor}px ${18 * scaleFactor}px`,
                  borderRadius: `${9999 * scaleFactor}px`,
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                }
              : {}),
          }}
        >
          {titleConfig.subtitle}
        </div>
      )}
      </div>
    </div>
  );
};
