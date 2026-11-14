"use client";

import { useEffect, useState } from "react";
import type { Stat } from "@/lib/stats";
import { useInView, usePrefersReducedMotion } from "@/lib/motion";

/**
 * Renders a Stat from lib/stats.ts. Numeric values count up on first scroll
 * into view (static under reduced motion). Text values render verbatim.
 */
export function StatFigure({
  stat,
  className = "",
  showLabel = true,
  showSource = true,
  size = "lg",
}: {
  stat: Stat;
  className?: string;
  showLabel?: boolean;
  showSource?: boolean;
  size?: "lg" | "md" | "sm";
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  const reduced = usePrefersReducedMotion();
  const target = typeof stat.value === "number" ? stat.value : null;
  const [shown, setShown] = useState<number | null>(target === null ? null : 0);

  useEffect(() => {
    if (target === null) return;
    if (reduced) {
      setShown(target);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1350;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, target]);

  const decimals = target !== null && !Number.isInteger(target) ? 1 : 0;
  const sizeClass =
    size === "lg"
      ? "text-[clamp(2.5rem,5vw,4.25rem)]"
      : size === "md"
        ? "text-[clamp(1.85rem,3.2vw,2.75rem)]"
        : "text-2xl sm:text-3xl";

  return (
    <div ref={ref} className={className}>
      <p className={`font-display ${sizeClass} font-semibold tabular-nums leading-[1.04] text-fg`}>
        {target !== null ? (
          <>
            <span aria-hidden="true">
              {(shown ?? 0).toLocaleString("en-US", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
              {stat.unit ? <span className="text-muted font-normal">{stat.unit}</span> : ""}
            </span>
            <span className="sr-only">
              {target.toLocaleString("en-US")}
              {stat.unit ?? ""}
            </span>
          </>
        ) : (
          <>
            {String(stat.value)}
            {stat.unit ?? ""}
          </>
        )}
      </p>
      {showLabel ? (
        <p className="mt-2.5 max-w-[34ch] text-sm leading-snug text-body">{stat.label}</p>
      ) : null}
      {showSource ? (
        <p className="mt-1.5 font-mono text-xs text-muted">Source: {stat.source}</p>
      ) : null}
    </div>
  );
}
