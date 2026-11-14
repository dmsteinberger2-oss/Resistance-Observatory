"use client";

/**
 * Learn — docs/LEARN.md. Five blocks, in order, nothing else:
 *   1. identity strip  2. one-sentence answer  3. diagram
 *   4. plain-language mechanism  5. limits + actions
 *
 * Content comes from content/markers.ts, transcribed from
 * docs/MARKER-CONTENT.md.
 */
import { useEffect } from "react";
import { useSelection } from "@/lib/selection";
import { getMarker, MARKERS } from "@/content/markers";
import { Chip } from "@/components/Chip";
import { ActionButtons } from "@/components/learn/ActionButtons";
import { MarkerDiagram } from "@/components/learn/MarkerDiagram";

export default function LearnPage() {
  const { markerId, setMarkerId } = useSelection();
  const marker = getMarker(markerId);

  // Learn sets markerId (LEARN.md). If the URL carries none, or an unknown id,
  // write the shown marker into shared state so every other tab inherits it.
  useEffect(() => {
    if (!markerId || !MARKERS[markerId]) setMarkerId(marker.id);
  }, [markerId, marker.id, setMarkerId]);

  const sentence = marker.oneSentence;
  const diagram = marker.diagram;
  const mechanism = marker.mechanism;

  return (
    <article className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <h1 className="sr-only">
        Learn: {marker.gene} {marker.alteration} and {marker.drug}
      </h1>

      {/* 1 — Identity strip */}
      <section aria-label="Marker identity" className="border-b border-line pb-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-sm sm:text-base">
          <span className="italic">{marker.organism}</span>
          <Dot />
          <span>
            <span className="font-semibold">{marker.gene}</span>
            {marker.geneFullName ? <span className="text-muted"> ({marker.geneFullName})</span> : null}
          </span>
          <Dot />
          <span>
            <span className="font-semibold text-signal">{marker.alteration}</span>
            {marker.alterationPlain ? <span className="text-muted"> ({marker.alterationPlain})</span> : null}
          </span>
          <Dot />
          <span>
            affects <span className="font-semibold text-drug">{marker.drug}</span>
            {marker.drugNote ? <span className="text-muted"> ({marker.drugNote})</span> : null}
          </span>
          {marker.classification ? (
            <Chip tone="neutral" title={`Source: ${marker.classification.source}`}>
              {marker.classification.label} · {marker.classification.source}
            </Chip>
          ) : null}
        </p>
      </section>

      {/* 2 — The one-sentence answer */}
      <section aria-label="The answer in one sentence" className="py-10 sm:py-14">
        <p className="max-w-5xl font-display text-[clamp(1.9rem,4.4vw,3.6rem)] font-bold leading-[1.08] tracking-tight text-balance">
          {sentence.value}
        </p>
      </section>

      {/* 3 — The diagram */}
      <section aria-label="Diagram" className="rounded-[calc(var(--radius)+6px)] border border-line bg-surface p-4 sm:p-8">
        <h2 className="mb-6 font-display text-2xl font-semibold sm:text-3xl">{diagram.value.title}</h2>
        <MarkerDiagram diagram={diagram.value} />
      </section>

      {/* 4 — Plain-language mechanism */}
      <section aria-labelledby="mech-h" className="py-14">
        <h2 id="mech-h" className="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          How it works, plainly
        </h2>
        {marker.keyPoint ? (
          <div className="mb-10 border-l-4 border-signal bg-surface px-5 py-5 sm:px-7">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Keep this in mind</p>
            <h3 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{marker.keyPoint.heading}</h3>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-pretty">{marker.keyPoint.body}</p>
          </div>
        ) : null}
        <div className="grid gap-8 md:grid-cols-3">
          {mechanism.value.map((para, i) => (
            <div key={i}>
              <h3 className="mb-2 font-mono text-xs text-muted">{para.heading}</h3>
              <p className="text-lg leading-relaxed text-pretty">{para.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5 — Limits and actions */}
      <section aria-label="Limits and next steps" className="grid gap-8 border-t border-line pt-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold">What this doesn&rsquo;t tell you</h2>
          <ul className="mt-5 space-y-4">
            {(marker.limits ?? [
              <>
                Finding this marker in a parasite does <strong>not</strong> mean any individual
                patient&rsquo;s treatment will fail.
              </>,
              <>
                <strong>Absence of evidence is not evidence of absence.</strong> A missing
                relationship may reflect extraction gaps, grounding failures, or no published study.
              </>,
              <>
                <strong>This is not clinical guidance</strong> and is never a treatment
                recommendation.
              </>,
            ]).map((item, i) => (
              <li key={i} className="flex gap-3 text-pretty">
                <span aria-hidden className="mt-1 font-mono text-sm font-bold text-signal">
                  ✕
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">Next</h2>
          <p className="mb-5 mt-2 text-sm text-muted">
            Both carry this marker &mdash; {marker.gene} {marker.alteration}, {marker.drug} &mdash; with you.
          </p>
          <ActionButtons marker={marker} />
        </div>
      </section>
    </article>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-muted">
      ·
    </span>
  );
}
