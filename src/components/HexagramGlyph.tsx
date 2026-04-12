import type { HTMLAttributes } from "react";

type HexagramGlyphProps = HTMLAttributes<HTMLDivElement> & {
  lines: number[];
  changingLines?: number[];
  compact?: boolean;
};

export function HexagramGlyph({
  lines,
  changingLines = [],
  compact = false,
  className = "",
  ...rest
}: HexagramGlyphProps) {
  const barHeight = compact ? "h-2" : "h-2.5";
  const gap = compact ? "gap-2" : "gap-2.5";
  const markerSize = compact ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <div className={`flex w-full flex-col ${gap} ${className}`.trim()} {...rest}>
      {[...lines].reverse().map((line, index) => {
        const lineNumber = lines.length - index;
        const changing = changingLines.includes(lineNumber);
        const inkClassName = changing
          ? "bg-[color:var(--color-vermillion)]"
          : "bg-[color:var(--color-ink)]";

        return (
          <div key={`${lineNumber}-${line}`} className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2">
              {line === 1 ? (
                <span className={`block w-full rounded-full ${barHeight} ${inkClassName}`} />
              ) : (
                <>
                  <span className={`block w-[42%] rounded-full ${barHeight} ${inkClassName}`} />
                  <span className={`block w-[42%] rounded-full ${barHeight} ${inkClassName}`} />
                </>
              )}
            </div>
            {changing ? (
              <span
                className={`block rounded-full bg-[color:var(--color-vermillion)] ${markerSize}`}
                aria-hidden="true"
              />
            ) : (
              <span className={markerSize} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
