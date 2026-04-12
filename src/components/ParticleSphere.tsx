import { useEffect, useRef, useState } from "react";
import { clamp } from "../shared/time";

export default function ParticleSphere(props: {
  disabled: boolean;
  loading: boolean;
  onPressingChange?: (pressing: boolean) => void;
  onComplete: (duration: number, entropy: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pressing, setPressing] = useState(false);
  const startRef = useRef(0);
  const entropyRef = useRef(0);
  const progressParamRef = useRef(0);

  // 区分 Web 和 H5，实现特色动画差异
  const isWeb = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;


  // 炫酷粒子效果绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; angle: number; r: number; speed: number; size: number; color: string }> = [];
    const numParticles = isWeb ? 160 : 100;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 65;
    
    // 调色盘：墨黑、印泥红、金线
    const palette = ["rgba(47, 42, 36, 0.7)", "rgba(176, 58, 46, 0.8)", "rgba(199, 168, 106, 0.9)"];

    for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        particles.push({
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r,
            vx: 0,
            vy: 0,
            angle: angle,
            r: r,
            speed: 0.008 + Math.random() * 0.015,
            size: Math.random() * 2 + 0.5,
            color: palette[Math.floor(Math.random() * palette.length)]
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
        
        ctx.shadowBlur = p * 15;
        ctx.shadowColor = "rgba(176, 58, 46, 0.6)";

        // 按压时：绘制星象星座连线网络
        if (p > 0.05) {
            ctx.strokeStyle = `rgba(176, 58, 46, ${p * 0.4})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const connectThreshold = 800 * p;
            for(let i = 0; i < particles.length; i += 2) {
              for(let j = i + 1; j < particles.length; j += 2) {
                 const dx = particles[i].x - particles[j].x;
                 const dy = particles[i].y - particles[j].y;
                 if (dx*dx + dy*dy < connectThreshold) {
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                 }
              }
            }
            ctx.stroke();
        }

        particles.forEach(pt => {
            pt.angle += pt.speed;
            const targetX = centerX + Math.cos(pt.angle) * pt.r;
            const targetY = centerY + Math.sin(pt.angle) * pt.r;

            let repelX = 0; let repelY = 0;
            if (isWeb && p === 0) {
               const dx = pt.x - mouseX;
               const dy = pt.y - mouseY;
               const dist = Math.sqrt(dx*dx + dy*dy);
               if (dist < 45 && dist > 0.1) {
                  repelX = (dx / dist) * 12;
                  repelY = (dy / dist) * 12;
               }
            }

            // 按压时向中心急剧旋转吸附，呈现能量球
            const aggRadius = pt.r * (1 - p * 0.7);
            const aggAngle = pt.angle + p * 8;
            let aggX = centerX + Math.cos(aggAngle) * aggRadius;
            let aggY = centerY + Math.sin(aggAngle) * aggRadius;
            
            if (p > 0) {
              pt.vx += (aggX - pt.x) * (0.06 * p);
              pt.vy += (aggY - pt.y) * (0.06 * p);
            } else {
              pt.vx += (targetX + repelX - pt.x) * 0.03;
              pt.vy += (targetY + repelY - pt.y) * 0.03;
            }

            pt.vx *= 0.9;
            pt.vy *= 0.9;
            pt.x += pt.vx;
            pt.y += pt.vy;

            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, isWeb ? pt.size : pt.size * 1.2, 0, Math.PI * 2);
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
            progressParamRef.current = Math.max(0, progressParamRef.current - 0.08);
        }
        raf = requestAnimationFrame(tick);
     };
     tick();
     return () => cancelAnimationFrame(raf);
  }, [pressing]);

  function finish(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setPressing(false);
    props.onPressingChange?.(false);
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
      className={`relative flex h-[220px] w-[220px] flex-col items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgba(236,230,217,0.3)] shadow-[inset_0_4px_24px_rgba(47,42,36,0.06),0_12px_32px_rgba(176,58,46,0.12)] text-center transition-all ${
        props.disabled ? "cursor-not-allowed opacity-55" : "active:scale-[0.94]"
      }`}
      onPointerDown={(event) => {
        if (props.disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        entropyRef.current = Math.round(((event.clientX + 7) * 13 + (event.clientY + 11) * 7) % 997);
        startRef.current = performance.now();
        setPressing(true);
        props.onPressingChange?.(true);
        if (navigator.vibrate) navigator.vibrate(20);
      }}
      onPointerUp={finish}
      onPointerCancel={() => {
        setPressing(false);
        props.onPressingChange?.(false);
      }}
    >
      <canvas ref={canvasRef} width={220} height={220} className="absolute inset-0 m-auto pointer-events-none mix-blend-multiply" />
      
      {/* 增强型视觉反馈文案，增加了发光效果 */}
      <div className="relative z-10 px-6 mt-24 pointer-events-none">
        <p className={`text-sm font-bold tracking-[0.2em] transition-colors duration-300 ${
            pressing ? "text-[var(--color-accent)] drop-shadow-[0_0_8px_rgba(176,58,46,0.6)]" : "text-[var(--color-muted)]"
        }`}>
          {props.loading ? "天机推演中..." : pressing ? "注入生理能量" : "长按汇流"}
        </p>
      </div>
    </button>
  );
}
