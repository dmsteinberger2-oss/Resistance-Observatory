"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * Architectural scroll-stepped chapter with interactive step controls.
 * Supports both natural viewport scroll progression and direct button clicks,
 * and collapses to a static, fully legible view under prefers-reduced-motion.
 */
export function StepScene({
  id,
  chapter,
  eyebrow,
  heading,
  steps,
  visual,
  tone = "drug",
  note,
}: {
  id: string;
  chapter?: string;
  eyebrow: string;
  heading: ReactNode;
  steps: ReactNode[];
  visual: (step: number) => ReactNode;
  tone?: "drug" | "signal";
  note?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const sentinels = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setStep(Number((e.target as HTMLElement).dataset.step));
          }
        }
      },
      { rootMargin: "-48% 0px -48% 0px", threshold: 0 },
    );
    sentinels.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [reduced, steps.length]);

  const last = steps.length - 1;
  const active = reduced ? last : step;
  const accentText = tone === "drug" ? "text-drug" : "text-signal";
  const accentBorder = tone === "drug" ? "border-drug" : "border-signal";
  const accentBg = tone === "drug" ? "bg-drug" : "bg-signal";

  const selectStep = (index: number) => {
    setStep(index);
    const el = sentinels.current[index];
    if (el && !reduced) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const panel = (
    <div className="ro-wrap w-full">
      {chapter ? (
        <div className="ro-chapter-bar mb-10">
          <span className={`font-mono font-semibold ${accentText}`}>
            {chapter}
          </span>
          <span className="font-mono">
            Stage {String(active + 1).padStart(2, "0")} /{" "}
            {String(steps.length).padStart(2, "0")}
          </span>
        </div>
      ) : null}

      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div className="order-2 lg:order-1">
          <p
            className={`ro-eyebrow mb-4 ${
              tone === "signal" ? "ro-eyebrow-amber" : ""
            }`}
          >
            {eyebrow}
          </p>
          <h2
            id={`${id}-h`}
            className="font-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-[1.08] text-fg text-balance"
          >
            {heading}
          </h2>

          {/* Interactive step selector bar */}
          {!reduced ? (
            <div
              role="group"
              aria-label="Select schematic stage"
              className="mt-6 inline-flex items-center gap-1.5 rounded-[6px] border border-line bg-[#081523] p-1"
            >
              {steps.map((_, i) => {
                const isCurrent = i === active;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectStep(i)}
                    aria-pressed={isCurrent}
                    className={`rounded-[4px] px-3 py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors ${
                      isCurrent
                        ? `${accentBg} text-[#061821]`
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    Step 0{i + 1}
                  </button>
                );
              })}
            </div>
          ) : null}

          <ol className="mt-7 divide-y divide-line border-y border-line">
            {steps.map((s, i) => {
              const isCurrent = i === active;
              const isVisible = reduced || i <= active;
              return (
                <li
                  key={i}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-start gap-4 py-4 transition-opacity duration-500 ${
                    isVisible ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold tabular-nums transition-colors ${
                      isCurrent
                        ? `${accentBorder} ${accentText} bg-surface-2`
                        : "border-line text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-base leading-relaxed text-body">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s}
                  </span>
                </li>
              );
            })}
          </ol>

          {note ? (
            <p className="mt-5 font-mono text-xs leading-relaxed text-muted">
              {note}
            </p>
          ) : null}
        </div>

        <div className="order-1 lg:order-2">
          <div className="ro-panel ro-grid-field relative overflow-hidden p-5 sm:p-8">
            <div className="mb-3 flex items-center justify-between border-b border-line pb-3 font-mono text-xs text-muted">
              <span>SCHEMATIC PLATE · INTRAERYTHROCYTIC STAGE</span>
              <span className={accentText}>
                {tone === "drug" ? "● WILD TYPE" : "▲ MUTANT LOCUS"}
              </span>
            </div>
            {visual(active)}
          </div>
        </div>
      </div>
    </div>
  );

  if (reduced) {
    return (
      <section
        id={id}
        aria-labelledby={`${id}-h`}
        className="border-b border-line py-24"
      >
        {panel}
      </section>
    );
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="relative border-b border-line"
      style={{ height: `${steps.length * 82 + 30}vh` }}
    >
      {steps.map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            sentinels.current[i] = el;
          }}
          data-step={i}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 w-px"
          style={{ top: `${i * 82}vh`, height: "82vh" }}
        />
      ))}
      <div className="sticky top-[76px] flex h-[calc(100dvh-76px)] items-center max-[500px]:top-[65px] max-[500px]:h-[calc(100dvh-65px)]">
        {panel}
      </div>
    </section>
  );
}
