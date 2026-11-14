"use client";

import { useEffect, useState } from "react";
import type { Stat } from "@/lib/stats";
import { useInView, usePrefersReducedMotion } from "@/lib/motion";

/**
 * Renders a Stat from lib/stats.ts. Numeric values count up on first scroll
 * into view (static under reduced motion). Unsourced values (null) render a
 * visible placeholder token naming the constant — never a made-up number.
 */
export function StatFigure({
  stat,
  name,
  className = "",
  showLabel = true,
}: {
  stat: Stat;
  /** The constant's name, shown in the placeholder token. */
  name: string;
  className?: string;
  showLabel?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 });
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
    const dur = 1600;
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

  return (
    <div ref={ref} className={className}>
      <p className="font-display text-6xl sm:text-8xl font-semibold tracking-tight tabular-nums leading-none">
        {stat.value === null ? (
          <span
            title={`Unsourced — fill ${name} in lib/stats.ts`}
            className="inline-block min-w-[3ch] border-b-4 border-dashed border-gap text-gap/40"
          >
            <span aria-hidden>?</span>
            <span className="sr-only">Figure not yet sourced.</span>
          </span>
        ) : target !== null ? (
          <>
            {/* Screen readers get the final figure, not the animation. */}
            <span aria-hidden>
              {(shown ?? 0).toLocaleString("en-US", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
              {stat.unit ?? ""}
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
      {showLabel ? <p className="mt-3 max-w-xs text-sm text-muted">{stat.label}</p> : null}
      {stat.value === null ? (
        <p className="mt-2 inline-block max-w-full break-all rounded border border-dashed border-gap/70 bg-gap-soft/60 px-2 py-1 font-mono text-[0.7rem] text-gap">
          {name} · source pending
        </p>
      ) : null}
      {stat.source ? (
        <p className="mt-1 font-mono text-[0.7rem] text-muted">Source: {stat.source}</p>
      ) : null}
    </div>
  );
}
