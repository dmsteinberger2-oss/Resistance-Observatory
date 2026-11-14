"use client";

import { useState } from "react";
import Link from "next/link";
import type { AlertEvent, Watch, WhoBasis } from "@/lib/alert/derive";
import type { Composed } from "@/lib/alert/compose";
import { BAND_LABEL, BAND_RULE, KIND_LABEL, SOURCE_LABEL, ci, frac, pct } from "@/lib/alert/copy";
import { NEXT_STEPS_NOTE, enaUrl } from "@/lib/alert/context";
import type { MarkerDef } from "@/lib/alert/pack";
import { GRAPH_RELEASE, PRESET_BADGE, SOURCES, pubmedUrl } from "@/lib/alert/receipt";
import type { ScoredFinding } from "@/lib/alert/quality";

export type DispatchViewProps = {
  composed: Composed;
  event: AlertEvent;
  watch: Watch;
  marker: MarkerDef;
  country: string;
  basis: WhoBasis;
  alertId: string | null;
  permalinkPath: string;
  observatoryHref: string;
  mapHref: string;
  asOfLine: string;
};

const BADGE_TONE = {
  who: "border-drug/60 bg-drug-soft/60 text-drug",
  checked: "border-drug/60 bg-drug-soft/60 text-drug",
  preset: "border-signal/60 bg-signal-soft/60 text-signal",
  unverified: "border-line-strong bg-surface-2 text-muted",
} as const;

