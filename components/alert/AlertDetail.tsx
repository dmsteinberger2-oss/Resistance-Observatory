"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AlertEvent, Cell, Watch, WhoBasis } from "@/lib/alert/derive";
import { enaUrl, methodText } from "@/lib/alert/context";
import { composeAlert, composeEmail } from "@/lib/alert/compose";
import {
  BAND_LABEL,
  BAND_RULE,
  KIND_LABEL,
  SOURCE_LABEL,
  ci,
  frac,
  pct,
} from "@/lib/alert/copy";
import { type ClientPack, type MarkerDef, type Paper } from "@/lib/alert/pack";
import {
  PRESET_BADGE,
  SOURCES,
  pubmedUrl,
  statText,
  type EmailExtras,
  type ReceiptSection,
} from "@/lib/alert/receipt";
import { eventIdFor, getDefaultMapAlerts } from "@/lib/alert/mapAlerts";
import {
  buildPermalinkPath,
  buildQualityLedger,
  type QualityLedger,
} from "@/lib/alert/quality";
import { FidelityInspector } from "./FidelityInspector";
import { KindGlyph, SourceGlyph } from "./glyphs";
import { DEMO_EMAIL } from "./SendTestAlert";
import css from "./alert.module.css";

/* -------------------------------------------------------------- receipt --- */

const BADGE_TONE = {
  who: "border-drug/60 bg-drug-soft/50 text-drug",
  checked: "border-drug/60 bg-drug-soft/50 text-drug",
  preset: "border-[#ffffff29] bg-[#16344a]/60 text-[#c4cdd6]",
  unverified: "border-signal/60 bg-signal-soft/50 text-signal",
} as const;

