"use client";

import { useState } from "react";
import type { AlertEvent, Watch } from "@/lib/alert/derive";
import { eventCopy } from "@/lib/alert/copy";
import { KindGlyph, SourceGlyph } from "./glyphs";
import css from "./alert.module.css";

const SHORT_SOURCE: Record<AlertEvent["source"], string> = {
  genomes: "Pf8 WGS",
  papers: "PubMed",
  graph: "System Graph",
};

const SOURCE_BADGE_TONE: Record<AlertEvent["source"], string> = {
  genomes: "border-[#ffffff29] bg-[#050d17]/70 text-fg",
  papers: "border-[#b0bdcb55] bg-[#16344a]/60 text-[#c4cdd6]",
  graph: "border-drug/50 bg-drug-soft/70 text-drug",
};

function observedMetric(e: AlertEvent): string {
  if (e.cell) {
    return `${e.cell.pct.toFixed(1)}% (${e.cell.x}/${e.cell.n})`;
  }
  if (e.statedPct != null) {
    return `${e.statedPct.toFixed(1)}% stated`;
  }
  if (e.pmid) {
    return `PMID ${e.pmid}`;
  }
  if (e.graphFindingId) {
    return e.graphFindingId;
  }
  return "Context";
}

export function AlertFeed({
  events,
  watch,
  markerLabel,
  country,
  replayYear,
  lastYear,
  hasCells,
  selectedId,
  freshYear,
  flagFor,
  onSelect,
}: {
  events: AlertEvent[];
  watch: Watch;
  markerLabel: string;
  country: string;
  replayYear: number;
  lastYear: number;
  hasCells: boolean;
  selectedId: string | null;
  freshYear: number | null;
  flagFor: (e: AlertEvent) => string | null;
  onSelect: (id: string) => void;
}) {
  const [mode, setMode] = useState<"fired" | "context">("fired");
  const [sourceFilter, setSourceFilter] = useState<"all" | AlertEvent["source"]>("all");

  const placed = events.filter((e) => !e.noCountryGiven);
  const bySource =
    sourceFilter === "all" ? placed : placed.filter((e) => e.source === sourceFilter);

  const firedList = bySource
    .filter((e) => e.fired)
    .sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
  const contextList = bySource
    .filter((e) => !e.fired)
    .sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));

  // If the selected alert is a context item (or if zero alerts fired and context exists), show appropriately
  const activeMode =
    mode === "fired" && firedList.length === 0 && contextList.length > 0 ? "context" : mode;
  const shown = activeMode === "fired" ? firedList : contextList;

  return (
    <section
      aria-labelledby="feed-h"
      className="rounded-xl border border-[#ffffff18] bg-[#0d2233] p-4 shadow-[0_20px_50px_#040b1459] sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 id="feed-h" className="text-sm font-semibold text-fg">
            Triggered Moments{" "}
            <span className="font-mono text-xs font-normal text-muted tabular-nums">
              · ≤{replayYear}
            </span>
          </h2>
        </div>

        {/* Fired vs Near-threshold / Context toggle */}
        <div
          className="inline-flex rounded-lg border border-[#ffffff24] bg-[#050d17] p-0.5 text-xs"
          role="group"
          aria-label="Feed mode"
        >
          <button
            type="button"
            onClick={() => setMode("fired")}
            aria-pressed={activeMode === "fired"}
            className={`rounded-md px-2.5 py-1 font-medium tabular-nums transition-colors ${
              activeMode === "fired"
                ? "bg-signal-soft text-signal"
                : "text-muted hover:text-fg"
            }`}
          >
            Fired ({firedList.length})
          </button>
          <button
            type="button"
            onClick={() => setMode("context")}
            aria-pressed={activeMode === "context"}
            className={`rounded-md px-2.5 py-1 font-medium tabular-nums transition-colors ${
              activeMode === "context"
                ? "bg-[#16344a] text-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            Near-threshold / Context ({contextList.length})
          </button>
        </div>
      </div>

      {/* Compact Source Filter */}
      <div
        className="mt-2.5 flex flex-wrap items-center gap-1.5 border-b border-[#ffffff14] pb-2.5"
        role="group"
        aria-label="Filter moments by source"
      >
        {(["all", "genomes", "papers", "graph"] as const).map((src) => {
          const count =
            src === "all"
              ? placed.length
              : placed.filter((e) => e.source === src).length;
          const active = sourceFilter === src;
          return (
            <button
              key={src}
              type="button"
              onClick={() => setSourceFilter(src)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                active
                  ? "border-drug/60 bg-drug-soft/80 text-drug"
                  : "border-[#ffffff18] bg-[#050d17]/50 text-muted hover:border-[#ffffff38] hover:text-fg"
              }`}
            >
              {src !== "all" ? <SourceGlyph source={src} size={11} /> : null}
              <span>{src === "all" ? "All sources" : SHORT_SOURCE[src]}</span>
              <span className="opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Scannable Feed Rows */}
      {shown.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[#ffffff29] bg-[#050d17]/40 p-5 text-xs text-muted sm:text-sm">
          {replayYear < lastYear ? (
            <>No {activeMode === "fired" ? "fired moments" : "context items"} for {country} by {replayYear}. Advance the scrubber or press Play.</>
          ) : !hasCells ? (
            <>No genome counts recorded for {country}. Unsampled is not zero prevalence.</>
          ) : (
            <>
              Zero {activeMode === "fired" ? "fired alerts" : "context moments"} match this filter in {country}. Try switching triggers or viewing{" "}
              <button
                type="button"
                onClick={() => setMode(activeMode === "fired" ? "context" : "fired")}
                className="font-medium text-drug underline underline-offset-2"
              >
                {activeMode === "fired" ? "Near-threshold / Context" : "Fired"}
              </button>
              .
            </>
          )}
        </div>
      ) : (
        <ol className="mt-2.5 max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
          {shown.map((e) => {
            const copy = eventCopy(e, watch, markerLabel, country);
            const selected = e.id === selectedId;
            const flag = flagFor(e);
            const fresh = freshYear === e.year && e.fired;

            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelect(e.id)}
                  aria-current={selected ? "true" : undefined}
                  className={`group grid w-full grid-cols-[3.2rem_1.25rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors sm:grid-cols-[3.4rem_1.25rem_minmax(0,1fr)_auto_auto] ${
                    fresh ? css.fresh : ""
                  } ${
                    selected
                      ? "border-drug bg-[#16344a] shadow-[inset_3px_0_0_#70e0ca]"
                      : e.fired
                        ? "border-[#ffffff1a] bg-[#050d17]/65 hover:border-[#ffffff40] hover:bg-[#16344a]/60"
                        : "border-transparent bg-[#050d17]/35 hover:border-[#ffffff24] hover:bg-[#16344a]/40"
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-fg tabular-nums">
                    {e.year}
                  </span>

                  <span className={e.fired ? "text-signal" : "text-muted"}>
                    <KindGlyph event={e} size={16} quiet={!e.fired} />
                  </span>

                  <span className="min-w-0">
                    <span
                      className={`block truncate text-xs sm:text-sm ${
                        e.fired || selected ? "font-semibold text-fg" : "text-[#c4cdd6]"
                      }`}
                    >
                      {copy.title}
                    </span>
                    {flag ? (
                      <span className="mt-0.5 block truncate font-mono text-xs text-muted">
                        {flag}
                      </span>
                    ) : null}
                  </span>

                  <span className="text-right font-mono text-xs font-semibold text-fg tabular-nums">
                    {observedMetric(e)}
                  </span>

                  <span
                    className={`hidden items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs sm:inline-flex ${SOURCE_BADGE_TONE[e.source]}`}
                  >
                    <SourceGlyph source={e.source} size={10} />
                    {SHORT_SOURCE[e.source]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
