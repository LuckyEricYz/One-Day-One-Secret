import { motion, useReducedMotion } from "framer-motion";
import type { HTMLAttributes } from "react";

type HexagramGlyphProps = HTMLAttributes<HTMLDivElement> & {
  lines: number[];
  changingLines?: number[];
  compact?: boolean;
  animated?: boolean;
  staggerMs?: number;
  emphasis?: "default" | "hero" | "modal";
};

export function HexagramGlyph({
  lines,
  changingLines = [],
  compact = false,
  animated = false,
  staggerMs = 70,
  emphasis = "default",
  className = "",
  ...rest
}: HexagramGlyphProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;
  const sizeClassName = compact ? "hexagram-glyph--compact" : `hexagram-glyph--${emphasis}`;

  return (
    <div
      className={`hexagram-glyph ${sizeClassName} ${className}`.trim()}
      {...rest}
    >
      {[...lines].reverse().map((line, index) => {
        const lineNumber = lines.length - index;
        const changing = changingLines.includes(lineNumber);
        const changingClassName = changing ? "hexagram-glyph__bar--changing" : "";
        const delay = (index * staggerMs) / 1000;

        return (
          <div key={`${lineNumber}-${line}`} className="hexagram-glyph__row">
            <div className="hexagram-glyph__track">
              {line === 1 ? (
                <motion.span
                  className={`hexagram-glyph__bar hexagram-glyph__bar--solid ${changingClassName}`}
                  initial={shouldAnimate ? { opacity: 0, scaleX: 0.18 } : false}
                  animate={shouldAnimate ? { opacity: 1, scaleX: 1 } : undefined}
                  transition={shouldAnimate ? { duration: 0.34, delay, ease: "easeOut" } : undefined}
                  style={{ originX: 0.5 }}
                />
              ) : (
                <>
                  <motion.span
                    className={`hexagram-glyph__bar hexagram-glyph__bar--left ${changingClassName}`}
                    initial={shouldAnimate ? { opacity: 0, scaleX: 0.15 } : false}
                    animate={shouldAnimate ? { opacity: 1, scaleX: 1 } : undefined}
                    transition={
                      shouldAnimate ? { duration: 0.32, delay, ease: "easeOut" } : undefined
                    }
                    style={{ originX: 0 }}
                  />
                  <motion.span
                    className={`hexagram-glyph__bar hexagram-glyph__bar--right ${changingClassName}`}
                    initial={shouldAnimate ? { opacity: 0, scaleX: 0.15 } : false}
                    animate={shouldAnimate ? { opacity: 1, scaleX: 1 } : undefined}
                    transition={
                      shouldAnimate
                        ? { duration: 0.32, delay: delay + 0.04, ease: "easeOut" }
                        : undefined
                    }
                    style={{ originX: 1 }}
                  />
                </>
              )}
            </div>
            {changing ? (
              <motion.span
                className="hexagram-glyph__marker hexagram-glyph__marker--active"
                initial={shouldAnimate ? { opacity: 0, scale: 0.3 } : false}
                animate={shouldAnimate ? { opacity: 1, scale: 1 } : undefined}
                transition={shouldAnimate ? { duration: 0.28, delay: delay + 0.1 } : undefined}
                aria-hidden="true"
              />
            ) : (
              <span className="hexagram-glyph__marker" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
