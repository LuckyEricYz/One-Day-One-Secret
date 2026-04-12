import { forwardRef } from "react";
import { motion } from "framer-motion";
import { formatDateTime } from "../shared/time";
import type { Mood, TianjiData } from "../types";

export const TianjiCard = forwardRef<HTMLDivElement, {
  mood: Mood;
  result: TianjiData;
  isSavingImage: boolean;
  onSaveImage: () => void;
  onRegenerate: () => void;
  onOpenHistory: () => void;
}>(function TianjiCard(props, ref) {
  return (
    <div className="flex h-full flex-col">
      <motion.div
        ref={ref}
        className="relative rounded-sm bg-[var(--color-surface)] p-8 shadow-[0_12px_40px_rgba(47,42,36,0.12)] overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* 古风宣纸暗纹边框 */}
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply border-[4px] border-[var(--color-border)] m-3 opacity-60" />
        <div className="absolute inset-0 pointer-events-none border border-[var(--color-border)] m-[14px] opacity-40" />

        <div className="relative z-10 flex items-start justify-between">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-[var(--color-accent)] inline-block transform rotate-45 opacity-80" />
                 <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-muted)] font-bold">
                   {props.result.meta.solarTermName}
                 </p>
             </div>
             <h2 className="mt-4 text-4xl font-bold text-[var(--color-text)] tracking-widest [font-family:'LXGW_WenKai','STKaiti',serif]">
               {props.result.meta.hexagramName}
             </h2>
          </div>

          {/* 印章视觉 */}
          <div className="flex flex-col items-center justify-center border-2 border-[var(--color-accent)] rounded-sm opacity-90 p-1.5 rotate-[-3deg] mix-blend-multiply shadow-sm">
            <div className="border border-[var(--color-accent)] p-2">
              <p className="text-[1.1rem] font-bold text-[var(--color-accent)] [font-family:'LXGW_WenKai','STKaiti',serif] tracking-widest leading-tight" style={{ writingMode: 'vertical-rl' }}>
                天机<br/>显现
              </p>
            </div>
          </div>
        </div>

        <blockquote className="relative z-10 mt-12 text-[1.4rem] leading-[1.85] text-[var(--color-text)] [font-family:'LXGW_WenKai','STKaiti',serif] text-justify font-bold border-l-4 border-l-[var(--color-accent)] pl-5">
          「{props.result.mysticSaying}」
        </blockquote>

        <p className="relative z-10 mt-5 text-[0.95rem] leading-8 text-[var(--color-muted)] text-justify pr-2">
          {props.result.mysticExplanation}
        </p>

        <div className="relative z-10 mt-8 mb-6 flex justify-center opacity-30">
           <span className="block w-2/3 border-b border-dashed border-[var(--color-text)]"></span>
        </div>

        {/* 融合 RAG 结果建议 */}
        <section className="relative z-10">
          <p className="text-xs font-bold tracking-[0.3em] text-[var(--color-muted)] mb-5">避坑指南</p>
          <ul className="space-y-4">
            {props.result.healthAdvice.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-4 text-[0.95rem] leading-[1.8] text-[var(--color-text)] [font-family:'LXGW_WenKai','STKaiti',serif]"
              >
                <div className="mt-1 min-w-[20px] text-center text-[var(--color-accent)] text-xs font-bold font-sans">
                  {idx + 1}.
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative z-10 mt-8 grid grid-cols-2 gap-4">
          <div className="flex flex-col border border-[rgba(74,106,72,0.4)] bg-[rgba(74,106,72,0.06)] p-4 rounded-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-positive)] font-bold mb-3">宜</p>
            <div className="flex flex-wrap gap-2">
              {props.result.dos.map((item, idx) => (
                <span key={idx} className="bg-white text-[var(--color-positive)] border border-[rgba(74,106,72,0.2)] px-2 py-1 rounded text-xs shadow-sm font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col border border-[rgba(176,58,46,0.3)] bg-[rgba(176,58,46,0.05)] p-4 rounded-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-negative)] font-bold mb-3">忌</p>
            <div className="flex flex-wrap gap-2">
              {props.result.donts.map((item, idx) => (
                <span key={idx} className="bg-white text-[var(--color-negative)] border border-[rgba(176,58,46,0.15)] px-2 py-1 rounded text-xs shadow-sm font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="relative z-10 mt-8 flex justify-between items-end border-t border-[var(--color-border)] pt-4 text-xs leading-5 text-[var(--color-muted)] font-mono">
          <div>
              <p>{props.result.meta.ganZhiSummary}</p>
          </div>
          <div className="text-right">
              <p>{formatDateTime(props.result.meta.generatedAt)}</p>
          </div>
        </div>
      </motion.div>

      {/* 底部操作区 */}
      <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3 justify-center mb-8">
        <button
          type="button"
          onClick={props.onSaveImage}
          disabled={props.isSavingImage}
          className="rounded-full bg-[var(--color-accent)] px-8 py-3.5 text-sm font-bold text-[#f7f3ec] disabled:opacity-60 shadow-[0_4px_14px_rgba(176,58,46,0.4)] transition hover:-translate-y-0.5 active:translate-y-0"
        >
          {props.isSavingImage ? "正在拓印…" : "收藏天机卡"}
        </button>

        <div className="flex gap-3 justify-center w-full sm:w-auto mt-2 sm:mt-0">
            <button
            type="button"
            onClick={props.onRegenerate}
            className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm text-[var(--color-text)] bg-[rgba(255,255,255,0.4)] hover:bg-white transition"
            >
            重新感应
            </button>

            <button
            type="button"
            onClick={props.onOpenHistory}
            className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm text-[var(--color-text)] bg-[rgba(255,255,255,0.4)] hover:bg-white transition"
            >
            翻阅往昔
            </button>
        </div>
      </div>
    </div>
  );
});
