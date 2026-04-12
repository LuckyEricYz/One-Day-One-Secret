import { useEffect, useRef, useState } from "react";
import { clamp } from "../shared/time";

export default function ParticleSphere(props: {
  disabled: boolean;
  loading: boolean;
  onComplete: (duration: number, entropy: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pressing, setPressing] = useState(false);
  const startRef = useRef(0);
  const entropyRef = useRef(0);
  const progressParamRef = useRef(0);

  // 区分 Web 和 H5，实现特色动画差异
  const isWeb = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; angle: number; r: number }> = [];
    const numParticles = isWeb ? 220 : 120; // H5降低粒子数量
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 65;

    for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        particles.push({
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            angle: angle,
            r: r
        });
    }

    let mouseX = centerX;
    let mouseY = centerY;

    const handlePointerMove = (e: PointerEvent) => {
        if (!isWeb) return;
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    };

    if (isWeb) {
        canvas.addEventListener("pointermove", handlePointerMove);
    }

    const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const p = progressParamRef.current; 
        
        ctx.fillStyle = `rgba(47, 42, 36, ${0.4 + p * 0.6})`;

        particles.forEach(pt => {
            pt.angle += 0.015;
            const targetX = centerX + Math.cos(pt.angle) * pt.r;
            const targetY = centerY + Math.sin(pt.angle) * pt.r;

            let repelX = 0; let repelY = 0;
            if (isWeb && p === 0) {
               const dx = pt.x - mouseX;
               const dy = pt.y - mouseY;
               const dist = Math.sqrt(dx*dx + dy*dy);
               if (dist < 40 && dist > 0.1) {
                  repelX = (dx / dist) * 8;
                  repelY = (dy / dist) * 8;
               }
            }

            // 聚合成类似爻线的横纹带
            const bandWidth = 80;
            const bandY = centerY + (Math.sin(pt.angle * 5) * 15);
            let aggX = centerX + ((pt.angle % 1) - 0.5) * bandWidth;
            let aggY = bandY;
            
            if (p > 0) {
              pt.vx += (aggX - pt.x) * (0.05 * p);
              pt.vy += (aggY - pt.y) * (0.05 * p);
            } else {
              pt.vx += (targetX + repelX - pt.x) * 0.02;
              pt.vy += (targetY + repelY - pt.y) * 0.02;
            }

            pt.vx *= 0.92;
            pt.vy *= 0.92;
            pt.x += pt.vx;
            pt.y += pt.vy;

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, isWeb ? 1.5 : 2, 0, Math.PI * 2);
            ctx.fill();
        });

        rafId = requestAnimationFrame(render);
    };
    render();

    return () => {
        cancelAnimationFrame(rafId);
        if (isWeb) canvas.removeEventListener("pointermove", handlePointerMove);
    };
  }, [isWeb]);

  useEffect(() => {
     let raf: number;
     const tick = () => {
        if (pressing) {
            const passed = Math.max(0, performance.now() - startRef.current);
            progressParamRef.current = Math.min(passed / 2000, 1);
        } else {
            progressParamRef.current = Math.max(0, progressParamRef.current - 0.06);
        }
        raf = requestAnimationFrame(tick);
     };
     tick();
     return () => cancelAnimationFrame(raf);
  }, [pressing]);

  function finish(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setPressing(false);
    const elapsed = Math.round(clamp(performance.now() - startRef.current, 0, 30000));
    const completed = elapsed >= 2000;
    if (completed) {
      props.onComplete(elapsed, entropyRef.current);
    }
  }

  return (
    <button
      type="button"
      disabled={props.disabled}
      className={`relative flex h-[200px] w-[200px] flex-col items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgba(236,230,217,0.5)] shadow-[inset_0_4px_16px_rgba(0,0,0,0.06),0_8px_24px_rgba(47,42,36,0.08)] text-center transition-transform ${
        props.disabled ? "cursor-not-allowed opacity-55" : "active:scale-[0.96]"
      }`}
      onPointerDown={(event) => {
        if (props.disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        entropyRef.current = Math.round(((event.clientX + 7) * 13 + (event.clientY + 11) * 7) % 997);
        startRef.current = performance.now();
        setPressing(true);
        if (navigator.vibrate) navigator.vibrate(20);
      }}
      onPointerUp={finish}
      onPointerCancel={() => {
        setPressing(false);
      }}
    >
      <canvas ref={canvasRef} width={200} height={200} className="absolute inset-0 m-auto pointer-events-none" />
      
      {/* 视觉反馈文案 */}
      <div className="relative z-10 px-6 mt-20 pointer-events-none mix-blend-multiply">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--color-accent)]">
          {props.loading ? "感应中" : pressing ? "气聚成卦" : "长按汇流"}
        </p>
      </div>
    </button>
  );
}