function AuditFindingCard({ f, area }: { f: ScoredFinding; area: string }) {
  const isLocal = f.countryIso3 === area;
  const isError = f.tier === "contradicted_error";
  const isClean = f.tier === "high_precision_trial" || f.tier === "verified_cohort";

  return (
    <li
      className={`rounded-lg border p-3.5 text-sm ${
        isError
          ? "border-signal/50 bg-signal-soft/30"
          : isClean
            ? "border-line-strong bg-surface"
            : "border-line bg-bg/70"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[0.68rem]">
          <span
            className={`rounded-full border px-2 py-0.5 font-semibold ${
              isError
                ? "border-signal/70 text-signal"
                : f.tier === "high_precision_trial"
                  ? "border-drug/70 text-drug"
                  : isClean
                    ? "border-drug/40 text-fg"
                    : "border-line-strong text-muted"
            }`}
          >
            {isError ? "✕ " : isClean ? "✓ " : "○ "}
            {f.tierLabel}
          </span>
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-body">
            {f.studyType}
          </span>
          <span className="rounded-full border border-line px-2 py-0.5 text-muted">
            {f.use}
          </span>
          {f.countryName ? (
            <span
              className={`rounded-full border px-2 py-0.5 ${
                isLocal ? "border-drug/60 bg-drug-soft/50 font-semibold text-drug" : "border-line text-muted"
              }`}
            >
              {f.countryName}
              {isLocal ? " · local" : ""}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 font-mono text-[0.68rem] tabular-nums text-muted">
          <span>Fidelity {f.fidelityScore}/100</span>
          {f.se !== null ? <span>· SE {f.se.toFixed(2)}</span> : null}
          {f.precision !== null ? <span>· 1/SE {f.precision.toFixed(1)}</span> : null}
        </div>
      </div>

      <p className="mt-2 font-medium leading-snug text-fg">{f.pairLabel}</p>
      <p className="mt-1 font-mono text-xs font-semibold text-drug tabular-nums">{f.statLabel}</p>

      {f.actualPaperSays ? (
        <p className="mt-2 rounded border border-signal/40 bg-bg/80 px-2.5 py-2 text-xs leading-relaxed text-body">
          <strong className="text-signal">Source-paper verification: </strong>
          {f.actualPaperSays}
        </p>
      ) : f.exclusionReason ? (
        <p className="mt-1.5 text-xs text-muted">
          <strong className="text-body">Filter reason: </strong>
          {f.exclusionReason}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.68rem] text-muted">
        <span>system_id {f.systemId}</span>
        {f.year ? <span>published {f.year}</span> : null}
        <span>{f.inVettedCsv ? "in vetted CSV" : "API unvetted"}</span>
        {f.pmid ? (
          <a
            href={f.pubmedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-drug underline underline-offset-2 hover:opacity-90"
          >
            PMID {f.pmid} ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}

export function DispatchView({
  composed,
  event: e,
  watch,
  marker,
  country,
  basis,
  alertId,
  permalinkPath,
  observatoryHref,
  mapHref,
  asOfLine,
}: DispatchViewProps) {
  const [copied, setCopied] = useState(false);
  const [auditTab, setAuditTab] = useState<"clean" | "errors" | "noise">("clean");

  const { copy, tb, lim, paper, figure, graphFinding, graphLine, whoStatus, ctx, receipt, quality } = composed;
  const esa = basis === "east_southern_africa";
  const dispatchCode = alertId ?? e.id;

  async function handleCopyPermalink() {
    try {
      const targetUrl =
        typeof window !== "undefined" ? window.location.href : permalinkPath;
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  const cutoffVal = ctx?.cutoff.value ?? (watch.trigger === "rise" || watch.trigger === "fall" ? watch.level : null);
  const cutoffPublished = ctx?.cutoff.published ?? tb.published;
  const authorityLabel = cutoffPublished
    ? "Published by WHO"
    : watch.trigger === "first_detection"
      ? "Project early-warning rule"
      : PRESET_BADGE;

  const shownAuditFindings: ScoredFinding[] =
    auditTab === "clean"
      ? quality.cleanFindings.slice(0, 8)
      : auditTab === "errors"
        ? quality.errorFindings.slice(0, 10)
        : quality.noisyFindings.slice(0, 8);

  return (
    <div className="learn-top min-h-[calc(100dvh-76px)] bg-bg text-fg print:bg-white print:text-black">
      {/* Top Archival Bar */}
      <div className="border-b border-line-strong bg-surface/95 backdrop-blur print:border-b print:bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-drug/60 bg-drug-soft/70 px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold tracking-wider text-drug">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-drug" />
              FROZEN ARCHIVAL SNAPSHOT
            </span>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
              PERMANENT EVIDENCE DISPATCH · SNAPSHOT FROZEN FROM SYSTEM PUBLIC GRAPH v2.1 (1 JULY 2026)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleCopyPermalink}
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                copied
                  ? "border-drug bg-drug text-bg"
                  : "border-drug/60 bg-drug-soft/70 text-drug hover:border-drug"
              }`}
            >
              <span>{copied ? "Copied ✓" : "Copy Permalink"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-fg/60"
            >
              Print / Save PDF
            </button>

            <Link
              href={mapHref}
              className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:bg-surface-2"
            >
              See this country on the Map (as of {e.year}) →
            </Link>

            <Link
              href={observatoryHref}
              className="inline-flex items-center gap-1 rounded-lg border border-signal/60 bg-signal-soft/60 px-3 py-1.5 text-xs font-semibold text-signal transition-colors hover:border-signal"
            >
              Open Interactive Alert Observatory →
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {/* Executive Header & Hero Observed vs Cutoff */}
        <section
          aria-labelledby="dispatch-headline"
          className="rounded-xl border border-line-strong bg-surface p-5 shadow-[var(--shadow)] sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
              <span className="text-signal">{KIND_LABEL[e.kind]}</span>
              <span aria-hidden>·</span>
              <span className="text-drug">{SOURCE_LABEL[e.source]}</span>
              <span aria-hidden>·</span>
              <span>
                {e.dateBasis === "collection" ? "collected" : "published"} {e.year}
              </span>
              {e.strength ? (
                <span className="rounded-full border border-signal/60 bg-signal-soft/50 px-2 py-0.5 text-[0.68rem] normal-case tracking-normal text-signal">
                  {e.strength === "strong" ? "strong signal" : e.strength === "weak" ? "weak signal" : "signal"}
                </span>
              ) : null}
              {!e.fired ? (
                <span className="rounded-full border border-line-strong px-2 py-0.5 text-[0.68rem] normal-case tracking-normal text-muted">
                  context record
                </span>
              ) : null}
            </p>
            <span className="rounded border border-line bg-bg/70 px-2.5 py-1 font-mono text-[0.7rem] text-muted">
              Dispatch ID: <strong className="text-fg">{dispatchCode}</strong>
            </span>
          </div>

          <h1
            id="dispatch-headline"
            className="mt-2.5 font-display text-2xl font-semibold tracking-tight text-fg sm:text-4xl"
          >
            {marker.label}, {country}: {copy.title}
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-body sm:text-base">
            Molecular surveillance dispatch for <strong className="text-fg">{marker.label}</strong> ({marker.gene}{" "}
            codon 540), a parasite marker associated with reduced susceptibility to{" "}
            <strong className="text-drug">{marker.drug}</strong>. {copy.statement}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            <strong className="text-body">Comparison basis:</strong> {copy.basis}
          </p>

          {/* 3-Column Hero Telemetry Strip */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {/* Column 1: Observed % + 95% Wilson CI */}
            <div className="rounded-lg border border-line-strong bg-bg/80 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                Observed {marker.mutation} Proportion
              </p>
              {e.cell ? (
                <>
                  <div className="mt-1.5 flex items-baseline gap-2.5 tabular-nums">
                    <span className="font-mono text-3xl font-bold text-fg">{pct(e.cell.pct)}</span>
                    <span className="font-mono text-sm text-drug">
                      ({e.cell.x} / {e.cell.n} genomes)
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs tabular-nums text-body">
                    Wilson {ci(e.cell)}
                  </p>
                  <div
                    role="img"
                    aria-label={`Observed ${pct(e.cell.pct)}, 95% Wilson confidence interval ${e.cell.ci.lo.toFixed(1)}% to ${e.cell.ci.hi.toFixed(1)}%${cutoffVal != null ? `, watch line at ${cutoffVal}%` : ""}`}
                    className="relative mt-3 h-3 w-full overflow-hidden rounded-full border border-line bg-surface-2"
                  >
                    <div
                      className="absolute top-0 bottom-0 rounded-full bg-drug/35"
                      style={{
                        left: `${Math.max(0, Math.min(100, e.cell.ci.lo))}%`,
                        width: `${Math.max(1.5, Math.min(100, e.cell.ci.hi - e.cell.ci.lo))}%`,
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-drug"
                      style={{ left: `${Math.max(0, Math.min(99, e.cell.pct))}%` }}
                    />
                    {cutoffVal != null ? (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-signal"
                        style={{ left: `${Math.max(0, Math.min(99.5, cutoffVal))}%` }}
                        title={`Watch line: ${cutoffVal}%`}
                      />
                    ) : null}
                  </div>
                  {e.prev ? (
                    <p className="mt-2 font-mono text-[0.7rem] tabular-nums text-muted">
                      Prior cell ({e.prev.year}): {frac(e.prev)} ({pct(e.prev.pct)})
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="mt-2">
                  <p className="font-mono text-lg font-semibold text-fg">
                    {e.statedPct != null ? `${e.statedPct}% (stated in abstract)` : SOURCE_LABEL[e.source]}
                  </p>
                  {e.quote ? (
                    <p className="mt-1.5 border-l-2 border-drug/60 pl-2.5 text-xs text-body">“{e.quote}”</p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Column 2: Cutoff & WHO Regional Authority */}
            <div className="rounded-lg border border-line-strong bg-bg/80 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                Watch Cutoff &amp; Authority
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold text-fg tabular-nums">
                {ctx?.cutoff.short ?? (cutoffVal != null ? `${cutoffVal}% line` : "Event rule")}
              </p>
              <p className="mt-1.5">
                <span
                  className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold ${
                    cutoffPublished ? BADGE_TONE.who : BADGE_TONE.preset
                  }`}
                >
                  {authorityLabel}
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-body">
                {ctx?.cutoff.text ?? tb.text}
                {ctx?.relation ? ` ${ctx.relation}` : ""}
              </p>
              {e.band ? (
                <p className="mt-1.5 font-mono text-[0.7rem] text-muted">
                  WHO band: <strong className="text-fg">{BAND_LABEL[e.band]}</strong> ({BAND_RULE[e.band]})
                </p>
              ) : null}
            </div>

            {/* Column 3: Local Prior & Reviewer Next Step */}
            <div className="rounded-lg border border-line-strong bg-bg/80 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                Local Prior &amp; Reviewer Next Step
              </p>
              <p className="mt-1.5 font-display text-lg font-semibold text-fg">
                {ctx?.prior.name ?? (e.prev ? "Prior record present" : "Baseline observation")}
              </p>
              {ctx ? (
                <p className="mt-1">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] ${
                      ctx.prior.kind === "zero" ? BADGE_TONE.preset : BADGE_TONE.checked
                    }`}
                  >
                    {ctx.prior.label}
                  </span>
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-body">
                {ctx?.prior.detail ??
                  `Confirm molecular signals for ${marker.drug} alongside WHO therapeutic efficacy studies (TES) and chemoprevention efficacy studies (CES).`}
              </p>
            </div>
          </div>

          {/* Ordered Reviewer Action Bar */}
          {ctx?.prior.steps.length ? (
            <div className="mt-4 rounded-lg border border-signal/40 bg-signal-soft/30 p-3.5 text-xs leading-relaxed text-body">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">
                Reviewer Verification Protocol (Before Any Policy Discussion)
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-fg">
                {ctx.prior.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="mt-1.5 text-[0.74rem] text-muted">{NEXT_STEPS_NOTE}</p>
            </div>
          ) : null}
        </section>

        {/* Triggering-Study Provenance Card */}
        <section
          aria-labelledby="dispatch-provenance"
          className="rounded-xl border border-line bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-drug">
                Section 1 · Primary Surveillance Provenance
              </p>
              <h2 id="dispatch-provenance" className="mt-1 font-display text-xl font-semibold text-fg">
                Triggering-Study Provenance ({SOURCE_LABEL[e.source]})
              </h2>
            </div>
            <a
              href={SOURCES.pf8.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-drug underline underline-offset-2"
            >
              {SOURCES.pf8.label} ↗
            </a>
          </div>

          {ctx?.cell ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-bg/70 p-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                  Partner Studies &amp; Subnational Sites
                </p>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-body">
                  {ctx.cell.studies.map((s) => (
                    <li key={s.study_id} className="rounded border border-line bg-surface p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-fg">
                        <span className="font-semibold">{s.study_id}</span>
                        <span className="text-drug tabular-nums">
                          {s.k}/{s.n} ({s.pct}%)
                        </span>
                      </div>
                      <p className="mt-1 text-muted">
                        Admin-1: {s.admin1.map((a) => `${a.name} (${a.k}/${a.n})`).join(", ") || "not recorded"}
                        {s.median_callable_pct != null ? ` · median ${s.median_callable_pct}% callable` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                {ctx.geo ? (
                  <p className="mt-3 text-xs leading-relaxed text-body">
                    {ctx.geo.flag ? (
                      <span className="mr-1.5 inline-block rounded-full border border-signal/60 bg-signal-soft/50 px-2 py-0.5 font-mono text-[0.66rem] text-signal">
                        ⚠ {ctx.geo.flag}
                      </span>
                    ) : null}
                    {ctx.geo.text}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-line bg-bg/70 p-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                  DNA Preparation, Callability &amp; Codon 540 Alleles
                </p>
                {ctx.measure ? (
                  <p className="mt-2 text-xs leading-relaxed text-body">
                    <strong className="text-fg">Genome callability:</strong> {ctx.measure.callable}.{" "}
                    {ctx.measure.note ?? ""}
                  </p>
                ) : null}
                {ctx.codon ? (
                  <div className="mt-2.5 rounded border border-line bg-surface p-2.5 font-mono text-xs text-fg">
                    <p>{ctx.codon.text}</p>
                    {ctx.codon.altWarning ? (
                      <p className="mt-1.5 text-signal">⚠ {ctx.codon.altWarning}</p>
                    ) : null}
                  </div>
                ) : null}

                {ctx.runs.length > 0 ? (
                  <div className="mt-3">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted">
                      European Nucleotide Archive (ENA) Raw Sequencing Runs
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ctx.runs.map((r) => (
                        <a
                          key={String(r.ena)}
                          href={enaUrl(String(r.ena))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-drug/50 bg-drug-soft/50 px-2.5 py-1 font-mono text-[0.7rem] text-drug hover:border-drug"
                        >
                          ENA {r.ena} ({r.dna_method}, {r.admin1}) ↗
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-line bg-bg/70 p-4 text-sm text-body">
              {paper ? (
                <p className="font-medium text-fg">
                  {paper.title} ({paper.journal ?? "Journal not recorded"}, {paper.pub_year})
                </p>
              ) : null}
              {figure ? (
                <p className="mt-1 font-mono text-xs text-muted">
                  Stated prevalence: {figure.prevalence_pct ?? "—"}% · site: {figure.site ?? "not stated"} · population:{" "}
                  {figure.population ?? "not stated"}
                </p>
              ) : null}
              {graphFinding ? (
                <p className="mt-1 font-mono text-xs text-drug">
                  System Public Graph association: system_id {graphFinding.system_id}
                </p>
              ) : null}
              {e.pmid ? (
                <p className="mt-2">
                  <a
                    href={pubmedUrl(e.pmid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs font-semibold text-drug underline underline-offset-2"
                  >
                    Read source paper on PubMed (PMID {e.pmid}) ↗
                  </a>
                </p>
              ) : null}
            </div>
          )}
        </section>

        {/* System Public Graph Fidelity & Quarantined-Errors Audit Summary */}
        <section
          aria-labelledby="dispatch-fidelity"
          className="rounded-xl border border-line-strong bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-drug">
                Section 2 · System Public Graph Precision &amp; Quarantine Audit
              </p>
              <h2 id="dispatch-fidelity" className="mt-1 font-display text-xl font-semibold text-fg">
                What Is at Stake for {marker.drug} &amp; Why Error Quarantine Matters
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                {graphLine} Precision-weighted grading and contested-extraction quarantine adapted from Knowledge Futures’{" "}
                <a
                  href={SOURCES.kfPrecision.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-drug underline underline-offset-2"
                >
                  System Hackathon
                </a>{" "}
                and{" "}
                <a
                  href={SOURCES.kfContested.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-drug underline underline-offset-2"
                >
                  Contested Evidence
                </a>{" "}
                demos, anchored to{" "}
                <a
                  href={SOURCES.graph.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-drug underline underline-offset-2"
                >
                  {SOURCES.graph.label} ↗
                </a>
                .
              </p>
            </div>
            <span className="rounded-full border border-drug/60 bg-drug-soft/60 px-3 py-1 font-mono text-[0.7rem] font-semibold text-drug">
              {GRAPH_RELEASE}
            </span>
          </div>

          {/* Robustness Verdict Banner */}
          <div className="mt-4 rounded-lg border border-drug/40 bg-drug-soft/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-drug/60 bg-bg/70 px-2.5 py-0.5 font-mono text-[0.7rem] font-semibold text-drug">
                ✓ {quality.impact.robustnessVerdict.badge}
              </span>
              <span className="font-mono text-[0.7rem] tabular-nums text-muted">
                Default precision threshold: SE &lt;= {quality.defaultMaxSe}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-fg sm:text-sm">
              {quality.impact.robustnessVerdict.summary}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded border border-line bg-bg/80 p-2.5">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">High-Precision Trials</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-drug tabular-nums">
                  {quality.impact.robustnessVerdict.highPrecisionCount}
                </p>
              </div>
              <div className="rounded border border-line bg-bg/80 p-2.5">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">Verified Cohorts</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-fg tabular-nums">
                  {quality.impact.robustnessVerdict.supportingCohortCount}
                </p>
              </div>
              <div className="rounded border border-line bg-bg/80 p-2.5">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">Wide-CI Noise Excluded</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-muted tabular-nums">
                  {quality.impact.robustnessVerdict.noisyExcludedCount}
                </p>
              </div>
              <div className="rounded border border-signal/40 bg-bg/80 p-2.5">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-signal">Quarantined Errors</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-signal tabular-nums">
                  {quality.impact.robustnessVerdict.contradictedCount}
                </p>
              </div>
            </div>
          </div>

          {/* Concrete Impact of Wrong Results */}
          <div className="mt-4 space-y-3">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-signal">
              Concrete Impact of Quarantined Extractions: Clean Graph vs. Unfiltered Graph
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {quality.impact.impactBullets.map((b) => (
                <div key={b.domain} className="rounded-lg border border-line bg-bg/80 p-4 text-xs leading-relaxed">
                  <p className="font-display text-sm font-semibold text-fg">{b.domain}</p>
                  <div className="mt-2 rounded border border-drug/40 bg-drug-soft/30 p-2.5">
                    <p className="font-mono text-[0.65rem] uppercase tracking-wider text-drug">
                      ✓ Clean Verified Conclusion
                    </p>
                    <p className="mt-1 text-body">{b.cleanConclusion}</p>
                  </div>
                  <div className="mt-2 rounded border border-signal/40 bg-signal-soft/25 p-2.5">
                    <p className="font-mono text-[0.65rem] uppercase tracking-wider text-signal">
                      ✕ Unfiltered Conclusion (If Errors Included)
                    </p>
                    <p className="mt-1 text-body">{b.rawWithErrorsConclusion}</p>
                  </div>
                  <p className="mt-2 font-mono text-[0.66rem] text-muted">
                    Quarantined IDs: {b.culpritIds.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Findings Switcher */}
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="System Public Graph audit tiers">
                <button
                  type="button"
                  role="tab"
                  aria-selected={auditTab === "clean"}
                  onClick={() => setAuditTab("clean")}
                  className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                    auditTab === "clean"
                      ? "bg-drug font-semibold text-bg"
                      : "border border-line text-muted hover:text-fg"
                  }`}
                >
                  ✓ Verified Clean ({quality.cleanFindings.length} · {quality.localCounts.clean} local)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={auditTab === "errors"}
                  onClick={() => setAuditTab("errors")}
                  className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                    auditTab === "errors"
                      ? "bg-signal font-semibold text-bg"
                      : "border border-line text-muted hover:text-fg"
                  }`}
                >
                  ✕ Quarantined Errors ({quality.errorFindings.length} · {quality.localCounts.errors} local)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={auditTab === "noise"}
                  onClick={() => setAuditTab("noise")}
                  className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                    auditTab === "noise"
                      ? "bg-fg font-semibold text-bg"
                      : "border border-line text-muted hover:text-fg"
                  }`}
                >
                  ○ Wide-CI / Low-Precision Noise ({quality.noisyFindings.length} · {quality.localCounts.noisy} local)
                </button>
              </div>
              <Link
                href={observatoryHref}
                className="font-mono text-xs text-drug underline underline-offset-2 print:hidden"
              >
                Explore interactive precision funnel →
              </Link>
            </div>

            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {shownAuditFindings.map((f) => (
                <AuditFindingCard key={f.systemId} f={f} area={watch.area} />
              ))}
            </ul>
          </div>
        </section>

        {/* Full Archival Decision Receipt & Non-Clinical Guardrails */}
        <section
          aria-labelledby="dispatch-receipt"
          className="rounded-xl border border-line bg-surface p-5 sm:p-6"
        >
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
            Section 3 · Complete Citation &amp; Provenance Ledger
          </p>
          <h2 id="dispatch-receipt" className="mt-1 font-display text-xl font-semibold text-fg">
            Archival Decision Receipt
          </h2>

          <div className="mt-4 overflow-hidden rounded-lg border border-line-strong bg-bg">
            {receipt.map((s) => (
              <div
                key={s.title}
                className="border-b border-dashed border-line-strong px-4 py-3 last:border-b-0"
              >
                <p className="mb-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-drug">
                  {s.title}
                </p>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-[10rem_minmax(0,1fr)]">
                  {s.rows.map((r, i) => (
                    <div key={`${s.title}-${i}`} className="contents">
                      <dt className="font-mono text-[0.72rem] text-muted">{r.label}</dt>
                      <dd className="min-w-0 break-words leading-relaxed text-body">
                        {r.text}{" "}
                        {r.badge ? (
                          <span
                            className={`mr-1.5 inline-block rounded-full border px-2 py-0.5 font-mono text-[0.66rem] ${
                              BADGE_TONE[r.badge.tone]
                            }`}
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
                            className="mr-2.5 whitespace-nowrap font-mono text-[0.7rem] text-drug underline underline-offset-2"
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

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-bg/70 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                WHO Classification of {marker.label}
              </p>
              <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-body">
                {whoStatus.map((s) => (
                  <p key={s}>{s}</p>
                ))}
                {esa ? (
                  <p className="text-drug">
                    WHO guidance notes that IPTp with sulfadoxine-pyrimethamine (SP) continues to confer maternal and birth-weight benefit even in areas with high K540E prevalence where sextuple A581G remains uncommon.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-bg/70 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                What This Dispatch Cannot Tell You
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
                {lim.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <footer className="mt-5 border-t border-line pt-4 font-mono text-[0.7rem] leading-relaxed text-muted">
            {asOfLine} · Permanent web dispatch path: <span className="text-fg">{permalinkPath}</span> · Replay of a frozen historical surveillance snapshot, never clinical treatment advice.
          </footer>
        </section>
      </main>
    </div>
  );
}
