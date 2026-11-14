"use client";

/**
 * Learn — docs/LEARN.md. Five blocks, in strict editorial sequence:
 *   1. identity strip  2. one-sentence answer  3. diagram (+ 3D structures)
 *   4. plain-language mechanism  5. limits + two primary handoff actions
 *
 * Content comes from content/markers.ts, transcribed from docs/MARKER-CONTENT.md.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSelection } from "@/lib/selection";
import { getMarker, MARKERS } from "@/content/markers";
import { Chip } from "@/components/Chip";
import { ActionButtons } from "@/components/learn/ActionButtons";
import { MarkerDiagram } from "@/components/learn/MarkerDiagram";
import { StructureEvidence } from "@/components/learn/StructureEvidence";

export function LearnView({
  structureFigure,
}: {
  structureFigure?: ReactNode;
}) {
  const { markerId, setMarkerId, hrefWithSelection } = useSelection();
  const [uncovered, setUncovered] = useState<string | null>(null);
  const marker = getMarker(markerId);

  // Learn sets markerId (LEARN.md). If the URL carries none, or an unknown id,
  // write the shown marker into shared state so every other tab inherits it.
  useEffect(() => {
    if (markerId && !MARKERS[markerId]) setUncovered(markerId);
    if (!markerId || !MARKERS[markerId]) setMarkerId(marker.id);
  }, [markerId, marker.id, setMarkerId]);

  const sentence = marker.oneSentence;
  const diagram = marker.diagram;
  const mechanism = marker.mechanism;

  const metaCols = marker.classification
    ? "sm:grid-cols-2 lg:grid-cols-5"
    : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <article className="pb-20">
      <h1 className="sr-only">
        Learn: {marker.gene} {marker.alteration} and {marker.drug}
      </h1>

      {/* Architectural Masthead: Specimen Identity + Lead Thesis + Pathway Plate */}
      <div className="learn-top border-b border-line">
        <div className="ro-wrap pb-14 pt-10 xl:pb-16 xl:pt-14">
          {uncovered ? (
            <p
              role="status"
              className="mb-8 flex items-start gap-3 rounded-[var(--radius)] border border-line-strong border-l-2 border-l-signal bg-surface px-4 py-3 text-sm text-body"
            >
              <span
                aria-hidden="true"
                className="font-mono text-xs font-bold text-signal"
              >
                [NOTICE]
              </span>
              <span>
                <span className="font-mono font-semibold text-fg break-all">
                  {uncovered.slice(0, 80)}
                </span>{" "}
                isn&rsquo;t covered yet &mdash; showing{" "}
                <span className="font-mono text-fg">
                  {marker.gene} {marker.alteration}
                </span>{" "}
                ({marker.drug}).
              </span>
            </p>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="ro-eyebrow">Learn — Molecular Specimen Monograph</p>
            <span className="font-mono text-xs text-muted">
              Specimen ID: {marker.id}
            </span>
          </div>

          <p className="mb-5 max-w-3xl text-lg leading-relaxed text-body text-pretty">
            This page explains one mutation in the malaria parasite,{" "}
            <span className="font-mono text-fg">
              {marker.gene} {marker.alteration}
            </span>
            : a mutation linked to a malaria drug working less well.
          </p>

          {/* 1 — Architectural Specimen Identity Strip */}
          <section
            aria-label="Marker identity"
            className="ro-panel overflow-hidden"
          >
            <dl
              className={`grid divide-y divide-line ${metaCols} sm:divide-x sm:divide-y-0`}
            >
              <div className="px-4 py-3.5 sm:px-5">
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
                  Organism
                </dt>
                <dd className="mt-1 text-sm font-semibold text-fg">
                  {marker.organism}
                </dd>
              </div>

              <div className="px-4 py-3.5 sm:px-5">
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
                  Gene
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  <span className="font-mono font-semibold">{marker.gene}</span>
                  {marker.geneFullName ? (
                    <span className="block text-xs text-muted">
                      {marker.geneFullName}
                    </span>
                  ) : null}
                </dd>
              </div>

              <div className="px-4 py-3.5 sm:px-5">
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
                  Alteration
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  <span className="font-mono font-semibold text-signal">
                    ▲ {marker.alteration}
                  </span>
                  {marker.alterationPlain ? (
                    <span className="block text-xs text-muted">
                      {marker.alterationPlain}
                    </span>
                  ) : null}
                </dd>
              </div>

              <div className="px-4 py-3.5 sm:px-5">
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
                  Drug Context
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  <span className="font-semibold text-drug">
                    ◆ {marker.drug}
                  </span>
                  {marker.drugNote ? (
                    <span className="block text-xs text-muted">
                      {marker.drugNote}
                    </span>
                  ) : null}
                </dd>
              </div>

              {marker.classification ? (
                <div className="px-4 py-3.5 sm:px-5">
                  <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
                    Classification
                  </dt>
                  <dd className="mt-1.5">
                    <Chip
                      tone="neutral"
                      title={`Source: ${marker.classification.source}`}
                    >
                      {marker.classification.label} ·{" "}
                      {marker.classification.source}
                    </Chip>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* 2 & 3a — Lead Thesis + Folate Accumulation Ladder */}
          <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,4.6fr)_minmax(0,7.4fr)] xl:items-start xl:gap-10">
            <div className="min-w-0 xl:pt-2">
              <div className="inline-flex items-center gap-2.5 rounded-[5px] border border-signal/35 bg-signal-soft/35 px-3 py-1.5 font-mono text-xs text-signal">
                <span>▲ {marker.gene}</span>
                <span>·</span>
                <span>{marker.alteration}</span>
                <span>·</span>
                <span className="text-drug">{marker.drug}</span>
              </div>

              {/* 2 — The one-sentence answer */}
              <section
                aria-label="The answer in one sentence"
                className="mt-5"
              >
                <p className="font-display text-[clamp(1.6rem,2.65vw,2.45rem)] font-semibold leading-[1.16] text-fg text-balance">
                  {sentence.value}
                </p>
              </section>

              <p
                aria-hidden="true"
                className="mt-8 hidden select-none font-mono text-[clamp(3.2rem,5.5vw,5rem)] font-semibold leading-none tracking-tight text-fg/10 xl:block"
              >
                {marker.alteration}
              </p>
            </div>

            {/* 3 — Folate Pathway Accumulation Diagram */}
            <section
              aria-label="Diagram"
              className="ro-panel min-w-0 overflow-hidden p-5 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-drug">
                  Plate 01 · Haplotype Accumulation Ladder
                </span>
                <h2 className="font-display text-lg font-semibold text-fg">
                  {diagram.value.title}
                </h2>
              </div>
              <MarkerDiagram diagram={diagram.value} />
            </section>
          </div>
        </div>
      </div>

      {/* Main Editorial Body */}
      <div className="ro-wrap pt-14">
        {/* 3b — Published Crystal Structures & Pinned Graph Cross-Reference */}
        <div className="ro-chapter-bar mb-8">
          <span className="font-mono font-semibold text-drug">
            01 — Structural & Literature Evidence
          </span>
          <span className="font-mono">
            RCSB PDB (6JWX · 6KCL) × System Public Graph v2.1
          </span>
        </div>

        <StructureEvidence marker={marker} />
        {structureFigure}

        {/* 4 — Plain-Language Mechanism */}
        <section
          aria-labelledby="mech-h"
          className="mt-20 border-t border-line pt-16"
        >
          <div className="ro-chapter-bar mb-8">
            <h2
              id="mech-h"
              className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-drug"
            >
              02 — How It Works, Plainly
            </h2>
            <span className="font-mono">
              Folate Synthesis · Competitive Inhibition · Codon 540
            </span>
          </div>

          {marker.keyPoint ? (
            <div className="mb-10 rounded-[var(--radius)] border border-line border-l-2 border-l-signal bg-signal-soft/20 px-5 py-5 sm:px-7">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-signal">
                Key Haplotype Context
              </p>
              <h3 className="mt-1.5 font-display text-xl font-semibold text-fg sm:text-2xl">
                {marker.keyPoint.heading}
              </h3>
              <p className="mt-2.5 max-w-[68ch] text-base leading-relaxed text-body">
                {marker.keyPoint.body}
              </p>
            </div>
          ) : null}

          <details className="ro-panel overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-display text-lg font-semibold text-fg transition-colors hover:bg-[#081523] hover:text-drug sm:px-7">
              The biochemistry, in three short paragraphs
            </summary>
            <div className="grid divide-y divide-line border-t border-line md:grid-cols-3 md:divide-x md:divide-y-0">
              {mechanism.value.map((para, i) => (
                <div key={i} className="p-6 sm:p-7">
                  <p className="font-mono text-xs font-semibold tabular-nums text-drug">
                    0{i + 1}
                  </p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-fg">
                    {para.heading}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-body">
                    {para.body}
                  </p>
                </div>
              ))}
            </div>
          </details>

          {/* Clinical Stakes Chain context */}
          <div className="mt-8 rounded-[var(--radius)] border border-line bg-[#081523] p-6 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
                  Clinical Context in the Graph
                </p>
                <h3 className="mt-1.5 font-display text-xl font-semibold text-fg">
                  Why this matters
                </h3>
                <p className="mt-2.5 max-w-[66ch] text-base leading-relaxed text-body">
                  <span className="font-mono text-fg">
                    {marker.gene} {marker.alteration}
                  </span>{" "}
                  is associated with reduced efficacy of{" "}
                  <span className="text-drug">{marker.drug}</span>, one half of
                  SP. The evidence graph also holds findings that connect SP
                  failure with outcomes for patients: birth weight, placental
                  parasitemia, and malaria at delivery.
                </p>
              </div>
              <div className="border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <p className="text-sm leading-relaxed text-muted">
                  Alert follows that chain of evidence one finding at a time,
                  each linked to its paper. These are associations reported in
                  published studies.
                </p>
                <Link
                  href={hrefWithSelection("/alert", { markerId: marker.id })}
                  className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-drug underline decoration-drug/40 underline-offset-4 hover:decoration-drug"
                >
                  <span>Follow the stakes chain on Alert</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 5 — Epistemic Limits and Primary Handoff Actions */}
        <section
          aria-label="Limits and next steps"
          className="mt-20 border-t border-line pt-16"
        >
          <div className="ro-chapter-bar mb-8">
            <span className="font-mono font-semibold text-drug">
              03 — Epistemic Limits & Module Handoff
            </span>
            <span className="font-mono">
              Shared Selection: {marker.gene} {marker.alteration} ·{" "}
              {marker.drug}
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
            <div className="ro-panel p-6 sm:p-7">
              <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
                What this doesn&rsquo;t tell you
              </h2>
              <ul className="mt-5 divide-y divide-line border-t border-line">
                {(
                  marker.limits ?? [
                    <>
                      Finding this marker in a parasite does{" "}
                      <strong className="font-semibold text-fg">not</strong>{" "}
                      mean any individual patient&rsquo;s treatment will fail.
                    </>,
                    <>
                      <strong className="font-semibold text-fg">
                        Absence of evidence is not evidence of absence.
                      </strong>{" "}
                      A missing relationship may reflect extraction gaps,
                      grounding failures, or no published study.
                    </>,
                    <>
                      <strong className="font-semibold text-fg">
                        This is not clinical guidance
                      </strong>{" "}
                      and is never a treatment recommendation.
                    </>,
                  ]
                ).map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-3.5 py-4 text-sm leading-relaxed text-body first:pt-4 last:pb-0 sm:text-base"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-signal/40 bg-signal-soft/40 font-mono text-xs font-bold text-signal"
                    >
                      ✕
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ro-panel p-6 sm:p-7">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-drug">
                Continue Investigation
              </p>
              <h2 className="mt-1.5 font-display text-xl font-semibold text-fg sm:text-2xl">
                Carry this marker forward
              </h2>
              <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
                Both modules inherit{" "}
                <span className="font-mono text-fg">
                  {marker.gene} {marker.alteration}
                </span>{" "}
                ({marker.drug}) automatically via the URL state.
              </p>
              <ActionButtons marker={marker} />
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
