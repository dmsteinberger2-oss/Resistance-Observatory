"use client";

import { useInView } from "@/lib/motion";
import { Reveal } from "@/components/Reveal";

/**
 * Chapter 04 — The Surveillance Gap. Shows the latency between scattered journal
 * publication and researcher awareness without inventing any duration figure
 * (the System Public Graph holds no latency number).
 */
export function Gap() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });

  return (
    <section
      id="gap"
      aria-labelledby="gap-h"
      className="border-b border-line bg-[#050d17] py-24 sm:py-28"
    >
      <div className="ro-wrap">
        <Reveal>
          <div className="ro-chapter-bar">
            <span className="font-mono font-semibold text-drug">
              04 — The Surveillance Gap
            </span>
            <span className="font-mono">
              Literature Dispersion · Replay Architecture
            </span>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end">
          <Reveal>
            <p className="ro-eyebrow ro-eyebrow-muted mb-4">The translation gap</p>
            <h2
              id="gap-h"
              className="font-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-[1.08] text-fg text-balance"
            >
              The evidence arrives.{" "}
              <span className="text-muted">Then it waits.</span>
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <p className="max-w-[64ch] text-base leading-relaxed text-body">
              New findings about resistance markers are published continuously,
              scattered across the literature. A paper that changes the picture
              can sit for a long time before it reaches the people deciding
              which drugs to use.
            </p>
          </Reveal>
        </div>

        {/* Architectural 3-stage latency schematic */}
        <div
          ref={ref}
          data-on={inView ? "true" : "false"}
          className="group ro-panel mt-12 p-6 sm:p-8"
          role="img"
          aria-label="Schematic timeline: a finding is published in the literature, passes through an unmonitored translation window of unmeasured duration, and reaches researchers tracking drug-resistance markers."
        >
          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Stage 1 */}
            <div className="rounded-[6px] border border-drug/35 bg-drug-soft/25 p-4">
              <div className="flex items-center justify-between font-mono text-xs text-drug">
                <span>STAGE 01</span>
                <span>● PUBLISHED</span>
              </div>
              <p className="mt-2 font-display text-lg font-semibold text-fg">
                Finding enters literature
              </p>
              <p className="mt-1 text-xs leading-relaxed text-body">
                Statistical association reported in an individual study (PMID /
                DOI).
              </p>
            </div>

            {/* Stage 2: Latency Track */}
            <div className="px-2 py-3">
              <div className="mb-2 flex items-center justify-between font-mono text-xs text-muted">
                <span>SCATTERED JOURNALS</span>
                <span>UNMEASURED LATENCY</span>
              </div>
              <div className="relative flex h-9 items-center">
                <div className="w-full border-t border-dashed border-line-strong" />
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-drug bg-bg transition-[left] duration-[2200ms] ease-in-out group-data-[on=true]:left-[calc(100%-1rem)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-drug" />
                </div>
              </div>
              <p className="mt-2 text-center font-mono text-xs text-muted">
                No duration figure shown &mdash; not recorded in the graph
              </p>
            </div>

            {/* Stage 3 */}
            <div className="rounded-[6px] border border-line-strong bg-[#0a1b2b] p-4">
              <div className="flex items-center justify-between font-mono text-xs text-muted">
                <span>STAGE 02</span>
                <span>◆ EVIDENCE WATCH</span>
              </div>
              <p className="mt-2 font-display text-lg font-semibold text-fg">
                Reaches people choosing drugs
              </p>
              <p className="mt-1 text-xs leading-relaxed text-body">
                Qualified against prior associations and traced directly to the
                source paper.
              </p>
            </div>
          </div>
        </div>

        {/* Thesis & Snapshot Honesty */}
        <Reveal className="mt-12">
          <div className="grid gap-6 border-t border-line pt-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-baseline">
            <p className="font-display text-[clamp(1.35rem,2.4vw,1.95rem)] font-semibold leading-snug text-fg text-balance">
              Resistance Observatory asks one question, marker by marker:{" "}
              <span className="text-drug">
                does this new finding change the picture?
              </span>
            </p>
            <p className="text-sm leading-relaxed text-muted">
              The demo replays real publication history from a frozen evidence
              snapshot, in the order findings were actually published. It is not
              live surveillance.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
