"use client";

/**
 * The structure viewer and the marker's graph findings, side by side in
 * meaning but NOT joined in the data. The structure comes from RCSB PDB; the
 * findings come from the System Public Graph; neither references the other.
 * The only link is our own marker definition in content/markers.ts
 * (`sources.pdbResidue` and `sources.graphVariableIds`). The page says so.
 *
 * Bidirectional wiring:
 *  - choosing the marker's residue in either viewer highlights this panel and
 *    scrolls it into view;
 *  - hovering or focusing a finding pulses that residue in both viewers.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { Marker } from "@/content/markers";
import { MARKER_FINDINGS, spotStatusLabel } from "@/lib/findings";
import { formatGraphDate } from "@/lib/stats";
import { EvidenceLink } from "@/components/EvidenceLink";
import { StudyTypeChip } from "@/components/data/StudyTypeChip";
import { StructureViewer } from "@/components/learn/StructureViewer";

export function StructureEvidence({ marker }: { marker: Marker }) {
  const sources = marker.sources;
  const headRef = useRef<HTMLDivElement | null>(null);
  const [fromStructure, setFromStructure] = useState(false);
  const [pulse, setPulse] = useState<number | null>(null);

  // MARKER_FINDINGS already leaves out anything flagged `vetted: false`.
  const findings = useMemo(() => {
    const ids = new Set(sources?.graphVariableIds ?? []);
    return MARKER_FINDINGS.filter(
      (f) => ids.has(f.variable1Id) || ids.has(f.variable2Id),
    );
  }, [sources]);

  const onPick = useCallback(
    (resi: number) => {
      if (!sources || resi !== sources.pdbResidue) {
        setFromStructure(false);
        return;
      }
      setFromStructure(true);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      headRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "nearest",
      });
    },
    [sources],
  );

  const pulseOn = () => sources && setPulse(sources.pdbResidue);
  const pulseOff = () => setPulse(null);

  return (
    <div className="space-y-6">
      <StructureViewer onPick={onPick} pulseResi={pulse} />

      {/* DOI cross-check observation */}
      <div className="rounded-[var(--radius)] border border-line border-l-2 border-l-gap bg-[#071320] px-5 py-4 text-sm leading-relaxed text-body">
        <span className="mr-2 font-mono text-xs uppercase tracking-[0.15em] text-muted">
          Coverage Observation ·
        </span>
        Both structures come from one crystallography study,{" "}
        <a
          href="https://doi.org/10.1111/febs.15196"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-drug underline decoration-drug/40 underline-offset-4 hover:decoration-drug"
        >
          doi:10.1111/febs.15196
        </a>
        , and we found no findings from it in the System Public Graph: none in
        its vetted release and none among the findings we pulled. The
        graph&rsquo;s API cannot be searched by DOI, so this is as far as we
        could check. The structural literature on this marker is not represented
        in the graph.
      </div>

      {/* Pinned Graph Associations Linked via Marker Definition */}
      <section
        aria-labelledby="struct-findings-h"
        className={`ro-panel scroll-mt-24 overflow-hidden p-5 transition-colors sm:p-7 ${
          fromStructure ? "border-drug ring-1 ring-drug/50" : ""
        }`}
      >
        <div ref={headRef} className="scroll-mb-6 border-b border-line pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-drug">
              Plate 03 · Pinned Graph Associations ({findings.length})
            </span>
            <p aria-live="polite" className="font-mono text-xs text-drug">
              {fromStructure && sources
                ? `▶ Highlighted via structure residue ${sources.pdbResidue}`
                : "Hover or focus a row to pulse residue 540 in 3D"}
            </p>
          </div>

          <h2
            id="struct-findings-h"
            className="mt-2 font-display text-xl font-semibold text-fg sm:text-2xl"
          >
            Graph findings for {marker.gene} {marker.alteration} and{" "}
            {marker.drug}
          </h2>

          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
            The structure comes from RCSB PDB; the findings come from the System
            Public Graph. We connect them through our own definition of this
            marker &mdash; neither source links to the other. Statistics are
            shown as the graph records them, paired with an AI-assisted paper
            spot-check (not human-reviewed).
          </p>
        </div>

        {findings.length === 0 ? (
          <p className="mt-5 text-sm text-body">
            No findings in the pinned graph data pass review for this marker, so
            there is nothing to list here.
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {findings.map((f) => (
              <li
                key={f.systemId}
                onMouseEnter={pulseOn}
                onMouseLeave={pulseOff}
                onFocus={pulseOn}
                onBlur={pulseOff}
                className="grid gap-x-8 gap-y-3 py-5 transition-colors hover:bg-[#050d17]/60 focus-within:bg-[#050d17]/60 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:px-3"
              >
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-fg sm:text-base">
                    <span className="font-semibold">{f.variable1}</span>
                    <span className="text-muted"> — associated with — </span>
                    <span className="font-semibold">{f.variable2}</span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="rounded-[4px] border border-line bg-[#050d17] px-2 py-0.5 text-fg">
                      {f.statisticType}
                      {f.statisticValue !== null
                        ? `: ${f.statisticValue}`
                        : ": value not recorded"}
                    </span>
                    <StudyTypeChip studyType={f.studyType} />
                    <span className="text-muted">
                      spot-check:{" "}
                      <span className="text-body">
                        {f.spotCheck
                          ? spotStatusLabel(f.spotCheck.status)
                          : "not covered"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="min-w-0 md:text-right">
                  <p className="font-mono text-xs text-muted">
                    {f.published ? (
                      <>
                        Published{" "}
                        <time
                          dateTime={f.published}
                          className="font-semibold text-fg"
                        >
                          {formatGraphDate(f.published)}
                        </time>
                      </>
                    ) : (
                      "Publication date unknown"
                    )}
                  </p>
                  <div className="mt-2 md:flex md:justify-end">
                    <EvidenceLink
                      systemId={f.systemId}
                      pubmedId={f.pubmedId}
                      doi={f.doi}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