export function Receipt({ sections }: { sections: ReceiptSection[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#ffffff24] bg-[#050d17]">
      <p className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[#ffffff24] px-3.5 py-2.5 font-mono text-xs uppercase tracking-[0.14em]">
        <span className="font-semibold text-fg">Decision Receipt</span>
        <span className="normal-case tracking-normal text-muted">
          Every count, threshold &amp; citation ID
        </span>
      </p>
      {sections.map((s) => (
        <div
          key={s.title}
          className="border-b border-dashed border-[#ffffff1f] px-3.5 py-3 last:border-b-0"
        >
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-muted">
            {s.title}
          </p>
          <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-[8.5rem_minmax(0,1fr)] tabular-nums">
            {s.rows.map((r, i) => (
              <div key={i} className="contents">
                <dt className="font-mono text-xs text-muted">{r.label}</dt>
                <dd className="min-w-0 break-words text-[#c4cdd6]">
                  {r.text}{" "}
                  {r.badge ? (
                    <span
                      className={`mr-1 inline-block rounded-full border px-2 py-0.5 font-mono text-xs ${BADGE_TONE[r.badge.tone]}`}
                    >
                      {r.badge.text}
                    </span>
                  ) : null}
                  {r.links?.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mr-2 whitespace-nowrap font-mono text-xs text-drug underline underline-offset-2"
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- detail --- */

type InspectorTab = "signal" | "fidelity" | "dispatch";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "signal", label: "Signal & Study" },
  { id: "fidelity", label: "Graph Fidelity & Errors" },
  { id: "dispatch", label: "Email & Permalink" },
];

type Props = {
  event: AlertEvent;
  watch: Watch;
  marker: MarkerDef;
  country: string;
  basis: WhoBasis;
  pack: ClientPack;
  cells: Cell[];
  papers: Map<string, Paper>;
  ledger?: QualityLedger;
  asOfLine: string;
  emailConfigured: boolean | null;
  emailFrom: string | null;
  links: { forecast: string; learn: string };
};

export function AlertDetail(p: Props) {
  const { event: e, watch, marker, country, basis, pack } = p;
  const [activeTab, setActiveTab] = useState<InspectorTab>("signal");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const ledger = useMemo(
    () => p.ledger ?? buildQualityLedger(pack, watch.area, country),
    [p.ledger, pack, watch.area, country],
  );

  const composed = useMemo(
    () =>
      composeAlert({
        e,
        watch,
        marker,
        country,
        basis,
        pack,
        cells: p.cells,
        papers: p.papers,
      }),
    [e, watch, marker, country, basis, pack, p.cells, p.papers],
  );
  const {
    copy,
    tb,
    lim,
    paper,
    figure,
    stakes,
    graphFinding,
    graphLine,
    ctx,
    receipt,
  } = composed;

  const matchedMapAlert = useMemo(
    () =>
      getDefaultMapAlerts().find(
        (a) => a.marker_id === marker.urlId && eventIdFor(a) === e.id,
      ),
    [marker.urlId, e.id],
  );

  const permalinkPath = useMemo(
    () =>
      buildPermalinkPath({
        alertId: matchedMapAlert?.id,
        markerUrlId: marker.urlId,
        area: watch.area,
        trig: watch.trigger,
        level: watch.level,
        findingId: e.id,
      }),
    [matchedMapAlert?.id, marker.urlId, watch.area, watch.trigger, watch.level, e.id],
  );

  const [origin, setOrigin] = useState("");
  const [link, setLink] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    setLink(window.location.href);
  }, [e.id, permalinkPath]);

  const fullPermalink = origin ? `${origin}${permalinkPath}` : permalinkPath;

  const email = useMemo(() => {
    const extras: (EmailExtras & { permalinkUrl?: string }) | undefined = origin
      ? {
          permalinkUrl: `${origin}${permalinkPath}`,
          links: [
            {
              label: "See this country on the Map",
              url: new URL(p.links.forecast, origin).toString(),
            },
          ],
        }
      : undefined;
    return composeEmail(composed, {
      e,
      watch,
      marker,
      country,
      link,
      asOf: p.asOfLine,
      extras,
    });
  }, [composed, e, watch, marker, country, link, p.asOfLine, origin, permalinkPath, p.links.forecast]);

  const handleTabKeyDown = (idx: number, ev: React.KeyboardEvent) => {
    let nextIdx: number | null = null;
    if (ev.key === "ArrowRight") nextIdx = (idx + 1) % TABS.length;
    else if (ev.key === "ArrowLeft") nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (ev.key === "Home") nextIdx = 0;
    else if (ev.key === "End") nextIdx = TABS.length - 1;
    if (nextIdx !== null) {
      ev.preventDefault();
      setActiveTab(TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  const th = pack.thresholds;
  const v = th.who_categories?.verbatim;
  const esa = basis === "east_southern_africa";

  return (
    <article
      aria-label={`Alert inspector: ${copy.title}`}
      className="overflow-hidden rounded-xl border border-[#ffffff20] bg-[#0d2233] shadow-[0_24px_64px_#03091280]"
    >
      {/* 3-TAB BAR */}
      <div
        role="tablist"
        aria-label="Alert inspector views"
        className="grid grid-cols-3 border-b border-[#ffffff1f] bg-[#050d17]/75 px-2 pt-2"
      >
        {TABS.map((t, idx) => {
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`inspector-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={isSelected}
              aria-controls={`inspector-panel-${t.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(t.id)}
              onKeyDown={(ev) => handleTabKeyDown(idx, ev)}
              className={`relative flex items-center justify-center gap-1.5 rounded-t-lg px-2 py-2.5 text-xs font-semibold transition-colors ${
                isSelected
                  ? "border-x border-t border-[#ffffff24] bg-[#0d2233] text-fg shadow-[inset_0_2px_0_#70e0ca]"
                  : "text-muted hover:bg-[#16344a]/40 hover:text-fg"
              }`}
            >
              <span className="truncate">{t.label}</span>
              {t.id === "fidelity" && ledger.errorFindings.length > 0 ? (
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-signal-soft px-1 font-mono text-xs text-signal tabular-nums">
                  {ledger.errorFindings.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* PANEL 1: SIGNAL & STUDY */}
      <div
        id="inspector-panel-signal"
        role="tabpanel"
        aria-labelledby="inspector-tab-signal"
        hidden={activeTab !== "signal"}
        className="space-y-4 p-4 sm:p-5"
      >
        {/* Header + Action Strip */}
        <header>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${
                e.fired
                  ? "border-signal/60 bg-signal-soft/75 text-signal"
                  : "border-[#ffffff29] bg-[#16344a]/60 text-muted"
              }`}
            >
              <KindGlyph event={e} size={13} quiet={!e.fired} />
              {e.fired ? "Alert Fired" : "Near-threshold / Context"}
            </span>
            <span className="inline-flex items-center gap-1 text-[#c4cdd6]">
              <SourceGlyph source={e.source} size={11} />
              {SOURCE_LABEL[e.source]}
            </span>
            <span className="text-muted">·</span>
            <span className="font-semibold text-fg">
              {e.dateBasis === "collection" ? "Collected" : "Published"} {e.year}
            </span>
          </div>

          <h2 className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight text-fg sm:text-2xl">
            {marker.label} · {country}: {copy.title}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Molecular marker associated with{" "}
            <strong className="font-medium text-drug">{marker.drug}</strong> susceptibility ·{" "}
            {KIND_LABEL[e.kind]}
          </p>

          {/* Prominent Action Strip */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={p.links.forecast}
              className="inline-flex items-center gap-1.5 rounded-lg border border-drug/60 bg-drug-soft px-3.5 py-1.5 text-xs font-semibold text-drug transition-colors hover:border-drug hover:bg-[#18484d]"
            >
              See on map →
            </Link>
            <Link
              href={permalinkPath}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#ffffff2e] bg-[#050d17]/80 px-3.5 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-[#ffffff55] hover:bg-[#16344a]"
            >
              Permalink ↗
            </Link>
            <button
              type="button"
              onClick={() => setActiveTab("fidelity")}
              className="inline-flex items-center gap-1 rounded-lg border border-[#ffffff1f] bg-[#050d17]/50 px-3 py-1.5 text-xs font-medium text-[#c4cdd6] transition-colors hover:border-signal/50 hover:text-signal"
            >
              Audit graph fidelity ({ledger.errorFindings.length} errors) →
            </button>
          </div>
        </header>

        {/* Observed vs. Cutoff Hero Metric Strip */}
        <section
          aria-label="Observed prevalence versus active cutoff"
          className="grid gap-2.5 sm:grid-cols-2"
        >
          <div className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-3.5 tabular-nums">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
              Observed Signal
            </p>
            {e.cell ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-fg">
                  {pct(e.cell.pct)}{" "}
                  <span className="font-mono text-xs font-normal text-[#c4cdd6]">
                    ({e.cell.x}/{e.cell.n} samples)
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  95% Wilson CI {e.cell.ci.lo.toFixed(1)}–{e.cell.ci.hi.toFixed(1)}%
                </p>
                {e.prev ? (
                  <p className="mt-1 text-xs text-[#c4cdd6]">
                    Prior cell ({e.prev.year}): {pct(e.prev.pct)} ({e.prev.x}/{e.prev.n})
                  </p>
                ) : null}
              </>
            ) : figure && figure.prevalence_pct != null ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-drug">
                  {figure.prevalence_pct.toFixed(1)}%{" "}
                  <span className="font-mono text-xs font-normal text-[#c4cdd6]">
                    stated in abstract
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {figure.numerator != null && figure.denominator != null
                    ? `${figure.numerator}/${figure.denominator} samples · `
                    : ""}
                  unpooled paper figure
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm font-semibold text-fg">
                  {e.source === "graph" ? "System Graph Association" : "Published Paper Claim"}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {graphFinding
                    ? statText(graphFinding) || graphFinding.system_id
                    : e.pmid
                      ? `PMID ${e.pmid} · machine-quoted`
                      : "Qualitative evidence"}
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-3.5 tabular-nums">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                Active Cutoff &amp; Prior
              </p>
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                  tb.published
                    ? "border-drug/50 bg-drug-soft/70 text-drug"
                    : "border-[#ffffff29] bg-[#16344a] text-[#c4cdd6]"
                }`}
              >
                {tb.published
                  ? "Published by WHO"
                  : watch.trigger === "first_detection"
                    ? "Any positive"
                    : PRESET_BADGE}
              </span>
            </div>

            <p className="mt-1 text-sm font-semibold text-fg">
              {ctx ? ctx.cutoff.short : tb.text}
            </p>
            {ctx?.relation ? (
              <p className="mt-0.5 text-xs text-[#c4cdd6]">{ctx.relation}</p>
            ) : e.band ? (
              <p className="mt-0.5 font-mono text-xs text-muted">
                {BAND_LABEL[e.band]} band ({BAND_RULE[e.band]})
              </p>
            ) : null}

            {/* Local Prior Badge */}
            {ctx ? (
              <div className="mt-2 border-t border-[#ffffff14] pt-2">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium ${
                    ctx.prior.kind === "zero"
                      ? "border-signal/60 bg-signal-soft/75 text-signal"
                      : "border-drug/50 bg-drug-soft/60 text-drug"
                  }`}
                >
                  {ctx.prior.kind === "zero"
                    ? "⚠ Zero local prior — higher verification bar"
                    : "✓ Established presence"}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {/* Statement & Quote */}
        <div className="rounded-xl border border-[#ffffff18] bg-[#050d17]/55 p-3.5 text-xs leading-relaxed text-[#c4cdd6] sm:text-sm">
          <p className="text-fg">
            {e.quote ? copy.statement.split(" Its abstract says:")[0] : copy.statement}
          </p>
          {e.quote ? (
            <blockquote className={`mt-2.5 text-xs ${css.quote}`}>
              “{e.quote}”
            </blockquote>
          ) : null}
          <p className="mt-2 text-xs text-muted">{copy.basis}</p>
        </div>

        {/* Triggering-Study Provenance Card (Clean 4-Row Metadata Ledger) */}
        <section
          aria-labelledby="prov-h"
          className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-3.5"
        >
          <h3
            id="prov-h"
            className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-fg"
          >
            Triggering-Study Provenance Ledger
          </h3>

          {ctx?.cell ? (
            <dl className="mt-2.5 divide-y divide-[#ffffff14] text-xs tabular-nums">
              {/* Row 1: Partner study IDs */}
              <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">Partner studies</dt>
                <dd className="font-mono text-xs text-fg">
                  {ctx.cell.studies
                    .map((s) => `${s.study_id} (${s.k}/${s.n}, ${s.pct}%)`)
                    .join(" · ")}
                </dd>
              </div>

              {/* Row 2: Geographic scope & clustering */}
              <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">Geo scope</dt>
                <dd className="text-[#c4cdd6]">
                  {ctx.geo?.flag ? (
                    <span className="mr-1.5 inline-block rounded border border-signal/60 bg-signal-soft/75 px-1.5 py-0.5 font-mono text-xs font-medium text-signal">
                      ⚠ {ctx.geo.flag}
                    </span>
                  ) : null}
                  <span>{ctx.geo?.text ?? "Admin-1 breakdown not recorded."}</span>
                </dd>
              </div>

              {/* Row 3: DNA method & % genome callable + ENA links */}
              <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">DNA &amp; callable</dt>
                <dd className="space-y-1 text-[#c4cdd6]">
                  <p>
                    <strong className="font-medium text-fg">
                      {methodText(ctx.cell.dna_method_all)}
                    </strong>
                    {ctx.cell.k > 0
                      ? ` (${marker.mutation}-positive: ${methodText(ctx.cell.dna_method_mutants)})`
                      : ""}
                    {" · "}
                    {ctx.measure?.callable}
                  </p>
                  {ctx.runs.length > 0 ? (
                    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs">
                      <span className="text-muted">ENA sample runs:</span>
                      {ctx.runs.map((r) => (
                        <a
                          key={r.sample}
                          href={enaUrl(r.ena!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-drug underline underline-offset-2"
                        >
                          {r.ena} ({r.dna_method}) ↗
                        </a>
                      ))}
                    </p>
                  ) : null}
                </dd>
              </div>

              {/* Row 4: Codon 540 alleles */}
              <div className="grid grid-cols-1 gap-1 pt-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">Codon 540 alleles</dt>
                <dd className="space-y-1 text-[#c4cdd6]">
                  <p>{ctx.codon?.text}</p>
                  {ctx.codon?.altWarning ? (
                    <p className="rounded-md border border-signal/60 bg-signal-soft/60 px-2.5 py-1.5 text-xs text-signal">
                      ⚠ {ctx.codon.altWarning}
                    </p>
                  ) : null}
                </dd>
              </div>
            </dl>
          ) : (
            <dl className="mt-2.5 divide-y divide-[#ffffff14] text-xs tabular-nums">
              <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">Publication</dt>
                <dd className="text-fg">
                  {paper ? `${paper.title} (${paper.pub_year})` : graphFinding?.paper_title ?? `Published ${e.year}`}
                  {e.pmid ? (
                    <>
                      {" · "}
                      <a
                        href={paper?.url ?? pubmedUrl(e.pmid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-drug underline underline-offset-2"
                      >
                        PMID {e.pmid} ↗
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">Study scope</dt>
                <dd className="text-[#c4cdd6]">
                  {figure?.site ? `Site: ${figure.site} · ` : ""}
                  {figure?.population
                    ? `Population: ${figure.population}`
                    : graphFinding?.study_type ?? "Machine-read abstract / graph record"}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">Graph coverage</dt>
                <dd className="text-[#c4cdd6]">{graphLine}</dd>
              </div>
              <div className="grid grid-cols-1 gap-1 pt-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-xs text-muted">Clinical context</dt>
                <dd className="text-[#c4cdd6]">
                  {stakes.lead[0]
                    ? `${stakes.lead[0].variable_1} ↔ ${stakes.lead[0].variable_2} (${statText(stakes.lead[0])})`
                    : `${marker.label} is associated with ${marker.drug} susceptibility.`}
                </dd>
              </div>
            </dl>
          )}
        </section>

        {/* Reviewer Next Step & Limits */}
        <section
          aria-labelledby="next-h"
          className="rounded-xl border border-[#ffffff18] bg-[#050d17]/60 p-3.5 text-xs"
        >
          <h3
            id="next-h"
            className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-drug"
          >
            Reviewer Next Step &amp; Interpretive Limits
          </h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed text-[#c4cdd6]">
            <li>
              <strong className="font-medium text-fg">TES / CES clinical check:</strong>{" "}
              {ctx?.prior.steps[1] ??
                "Confirm molecular shifts via WHO therapeutic efficacy studies (TES) or chemoprevention efficacy studies (CES)."}
            </li>
            <li>
              <strong className="font-medium text-fg">Association, not causation:</strong>{" "}
              {marker.label} is associated with reduced susceptibility to {marker.drug}; marker
              counts in convenience samples do not establish clinical failure on their own.
            </li>
            {esa && v?.continue_quote ? (
              <li>
                <strong className="font-medium text-fg">WHO IPTp-SP guidance:</strong> SP in
                pregnancy continues even in high-prevalence settings ({v.continue_where}).
              </li>
            ) : null}
            <li>
              <strong className="font-medium text-fg">Historical snapshot replay:</strong>{" "}
              {lim[0]} {p.asOfLine}
            </li>
          </ul>

          {/* Collapsible Full Citations & Decision Receipt */}
          <details className="mt-3 border-t border-[#ffffff14] pt-2.5">
            <summary className="cursor-pointer font-mono text-xs font-medium text-fg hover:text-drug">
              Full Source Citations &amp; Decision Receipt (DOIs, PMIDs, ENA &amp; WHO pages)
            </summary>
            <div className="mt-3 space-y-2.5">
              <Receipt sections={receipt} />
              <p className="font-mono text-xs text-muted">
                Primary genome archive:{" "}
                <a
                  href={SOURCES.pf8.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-drug underline underline-offset-2"
                >
                  {SOURCES.pf8.label} ↗
                </a>
              </p>
            </div>
          </details>
        </section>
      </div>

      {/* PANEL 2: GRAPH FIDELITY & ERRORS */}
      <div
        id="inspector-panel-fidelity"
        role="tabpanel"
        aria-labelledby="inspector-tab-fidelity"
        hidden={activeTab !== "fidelity"}
        className="p-4 sm:p-5"
      >
        <FidelityInspector ledger={ledger} marker={marker} country={country} />
      </div>

      {/* PANEL 3: EMAIL & PERMALINK */}
      <div
        id="inspector-panel-dispatch"
        role="tabpanel"
        aria-labelledby="inspector-tab-dispatch"
        hidden={activeTab !== "dispatch"}
        className="space-y-4 p-4 sm:p-5"
      >
        <PermalinkCard
          permalinkPath={permalinkPath}
          fullPermalink={fullPermalink}
          forecastHref={p.links.forecast}
        />

        <EmailPanel
          key={e.id}
          subject={email.subject}
          text={email.text}
          html={email.html}
          configured={p.emailConfigured}
          from={p.emailFrom}
        />
      </div>
    </article>
  );
}

/* ----------------------------------------------------------- permalink --- */

function PermalinkCard({
  permalinkPath,
  fullPermalink,
  forecastHref,
}: {
  permalinkPath: string;
  fullPermalink: string;
  forecastHref: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullPermalink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: URL is selectable right in the box */
    }
  };

  return (
    <section
      aria-labelledby="permalink-h"
      className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-4"
    >
      <p
        id="permalink-h"
        className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-drug"
      >
        Permanent Dispatch Permalink
      </p>
      <p className="mt-1 text-xs text-[#c4cdd6]">
        Shareable standalone dispatch receipt with frozen provenance, WHO threshold basis, and
        quarantined graph audit.
      </p>

      <div className="mt-2.5 overflow-x-auto rounded-lg border border-[#ffffff24] bg-[#0d2233] px-3 py-2 font-mono text-xs text-fg">
        {fullPermalink}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-drug/60 bg-drug-soft px-3.5 py-1.5 text-xs font-semibold text-drug transition-colors hover:border-drug"
        >
          <span aria-live="polite">{copied ? "Copied ✓" : "Copy Permalink"}</span>
        </button>

        <Link
          href={permalinkPath}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#ffffff2e] bg-[#0d2233] px-3.5 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-[#ffffff55] hover:bg-[#16344a]"
        >
          Open Permalink Page ↗
        </Link>

        <Link
          href={forecastHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#ffffff1f] bg-[#0d2233]/60 px-3 py-1.5 text-xs font-medium text-[#c4cdd6] transition-colors hover:border-drug/50 hover:text-drug"
        >
          See this country on the Map →
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- email --- */

type SendState =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "sent"; id: string; to: string }
  | { s: "error"; message: string };

function EmailPanel({
  subject,
  text,
  html,
  configured,
  from,
}: {
  subject: string;
  text: string;
  html: string;
  configured: boolean | null;
  from: string | null;
}) {
  const [to, setTo] = useState(DEMO_EMAIL);
  const [state, setState] = useState<SendState>({ s: "idle" });
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    if (!configured) return;
    setState({ s: "sending" });
    try {
      const res = await fetch("/api/alert/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject, text, html }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
        to?: string;
      };
      if (json.ok && json.id) setState({ s: "sent", id: json.id, to: json.to ?? to });
      else setState({ s: "error", message: json.error ?? `HTTP ${res.status}` });
    } catch (err) {
      setState({ s: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <section
      className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-4"
      aria-label="Send this alert via email"
    >
      <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-fg">
        Send This Alert via Email (Resend)
      </h3>

      <p className="mt-2 rounded-lg border border-[#ffffff18] bg-[#0d2233]/75 px-3 py-2 text-xs leading-relaxed text-[#c4cdd6]">
        <span className="font-mono text-xs text-muted">Subject: </span>
        <span className="text-fg">{subject}</span>
      </p>

      <form onSubmit={send} className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="alert-email-to">
          Recipient email address
        </label>
        <input
          id="alert-email-to"
          type="email"
          required
          value={to}
          onChange={(ev) => setTo(ev.target.value)}
          placeholder="you@institute.org"
          disabled={!configured}
          className="h-9 min-w-[12rem] flex-1 rounded-lg border border-[#ffffff2e] bg-[#0d2233] px-3 text-xs text-fg placeholder:text-muted focus:border-drug focus:outline-none disabled:opacity-50 sm:text-sm"
        />
        <button
          type="submit"
          disabled={!configured || state.s === "sending"}
          className="h-9 rounded-lg bg-signal px-4 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40 sm:text-sm"
        >
          {configured === null
            ? "Checking…"
            : !configured
              ? "Preview only"
              : state.s === "sending"
                ? "Sending…"
                : "Send Dispatch"}
        </button>
      </form>

      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {configured === false ? (
          "No Resend key configured on this server; expand the preview below to inspect the exact HTML and plain-text dispatch."
        ) : state.s === "sent" ? (
          <span className="text-drug">
            ✓ Sent · Resend ID <span className="font-mono">{state.id}</span> · to {state.to}
          </span>
        ) : state.s === "error" ? (
          <span className="text-signal">Not sent: “{state.message}”</span>
        ) : configured ? (
          `Dispatched via Resend from ${from ?? "configured sender"}.`
        ) : null}
      </p>

      {/* Collapsible Email Preview */}
      <details className="mt-3 border-t border-[#ffffff14] pt-2.5">
        <summary className="cursor-pointer font-mono text-xs font-medium text-[#c4cdd6] hover:text-fg">
          Preview Email (HTML / Plain Text)
        </summary>
        <div className="mt-2.5">
          <div
            className="mb-2 inline-flex rounded-lg border border-[#ffffff24] bg-[#0d2233] p-0.5 text-xs"
            role="group"
            aria-label="Email preview format"
          >
            <button
              type="button"
              onClick={() => setPreviewMode("html")}
              aria-pressed={previewMode === "html"}
              className={`rounded-md px-2.5 py-1 font-medium ${
                previewMode === "html" ? "bg-[#16344a] text-fg" : "text-muted hover:text-fg"
              }`}
            >
              HTML Preview
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("text")}
              aria-pressed={previewMode === "text"}
              className={`rounded-md px-2.5 py-1 font-medium ${
                previewMode === "text" ? "bg-[#16344a] text-fg" : "text-muted hover:text-fg"
              }`}
            >
              Plain Text
            </button>
          </div>

          {previewMode === "html" ? (
            <iframe
              title="Email HTML preview"
              sandbox=""
              srcDoc={`<body style="margin:0;background:#050d17">${html}</body>`}
              className="h-[24rem] w-full rounded-lg border border-[#ffffff1f] bg-[#050d17]"
            />
          ) : (
            <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-lg border border-[#ffffff1f] bg-[#0d2233] p-3 font-mono text-xs leading-relaxed text-[#c4cdd6]">
              {text}
            </pre>
          )}
        </div>
      </details>
    </section>
  );
}
