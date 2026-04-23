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

type GlyphSizeConfig = {
  barHeight: string;
  gap: string;
  markerSize: string;
  rowGap: string;
};

function getSizeConfig(
  compact: boolean,
  emphasis: NonNullable<HexagramGlyphProps["emphasis"]>
): GlyphSizeConfig {
  if (compact) {
    return {
      barHeight: "h-2",
      gap: "gap-2",
      markerSize: "h-1.5 w-1.5",
      rowGap: "gap-1.5"
    };
  }

  if (emphasis === "hero") {
    return {
      barHeight: "h-3.5",
      gap: "gap-3.5",
      markerSize: "h-2.5 w-2.5",
      rowGap: "gap-2.5"
    };
  }

  if (emphasis === "modal") {
    return {
      barHeight: "h-3",
      gap: "gap-3",
      markerSize: "h-2.5 w-2.5",
      rowGap: "gap-2"
    };
  }

  return {
    barHeight: "h-2.5",
    gap: "gap-2.5",
    markerSize: "h-2 w-2",
    rowGap: "gap-2"
  };
}

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
  const sizes = getSizeConfig(compact, emphasis);
  const shouldAnimate = animated && !prefersReducedMotion;

  return (
    <div
      className={`hexagram-glyph flex w-full flex-col ${sizes.gap} ${className}`.trim()}
      {...rest}
    >
      {[...lines].reverse().map((line, index) => {
        const lineNumber = lines.length - index;
        const changing = changingLines.includes(lineNumber);
        const inkClassName = changing
          ? "bg-[color:var(--color-vermillion)]"
          : "bg-[color:var(--color-ink)]";
        const delay = (index * staggerMs) / 1000;

        return (
          <div key={`${lineNumber}-${line}`} className={`flex items-center ${sizes.rowGap}`}>
            <div className={`flex flex-1 items-center ${sizes.rowGap}`}>
              {line === 1 ? (
                <motion.span
                  className={`block w-full rounded-full ${sizes.barHeight} ${inkClassName}`}
                  initial={shouldAnimate ? { opacity: 0, scaleX: 0.18 } : false}
                  animate={shouldAnimate ? { opacity: 1, scaleX: 1 } : undefined}
                  transition={shouldAnimate ? { duration: 0.34, delay, ease: "easeOut" } : undefined}
                  style={{ originX: 0.5 }}
                />
              ) : (
                <>
                  <motion.span
                    className={`block w-[42%] rounded-full ${sizes.barHeight} ${inkClassName}`}
                    initial={shouldAnimate ? { opacity: 0, scaleX: 0.15 } : false}
                    animate={shouldAnimate ? { opacity: 1, scaleX: 1 } : undefined}
                    transition={
                      shouldAnimate ? { duration: 0.32, delay, ease: "easeOut" } : undefined
                    }
                    style={{ originX: 0 }}
                  />
                  <motion.span
                    className={`block w-[42%] rounded-full ${sizes.barHeight} ${inkClassName}`}
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
                className={`block rounded-full bg-[color:var(--color-vermillion)] ${sizes.markerSize}`}
                initial={shouldAnimate ? { opacity: 0, scale: 0.3 } : false}
                animate={shouldAnimate ? { opacity: 1, scale: 1 } : undefined}
                transition={shouldAnimate ? { duration: 0.28, delay: delay + 0.1 } : undefined}
                aria-hidden="true"
              />
            ) : (
              <span className={sizes.markerSize} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
