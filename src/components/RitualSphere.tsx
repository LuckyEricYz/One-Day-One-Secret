import { useEffect, useRef, useState } from "react";

import { buildPreviewCue, getHexagramContext } from "../shared/ritual.js";
import { clamp } from "../shared/time.js";
import type { HexagramContext, Mood } from "../types.js";

type ParticleSeed = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  wobble: number;
  lineIndex: number;
  lineOffset: number;
};

export type RitualActivation = {
  pressDurationMs: number;
  touchEntropy: number;
  timestamp: number;
  hexagram: HexagramContext;
  previewCue: string;
  interaction: "click" | "press";
};

type RitualSphereProps = {
  mood: Mood;
  platform: "web" | "h5";
  disabled?: boolean;
  reducedMotion?: boolean;
  activation: RitualActivation | null;
  onActivate: (activation: RitualActivation) => void;
};

function createParticleSeeds(count: number): ParticleSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: (Math.PI * 2 * index) / count,
    radius: 0.44 + Math.random() * 0.42,
    speed: 0.12 + Math.random() * 0.38,
    size: 1.2 + Math.random() * 2.6,
    wobble: 0.7 + Math.random() * 1.3,
    lineIndex: index % 6,
    lineOffset: Math.random() * 2 - 1
  }));
}

function getLineTarget(
  width: number,
  height: number,
  lineIndex: number,
  lineOffset: number
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const spacing = height * 0.08;
  const top = centerY - spacing * 2.5;
  const y = top + lineIndex * spacing;
  const segmentHalf = width * 0.19;
  const gap = width * 0.07;
  const solid = lineIndex % 3 !== 1;

  if (solid) {
    return {
      x: centerX + lineOffset * segmentHalf,
      y
    };
  }

  const onRight = lineOffset > 0;
  return {
    x: centerX + (onRight ? gap : -gap) + lineOffset * segmentHalf * 0.48,
    y
  };
}

export function RitualSphere({
  mood,
  platform,
  disabled = false,
  reducedMotion = false,
  activation,
  onActivate
}: RitualSphereProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ParticleSeed[]>([]);
  const frameRef = useRef<number | null>(null);
  const pressingRef = useRef(false);
  const activatedRef = useRef(false);
  const holdStartedAtRef = useRef(0);
  const holdProgressRef = useRef(0);
  const activationProgressRef = useRef(0);
  const hoverRef = useRef({ x: 0, y: 0, strength: 0 });
  const pointerRef = useRef({ x: 0, y: 0 });
  const pressVisualRef = useRef(0);
  const desktopPressInProgressRef = useRef(false);
  const desktopPressStartedAtRef = useRef(0);
  const desktopReleaseTimeoutRef = useRef<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const [hint, setHint] = useState("");

  const particleCount = reducedMotion ? 48 : platform === "web" ? 180 : 108;

  useEffect(() => {
    particlesRef.current = createParticleSeeds(particleCount);
  }, [particleCount]);

  useEffect(() => {
    if (!activation) {
      activatedRef.current = false;
      holdProgressRef.current = 0;
      activationProgressRef.current = 0;
      desktopPressInProgressRef.current = false;
      setPressing(false);
      setHint("");
    }
  }, [activation]);

  useEffect(() => {
    return () => {
      if (desktopReleaseTimeoutRef.current !== null) {
        window.clearTimeout(desktopReleaseTimeoutRef.current);
        desktopReleaseTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const drawingCanvas = canvas;
    const ctx = context;

    function draw(now: number) {
      const rect = drawingCanvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (
        drawingCanvas.width !== Math.round(rect.width * dpr) ||
        drawingCanvas.height !== Math.round(rect.height * dpr)
      ) {
        drawingCanvas.width = Math.round(rect.width * dpr);
        drawingCanvas.height = Math.round(rect.height * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.28;
      const targetActivation = activation ? 1 : 0;
      const nextActivation = activationProgressRef.current + (targetActivation - activationProgressRef.current) * 0.1;
      activationProgressRef.current = clamp(nextActivation, 0, 1);
      const pressTarget = pressing ? 1 : 0;
      pressVisualRef.current += (pressTarget - pressVisualRef.current) * 0.18;
      const pressVisual = pressVisualRef.current;

      if (platform === "h5" && pressingRef.current && !activation && !disabled) {
        const elapsed = now - holdStartedAtRef.current;
        holdProgressRef.current = clamp(elapsed / 2000, 0, 1);
        if (elapsed >= 2000 && !activatedRef.current) {
          activatedRef.current = true;
          setPressing(false);
          setHint("卦象已显，继续补录");
          const timestamp = Date.now();
          const pressDurationMs = Math.round(clamp(elapsed, 2000, 30000));
          const touchEntropy = Math.round(
            ((pointerRef.current.x + 13) * 17 + (pointerRef.current.y + 29) * 7) % 997
          );
          const hexagram = getHexagramContext(pressDurationMs, timestamp, touchEntropy);
          const previewCue = buildPreviewCue(hexagram, mood);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(15);
          }
          onActivate({
            pressDurationMs,
            touchEntropy,
            timestamp,
            hexagram,
            previewCue,
            interaction: "press"
          });
        }
      } else if (!pressingRef.current) {
        holdProgressRef.current *= 0.88;
      }

      const holdProgress = Math.max(holdProgressRef.current, platform === "web" ? pressVisual * 0.72 : 0);
      const hover = hoverRef.current;
      const orbitStrength = reducedMotion ? 0.2 : platform === "web" ? 1 : 0.45;

      ctx.fillStyle = "rgba(246, 234, 214, 0.55)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.72, 0, Math.PI * 2);
      ctx.fill();

      const coreGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.15,
        centerX,
        centerY,
        radius * 1.25
      );
      coreGradient.addColorStop(0, "rgba(182, 72, 50, 0.15)");
      coreGradient.addColorStop(0.45, "rgba(158, 124, 72, 0.12)");
      coreGradient.addColorStop(1, "rgba(244, 236, 221, 0)");
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.28 + holdProgress * 8 + pressVisual * 10, 0, Math.PI * 2);
      ctx.fill();

      if (platform === "web") {
        ctx.strokeStyle = `rgba(182, 72, 50, ${0.08 + pressVisual * 0.42})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * (1.35 + pressVisual * 0.08), 0, Math.PI * 2);
        ctx.stroke();
      }

      if (platform === "h5") {
        ctx.strokeStyle = "rgba(77, 59, 42, 0.16)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(182, 72, 50, 0.72)";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY,
          radius * 1.4,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * holdProgress
        );
        ctx.stroke();
      }

      particlesRef.current.forEach((particle, index) => {
        const orbitAngle =
          particle.angle +
          now * 0.00018 * particle.speed * orbitStrength +
          hover.x * 0.0008 * hover.strength;
        const wobble = Math.sin(now * 0.0012 * particle.wobble + index) * radius * 0.08;
        const orbitRadius =
          radius * particle.radius +
          wobble -
          activationProgressRef.current * radius * 0.23 +
          holdProgress * radius * 0.08 -
          pressVisual * radius * 0.06;
        const orbitX =
          centerX +
          Math.cos(orbitAngle) * orbitRadius +
          hover.x * hover.strength * 0.12;
        const orbitY =
          centerY +
          Math.sin(orbitAngle + hover.y * 0.001) * orbitRadius +
          hover.y * hover.strength * 0.12;
        const target = getLineTarget(rect.width, rect.height, particle.lineIndex, particle.lineOffset);
        const x = orbitX + (target.x - orbitX) * activationProgressRef.current;
        const y = orbitY + (target.y - orbitY) * activationProgressRef.current;
        const alpha = 0.24 + holdProgress * 0.3 + activationProgressRef.current * 0.42 + pressVisual * 0.16;

        ctx.fillStyle =
          particle.lineIndex % 2 === 0
            ? `rgba(28, 23, 18, ${alpha})`
            : `rgba(182, 72, 50, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (activationProgressRef.current > 0.24) {
        const guideAlpha = clamp((activationProgressRef.current - 0.24) / 0.76, 0, 1);
        ctx.strokeStyle = `rgba(28, 23, 18, ${0.18 + guideAlpha * 0.46})`;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";

        for (let lineIndex = 0; lineIndex < 6; lineIndex += 1) {
          const solid = lineIndex % 3 !== 1;
          const { y } = getLineTarget(rect.width, rect.height, lineIndex, 0);

          if (solid) {
            ctx.beginPath();
            ctx.moveTo(centerX - rect.width * 0.17, y);
            ctx.lineTo(centerX + rect.width * 0.17, y);
            ctx.stroke();
            continue;
          }

          ctx.beginPath();
          ctx.moveTo(centerX - rect.width * 0.17, y);
          ctx.lineTo(centerX - rect.width * 0.05, y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(centerX + rect.width * 0.05, y);
          ctx.lineTo(centerX + rect.width * 0.17, y);
          ctx.stroke();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [activation, disabled, mood, onActivate, platform, reducedMotion]);

  function activateFromPoint(clientX: number, clientY: number) {
    if (disabled || activation || activatedRef.current) {
      return;
    }

    desktopPressInProgressRef.current = false;
    const timestamp = Date.now();
    const pressDurationMs = 2000;
    const touchEntropy = Math.round(((clientX + 13) * 17 + (clientY + 29) * 7) % 997);
    const hexagram = getHexagramContext(pressDurationMs, timestamp, touchEntropy);
    const previewCue = buildPreviewCue(hexagram, mood);
    activatedRef.current = true;
    setHint("卦象已显，继续补录");

    onActivate({
      pressDurationMs,
      touchEntropy,
      timestamp,
      hexagram,
      previewCue,
      interaction: platform === "web" ? "click" : "press"
    });
  }

  function startDesktopPress(clientX: number, clientY: number) {
    if (disabled || activation) {
      return;
    }

    if (desktopReleaseTimeoutRef.current !== null) {
      window.clearTimeout(desktopReleaseTimeoutRef.current);
      desktopReleaseTimeoutRef.current = null;
    }

    desktopPressInProgressRef.current = true;
    pointerRef.current = { x: clientX, y: clientY };
    desktopPressStartedAtRef.current = performance.now();
    pressingRef.current = false;
    activatedRef.current = false;
    holdProgressRef.current = 0.18;
    setPressing(true);
    setHint("松开鼠标，卦象落纸");
  }

  function endDesktopPress(clientX: number, clientY: number) {
    if (!pressing && !activatedRef.current) {
      return;
    }

    pointerRef.current = { x: clientX, y: clientY };
    const elapsed = performance.now() - desktopPressStartedAtRef.current;
    const minimumVisualFeedbackMs = 140;
    const remaining = Math.max(0, minimumVisualFeedbackMs - elapsed);
    const finalizeActivation = () => {
      desktopReleaseTimeoutRef.current = null;
      desktopPressInProgressRef.current = false;
      setPressing(false);
      activateFromPoint(clientX, clientY);
    };

    if (remaining > 0) {
      desktopReleaseTimeoutRef.current = window.setTimeout(finalizeActivation, remaining);
      return;
    }

    finalizeActivation();
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className={`ritual-orb relative flex aspect-square w-full max-w-[430px] items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-line)] bg-[radial-gradient(circle_at_center,rgba(182,72,50,0.08),rgba(248,242,231,0.92))] transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : pressing
            ? "scale-[0.982] shadow-[0_28px_90px_rgba(146,51,35,0.24)]"
            : "hover:-translate-y-0.5"
      }`}
      onClick={(event) => {
        if (platform !== "web") {
          return;
        }

        if (desktopPressInProgressRef.current || desktopReleaseTimeoutRef.current !== null) {
          return;
        }

        activateFromPoint(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (platform !== "web") {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const rect = buttonRef.current?.getBoundingClientRect();
          activateFromPoint(
            rect ? rect.left + rect.width / 2 : 0,
            rect ? rect.top + rect.height / 2 : 0
          );
        }
      }}
      onPointerDown={(event) => {
        if (disabled || activation) {
          return;
        }

        if (platform === "web") {
          startDesktopPress(event.clientX, event.clientY);
          return;
        }

        pointerRef.current = { x: event.clientX, y: event.clientY };
        setPressing(true);
        setHint("");
        pressingRef.current = true;
        holdStartedAtRef.current = performance.now();
        holdProgressRef.current = 0;
        activatedRef.current = false;
      }}
      onPointerMove={(event) => {
        if (platform === "web") {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (!rect) {
            return;
          }

          hoverRef.current = {
            x: event.clientX - rect.left - rect.width / 2,
            y: event.clientY - rect.top - rect.height / 2,
            strength: 1
          };
        } else if (pressingRef.current) {
          pointerRef.current = { x: event.clientX, y: event.clientY };
        }
      }}
      onPointerLeave={() => {
        hoverRef.current = { x: 0, y: 0, strength: 0 };
        if (platform === "web") {
          if (desktopReleaseTimeoutRef.current !== null) {
            window.clearTimeout(desktopReleaseTimeoutRef.current);
            desktopReleaseTimeoutRef.current = null;
          }
          desktopPressInProgressRef.current = false;
          setPressing(false);
          setHint("");
          return;
        }

        if (pressingRef.current && !activation) {
          pressingRef.current = false;
          setPressing(false);
          holdProgressRef.current = 0;
        }
      }}
      onPointerUp={() => {
        if (platform === "web") {
          endDesktopPress(pointerRef.current.x, pointerRef.current.y);
          return;
        }

        pressingRef.current = false;
        setPressing(false);
        if (!activation && holdProgressRef.current < 1) {
          setHint("再静心一会儿");
        }
      }}
      onPointerCancel={() => {
        pressingRef.current = false;
        setPressing(false);
        holdProgressRef.current = 0;
        if (platform === "web") {
          if (desktopReleaseTimeoutRef.current !== null) {
            window.clearTimeout(desktopReleaseTimeoutRef.current);
            desktopReleaseTimeoutRef.current = null;
          }
          desktopPressInProgressRef.current = false;
          setHint("");
        }
      }}
      onMouseDown={(event) => {
        if (platform !== "web") {
          return;
        }

        if (typeof window !== "undefined" && "PointerEvent" in window) {
          return;
        }

        startDesktopPress(event.clientX, event.clientY);
      }}
      onMouseUp={(event) => {
        if (platform !== "web") {
          return;
        }

        if (typeof window !== "undefined" && "PointerEvent" in window) {
          return;
        }

        endDesktopPress(event.clientX, event.clientY);
      }}
      aria-label={platform === "web" ? "点击粒子球显现卦象" : "长按粒子球显现卦象"}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none relative z-10 flex flex-col items-center px-8 text-center">
        <div className="ritual-orb__seal">
          {activation ? "卦" : pressing ? "凝" : platform === "web" ? "天" : "机"}
        </div>
        <p className="mt-4 text-sm uppercase tracking-[0.42em] text-[color:var(--color-muted)]">
          {activation ? "Revealed" : platform === "web" ? "Press And Reveal" : "Hold To Reveal"}
        </p>
        <p
          className={`mt-3 max-w-[12rem] text-base leading-7 ${
            pressing ? "text-[color:var(--color-vermillion)]" : "text-[color:var(--color-ink)]"
          }`}
        >
          {activation
            ? "卦线已经落纸"
            : platform === "web"
              ? pressing
                ? "松开鼠标，让纸面显出一卦"
                : "按下流动粒子球，让混沌成形"
              : pressing
                ? "保持呼吸，等待卦象显现"
                : "长按至少 2 秒，让粒子缓缓成卦"}
        </p>
        {hint ? <p className="mt-3 text-sm text-[color:var(--color-vermillion)]">{hint}</p> : null}
      </div>
    </button>
  );
}
