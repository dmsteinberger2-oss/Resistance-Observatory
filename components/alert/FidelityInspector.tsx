"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type FidelityTier,
  type QualityLedger,
  type ScoredFinding,
} from "@/lib/alert/quality";
import type { MarkerDef } from "@/lib/alert/pack";
import css from "./alert.module.css";

const FW = 560;
const FH = 292;
const FM = { l: 52, r: 22, t: 28, b: 48 };
const LOG_MIN = Math.log(0.08);
const LOG_MAX = Math.log(12.5);
const RATIO_TICKS = [0.1, 0.5, 1, 2, 5, 10] as const;

const TIER_SHORT: Record<FidelityTier, string> = {
  high_precision_trial: "High-precision trial",
  verified_cohort: "Verified cohort",
  low_precision_noise: "Low-precision noise",
  contradicted_error: "Quarantined graph error",
};

export function FidelityInspector({
  ledger,
  marker,
  country,
}: {
  ledger: QualityLedger;
  marker: MarkerDef;
  country: string;
}) {
  const [includeErrors, setIncludeErrors] = useState(false);
  const [maxSe, setMaxSe] = useState<number>(ledger.defaultMaxSe);
  const [auditFilter, setAuditFilter] = useState<"all" | "errors" | "noise">("all");
  const [activePointId, setActivePointId] = useState<string | null>(null);

  useEffect(() => {
    setMaxSe(ledger.defaultMaxSe);
  }, [ledger.defaultMaxSe, ledger.area]);

  const plottable = useMemo(
    () =>
      ledger.funnelPoints.filter(
        (p) =>
          p.logEffect != null &&
          Number.isFinite(p.logEffect) &&
          p.precision != null &&
          Number.isFinite(p.precision),
      ),
    [ledger.funnelPoints],
  );

  // Pick a meaningful default selected point so the inspector strip is immediately informative
  const selectedPoint: ScoredFinding | null = useMemo(() => {
    if (activePointId) {
      const found =
        ledger.funnelPoints.find((p) => p.systemId === activePointId) ??
        ledger.errorFindings.find((p) => p.systemId === activePointId) ??
        ledger.cleanFindings.find((p) => p.systemId === activePointId) ??
        ledger.noisyFindings.find((p) => p.systemId === activePointId);
      if (found) return found;
    }
    if (includeErrors && ledger.errorFindings.length > 0) {
      return plottable.find((p) => p.tier === "contradicted_error") ?? ledger.errorFindings[0];
    }
    return plottable.find((p) => p.tier === "high_precision_trial") ?? plottable[0] ?? ledger.cleanFindings[0] ?? null;
  }, [activePointId, includeErrors, ledger, plottable]);

  const cutoffPrecision = 1 / Math.max(0.08, maxSe);
  const maxPrecision = useMemo(() => {
    const dataMax = plottable.reduce((mx, p) => Math.max(mx, p.precision ?? 0), 0);
    return Math.max(5.5, Math.min(18, Math.max(dataMax * 1.12, cutoffPrecision * 1.28)));
  }, [plottable, cutoffPrecision]);

  const fx = (logVal: number) => {
    const clamped = Math.max(LOG_MIN * 0.96, Math.min(LOG_MAX * 0.96, logVal));
    return FM.l + ((clamped - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (FW - FM.l - FM.r);
  };
  const fy = (prec: number) => {
    const clamped = Math.max(0, Math.min(maxPrecision, prec));
    return FM.t + (1 - clamped / maxPrecision) * (FH - FM.t - FM.b);
  };

  // Build 95% pseudo-confidence funnel cone around logEffect = 0 (null = 1.0x)
  const funnelCone = useMemo(() => {
    const steps = 18;
    const pMin = 0.32;
    const leftPts: string[] = [];
    const rightPts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const p = maxPrecision - (i / steps) * (maxPrecision - pMin);
      const halfLog = Math.min(LOG_MAX, 1.96 / Math.max(0.2, p));
      const yCoord = fy(p).toFixed(1);
      leftPts.push(`${fx(-halfLog).toFixed(1)},${yCoord}`);
      rightPts.push(`${fx(halfLog).toFixed(1)},${yCoord}`);
    }
    const polygon = [...leftPts, ...rightPts.slice().reverse()].join(" ");
    return {
      polygon,
      leftLine: leftPts.join(" "),
      rightLine: rightPts.join(" "),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrecision]);

  // Compute shift indicator between clean passing studies and contradicted error points
  const shiftStats = useMemo(() => {
    const cleanPts = plottable.filter(
      (p) =>
        (p.tier === "high_precision_trial" || p.tier === "verified_cohort") &&
        (p.se == null || p.se <= maxSe),
    );
    const errPts = plottable.filter((p) => p.tier === "contradicted_error");
    if (!cleanPts.length || !errPts.length) return null;
    const cleanMean =
      cleanPts.reduce((s, p) => s + (p.logEffect ?? 0), 0) / cleanPts.length;
    const errMean =
      errPts.reduce((s, p) => s + (p.logEffect ?? 0), 0) / errPts.length;
    return { cleanMean, errMean };
  }, [plottable, maxSe]);

  const passingCleanCount = ledger.cleanFindings.filter(
    (f) => f.se != null && f.se <= maxSe,
  ).length;
  const sliderFilteredClean = ledger.cleanFindings.filter(
    (f) => f.se == null || f.se > maxSe,
  );
  const combinedNoiseList = [...sliderFilteredClean, ...ledger.noisyFindings];

  const rv = ledger.impact.robustnessVerdict;
  const verdictTone =
    rv.status === "more_robust"
      ? "border-drug/60 bg-drug-soft/75 text-drug"
      : rv.status === "noise_excluded"
        ? "border-signal/60 bg-signal-soft/75 text-signal"
        : "border-[#ffffff2e] bg-[#16344a]/70 text-[#c4cdd6]";

  const yTicks = useMemo(() => {
    const step = maxPrecision > 12 ? 4 : maxPrecision > 7 ? 2 : 1;
    const out: number[] = [];
    for (let v = 0; v <= Math.floor(maxPrecision); v += step) out.push(v);
    return out;
  }, [maxPrecision]);

  return (
    <div className="space-y-4">
      {/* TOP CONTROL BAR */}
      <div className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-drug/40 bg-drug-soft/60 px-2.5 py-0.5 font-mono text-xs text-drug">
            ✓ Auto-scored via System Graph CI width, study design &amp; vetting
          </span>
          <span className="font-mono text-xs text-muted">
            Contested-field provenance ({marker.mutation} · {marker.drugShort})
          </span>
        </div>

        {/* 1. Prominent Clean vs +Raw Errors Toggle */}
        <div
          className="mt-3 grid grid-cols-1 gap-1.5 rounded-lg border border-[#ffffff24] bg-[#0d2233] p-1 sm:grid-cols-2"
          role="group"
          aria-label="Graph verification mode"
        >
          <button
            type="button"
            onClick={() => setIncludeErrors(false)}
            aria-pressed={!includeErrors}
            className={`rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
              !includeErrors
                ? "border border-drug/60 bg-drug-soft text-drug shadow-sm"
                : "border border-transparent text-muted hover:text-fg"
            }`}
          >
            <span className="block">Clean Verified Graph (Default)</span>
            <span className="mt-0.5 block font-mono text-xs font-normal opacity-85 tabular-nums">
              {passingCleanCount} verified passing · {ledger.errorFindings.length} errors quarantined
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIncludeErrors(true)}
            aria-pressed={includeErrors}
            className={`rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
              includeErrors
                ? "border border-[#ff7b72]/70 bg-[#3a1d22] text-[#ff9b93] shadow-sm"
                : "border border-transparent text-muted hover:text-fg"
            }`}
          >
            <span className="block">Include Graph Errors (+Raw)</span>
            <span className="mt-0.5 block font-mono text-xs font-normal opacity-85 tabular-nums">
              Exposes {ledger.errorFindings.length} contradicted extractions
            </span>
          </button>
        </div>

        {/* 2. Interactive Precision Filter Slider */}
        <div className="mt-3 border-t border-[#ffffff14] pt-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label htmlFor="precision-slider" className="font-medium text-fg">
              Minimum precision / Max SE cutoff
            </label>
            <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
              <span className="text-drug">
                1/SE ≥ {cutoffPrecision.toFixed(2)}
              </span>
              <span className="text-muted">·</span>
              <span className="text-[#c4cdd6]">Max SE ≤ {maxSe.toFixed(2)}</span>
              {Math.abs(maxSe - ledger.defaultMaxSe) > 0.01 ? (
                <button
                  type="button"
                  onClick={() => setMaxSe(ledger.defaultMaxSe)}
                  className="rounded border border-[#ffffff29] px-1.5 py-0.5 text-xs text-muted hover:text-fg"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>
          <input
            id="precision-slider"
            type="range"
            min={0.12}
            max={1.2}
            step={0.02}
            value={maxSe}
            onChange={(e) => setMaxSe(Number(e.target.value))}
            className={`mt-1.5 ${css.scrub}`}
            aria-valuetext={`Maximum standard error ${maxSe.toFixed(2)}, minimum precision ${cutoffPrecision.toFixed(2)}`}
          />
        </div>
      </div>

      {/* 1. LEAD WITH IMPACT CARD (FIRST — BEFORE INDIVIDUAL BAD STUDIES) */}
      <section
        aria-labelledby="impact-h"
        className={`rounded-xl border p-4 transition-colors ${
          includeErrors
            ? "border-[#ff7b72]/60 bg-[#23141c]"
            : "border-drug/40 bg-[#081b28]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
              Conclusion Shift · {country} &amp; Global {marker.drugShort} Evidence
            </p>
            <h3 id="impact-h" className="mt-1 text-sm font-semibold leading-snug text-fg">
              {ledger.impact.headline}
            </h3>
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          {ledger.impact.impactBullets.map((b) => (
            <div
              key={b.domain}
              className="rounded-lg border border-[#ffffff18] bg-[#050d17]/75 p-3 text-xs"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-fg">
                {b.domain}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div
                  className={`rounded-md border p-2.5 ${
                    !includeErrors
                      ? "border-drug/50 bg-drug-soft/50 text-fg"
                      : "border-[#ffffff14] bg-[#0d2233]/50 text-[#c4cdd6]"
                  }`}
                >
                  <p className="font-mono text-xs font-semibold text-drug">
                    ✓ Clean Verified Graph
                  </p>
                  <p className="mt-1 leading-relaxed">{b.cleanConclusion}</p>
                </div>

                <div
                  className={`rounded-md border p-2.5 ${
                    includeErrors
                      ? "border-[#ff7b72]/65 bg-[#3a1d22]/85 text-fg"
                      : "border-[#ffffff14] bg-[#0d2233]/40 text-muted"
                  }`}
                >
                  <p className="font-mono text-xs font-semibold text-[#ff9b93]">
                    ✕ Raw Graph (+Errors)
                  </p>
                  <p className="mt-1 leading-relaxed">{b.rawWithErrorsConclusion}</p>
                  {b.culpritIds.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="font-mono text-xs text-muted">Culprits:</span>
                      {b.culpritIds.map((cid) => (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => {
                            setIncludeErrors(true);
                            setActivePointId(cid);
                          }}
                          className="rounded border border-[#ff7b72]/50 bg-[#050d17] px-1.5 py-0.5 font-mono text-xs text-[#ff9b93] hover:border-[#ff7b72]"
                        >
                          {cid}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Robustness Verdict Pill & 1-Sentence Explanation */}
        <div className="mt-3 rounded-lg border border-[#ffffff18] bg-[#050d17]/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${verdictTone}`}
            >
              {rv.badge}
            </span>
            <span className="font-mono text-xs text-muted tabular-nums">
              {rv.highPrecisionCount} trials · {rv.supportingCohortCount} cohorts ·{" "}
              {rv.noisyExcludedCount} noisy excluded · {rv.contradictedCount} errors
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#c4cdd6]">
            {rv.summary}
          </p>
        </div>
      </section>

      {/* 2. INTERACTIVE STUDY-PRECISION FUNNEL SVG */}
      <section
        aria-labelledby="funnel-h"
        className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-3.5"
      >
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="funnel-h" className="text-xs font-semibold uppercase tracking-[0.12em] text-fg">
            Study-Precision Funnel (Effect Ratio vs. 1/SE)
          </h3>
          <span className="font-mono text-xs text-muted tabular-nums">
            {plottable.length} findings with 95% CI
          </span>
        </div>

        {/* Shape + Colour Key */}
        <ul className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#c4cdd6]">
          <li className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden>
              <circle r="4.5" fill="#8cf2dc" />
            </svg>
            Trial
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden>
              <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill="#12363a" stroke="#8cf2dc" strokeWidth="1.6" />
            </svg>
            Verified cohort
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden>
              <rect x="-4" y="-4" width="8" height="8" fill="#16344a" stroke="#94a9b7" strokeWidth="1.3" />
            </svg>
            Low-precision noise
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden>
              <path d="M-4 -4 L4 4 M-4 4 L4 -4" stroke="#ff7b72" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Graph error {includeErrors ? "(active)" : "(quarantined)"}
          </li>
        </ul>

        <div className="overflow-x-auto rounded-lg border border-[#ffffff14] bg-[#050d17] p-1">
          <svg
            viewBox={`0 0 ${FW} ${FH}`}
            className="block h-auto w-full min-w-[440px]"
            role="group"
            aria-label="Study-precision funnel plot showing reported effect ratio on a log scale against inverse standard error precision"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {/* Shaded 95% pseudo-confidence funnel cone */}
            <polygon points={funnelCone.polygon} fill="#8cf2dc" fillOpacity={0.07} />
            <polyline
              points={funnelCone.leftLine}
              fill="none"
              stroke="#8cf2dc"
              strokeOpacity={0.28}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <polyline
              points={funnelCone.rightLine}
              fill="none"
              stroke="#8cf2dc"
              strokeOpacity={0.28}
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {/* Y-axis grid & ticks */}
            {yTicks.map((t) => (
              <g key={t} aria-hidden>
                <line
                  x1={FM.l}
                  x2={FW - FM.r}
                  y1={fy(t)}
                  y2={fy(t)}
                  stroke="#ffffff14"
                  strokeWidth={t === 0 ? 1.1 : 0.7}
                />
                <text
                  x={FM.l - 7}
                  y={fy(t) + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill="#94a9b7"
                  fontFamily="var(--font-mono)"
                >
                  {t}
                </text>
              </g>
            ))}

            <text
              x={14}
              y={FM.t + (FH - FM.t - FM.b) / 2}
              textAnchor="middle"
              fontSize={12}
              fill="#94a9b7"
              transform={`rotate(-90 14 ${FM.t + (FH - FM.t - FM.b) / 2})`}
            >
              Precision (1 / SE ↑)
            </text>

            {/* X-axis log ticks */}
            {RATIO_TICKS.map((r) => {
              const xCoord = fx(Math.log(r));
              const isNull = r === 1;
              return (
                <g key={r} aria-hidden>
                  <line
                    x1={xCoord}
                    x2={xCoord}
                    y1={FM.t}
                    y2={FH - FM.b}
                    stroke={isNull ? "#ffffff66" : "#ffffff12"}
                    strokeWidth={isNull ? 1.3 : 0.7}
                    strokeDasharray={isNull ? "4 3" : undefined}
                  />
                  <text
                    x={xCoord}
                    y={FH - FM.b + 18}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={isNull ? 600 : 400}
                    fill={isNull ? "#f5f4ef" : "#94a9b7"}
                    fontFamily="var(--font-mono)"
                  >
                    {r === 1 ? "1× null" : `${r}×`}
                  </text>
                </g>
              );
            })}

            <text
              x={FM.l + (FW - FM.l - FM.r) / 2}
              y={FH - 6}
              textAnchor="middle"
              fontSize={12}
              fill="#94a9b7"
            >
              Reported Effect Ratio (log scale)
            </text>

            {/* Horizontal Precision Cutoff Line (1 / maxSe) */}
            {cutoffPrecision <= maxPrecision ? (
              <g aria-hidden>
                <line
                  x1={FM.l}
                  x2={FW - FM.r}
                  y1={fy(cutoffPrecision)}
                  y2={fy(cutoffPrecision)}
                  stroke="#e8964b"
                  strokeWidth={1.3}
                  strokeDasharray="5 4"
                />
                <text
                  x={FW - FM.r - 4}
                  y={Math.max(FM.t + 12, fy(cutoffPrecision) - 5)}
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={600}
                  fill="#e8964b"
                  fontFamily="var(--font-mono)"
                >
                  Cutoff 1/SE = {cutoffPrecision.toFixed(1)}
                </text>
              </g>
            ) : null}

            {/* Shift vector when Include Graph Errors (+Raw) is ON */}
            {includeErrors && shiftStats ? (
              <g aria-hidden>
                <line
                  x1={fx(shiftStats.cleanMean)}
                  x2={fx(shiftStats.errMean)}
                  y1={14}
                  y2={14}
                  stroke="#ff7b72"
                  strokeWidth={2}
                />
                <circle cx={fx(shiftStats.cleanMean)} cy={14} r={3.5} fill="#8cf2dc" />
                <circle cx={fx(shiftStats.errMean)} cy={14} r={4} fill="#ff7b72" />
                <text
                  x={(fx(shiftStats.cleanMean) + fx(shiftStats.errMean)) / 2}
                  y={11}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="#ff9b93"
                  fontFamily="var(--font-mono)"
                >
                  Error distortion pull
                </text>
              </g>
            ) : null}

            {/* Funnel Points (Colour + Shape encoded) */}
            {plottable.map((pt) => {
              const px = fx(pt.logEffect!);
              const py = fy(pt.precision!);
              const passesSe = pt.se != null && pt.se <= maxSe;
              const isSelected = selectedPoint?.systemId === pt.systemId;
              const isError = pt.tier === "contradicted_error";

              const pointOpacity = isError
                ? includeErrors
                  ? 1
                  : 0.26
                : passesSe && pt.tier !== "low_precision_noise"
                  ? 0.96
                  : pt.tier === "low_precision_noise" && passesSe
                    ? 0.72
                    : 0.32;

              return (
                <g
                  key={pt.systemId}
                  transform={`translate(${px} ${py})`}
                  opacity={pointOpacity}
                  tabIndex={0}
                  role="button"
                  aria-label={`${pt.systemId}: ${pt.pairLabel}, ${pt.statLabel}, fidelity ${pt.fidelityScore} of 100, ${TIER_SHORT[pt.tier]}`}
                  onMouseEnter={() => setActivePointId(pt.systemId)}
                  onFocus={() => setActivePointId(pt.systemId)}
                  onClick={() => setActivePointId(pt.systemId)}
                  onKeyDown={(k) => {
                    if (k.key === "Enter" || k.key === " ") {
                      k.preventDefault();
                      setActivePointId(pt.systemId);
                    }
                  }}
                  style={{ cursor: "pointer", outline: "none" }}
                >
                  <circle r={11} fill="transparent" />
                  {isSelected ? (
                    <circle
                      r={9.5}
                      fill="none"
                      stroke={isError ? "#ff7b72" : "#e8964b"}
                      strokeWidth={1.8}
                    />
                  ) : null}

                  {pt.tier === "high_precision_trial" ? (
                    <circle r={5.6} fill="#8cf2dc" stroke="#050d17" strokeWidth={1.6} />
                  ) : pt.tier === "verified_cohort" ? (
                    <path
                      d="M0 -6.2 L6.2 0 L0 6.2 L-6.2 0 Z"
                      fill="#12363a"
                      stroke="#8cf2dc"
                      strokeWidth={1.8}
                    />
                  ) : pt.tier === "low_precision_noise" ? (
                    <rect
                      x={-4.4}
                      y={-4.4}
                      width={8.8}
                      height={8.8}
                      rx={1.2}
                      fill="#16344a"
                      stroke="#94a9b7"
                      strokeWidth={1.4}
                    />
                  ) : (
                    /* contradicted_error: triangle + X when active, ghosted X when quarantined */
                    <g>
                      {includeErrors ? (
                        <path
                          d="M0 -7.5 L7 5.5 L-7 5.5 Z"
                          fill="#3a1d22"
                          stroke="#ff7b72"
                          strokeWidth={1.6}
                          strokeLinejoin="round"
                        />
                      ) : null}
                      <path
                        d="M-4.2 -4.2 L4.2 4.2 M-4.2 4.2 L4.2 -4.2"
                        stroke={includeErrors ? "#e8964b" : "#ff7b72"}
                        strokeWidth={2.1}
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Point Readout Card */}
        {selectedPoint ? (
          <div className="mt-2.5 rounded-lg border border-[#ffffff24] bg-[#0d2233] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-fg">
                  {selectedPoint.systemId}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                    selectedPoint.tier === "contradicted_error"
                      ? "border-[#ff7b72]/60 bg-[#3a1d22] text-[#ff9b93]"
                      : selectedPoint.tier === "low_precision_noise"
                        ? "border-[#ffffff29] bg-[#16344a] text-muted"
                        : "border-drug/50 bg-drug-soft text-drug"
                  }`}
                >
                  {selectedPoint.tierLabel || TIER_SHORT[selectedPoint.tier]}
                </span>
                <span className="font-mono text-xs text-muted tabular-nums">
                  Fidelity {selectedPoint.fidelityScore}/100
                </span>
              </div>
              {selectedPoint.pubmedUrl ? (
                <a
                  href={selectedPoint.pubmedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-medium text-drug underline underline-offset-2"
                >
                  {selectedPoint.pmid ? `PMID ${selectedPoint.pmid} · ` : ""}PubMed ↗
                </a>
              ) : null}
            </div>

            <p className="mt-1.5 font-medium text-fg">{selectedPoint.pairLabel}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[#c4cdd6] tabular-nums">
              <span>{selectedPoint.statLabel}</span>
              <span>·</span>
              <span>SE {selectedPoint.se != null ? selectedPoint.se.toFixed(2) : "n/a"}</span>
              <span>·</span>
              <span>{selectedPoint.studyType ?? "study design unrecorded"}</span>
              {selectedPoint.countryName ? (
                <>
                  <span>·</span>
                  <span>
                    {selectedPoint.countryName}
                    {selectedPoint.year ? ` (${selectedPoint.year})` : ""}
                  </span>
                </>
              ) : null}
            </p>
            {selectedPoint.actualPaperSays ? (
              <p className="mt-1.5 border-l-2 border-[#ff7b72] pl-2.5 text-xs text-[#ff9b93]">
                Paper check: {selectedPoint.actualPaperSays}
              </p>
            ) : selectedPoint.exclusionReason ? (
              <p className="mt-1.5 border-l-2 border-signal pl-2.5 text-xs text-signal">
                Filter note: {selectedPoint.exclusionReason}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* 3. FILTERED OUT & QUARANTINED AUDIT SCREEN */}
      <section
        aria-labelledby="audit-h"
        className="rounded-xl border border-[#ffffff1f] bg-[#050d17]/80 p-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="audit-h" className="text-xs font-semibold uppercase tracking-[0.12em] text-fg">
            Filtered Out &amp; Quarantined Audit Ledger
          </h3>
          <div
            className="inline-flex rounded-lg border border-[#ffffff24] bg-[#0d2233] p-0.5 text-xs"
            role="group"
            aria-label="Audit filter"
          >
            {(
              [
                ["all", `All (${ledger.errorFindings.length + combinedNoiseList.length})`],
                ["errors", `Errors (${ledger.errorFindings.length})`],
                ["noise", `Noise (${combinedNoiseList.length})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAuditFilter(k)}
                aria-pressed={auditFilter === k}
                className={`rounded-md px-2 py-1 font-mono text-xs tabular-nums transition-colors ${
                  auditFilter === k ? "bg-[#16344a] font-semibold text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
          {/* Quarantined Graph Errors */}
          {(auditFilter === "all" || auditFilter === "errors") && (
            <div>
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[#ff9b93] tabular-nums">
                Quarantined Graph Errors ({ledger.errorFindings.length})
              </p>
              {ledger.errorFindings.length === 0 ? (
                <p className="rounded-lg border border-[#ffffff14] bg-[#0d2233]/50 p-3 text-xs text-muted">
                  Zero contradicted graph extractions recorded.
                </p>
              ) : (
                <ul className="space-y-2">
                  {ledger.errorFindings.map((err) => (
                    <li
                      key={err.systemId}
                      onClick={() => setActivePointId(err.systemId)}
                      className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                        selectedPoint?.systemId === err.systemId
                          ? "border-[#ff7b72] bg-[#2a151d]"
                          : "border-[#ff7b72]/35 bg-[#1a1118] hover:border-[#ff7b72]/70"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
                          <span className="font-semibold text-[#ff9b93]">{err.systemId}</span>
                          {err.countryName ? (
                            <span className="text-muted">
                              {err.countryName}
                              {err.year ? ` · ${err.year}` : ""}
                            </span>
                          ) : err.year ? (
                            <span className="text-muted">{err.year}</span>
                          ) : null}
                          {err.inVettedCsv ? (
                            <span className="rounded border border-signal/50 bg-signal-soft/60 px-1.5 py-0.5 text-xs text-signal">
                              Was in vetted CSV — caught by paper audit
                            </span>
                          ) : null}
                        </div>
                        {err.pubmedUrl ? (
                          <a
                            href={err.pubmedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(ev) => ev.stopPropagation()}
                            className="font-mono text-xs font-medium text-drug underline underline-offset-2"
                          >
                            {err.pmid ? `PMID ${err.pmid}` : "PubMed"} ↗
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-2 grid gap-1.5">
                        <p className="text-[#c4cdd6]">
                          <span className="font-mono text-xs font-semibold text-muted">
                            Graph Claimed:{" "}
                          </span>
                          {err.pairLabel} ({err.statLabel})
                        </p>
                        <p className="border-l-2 border-[#ff7b72] pl-2.5 text-fg">
                          <span className="font-mono text-xs font-semibold text-[#ff9b93]">
                            Paper Actually Reported:{" "}
                          </span>
                          {err.actualPaperSays ?? err.exclusionReason ?? "Contradicted upon manual source check."}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Excluded Low-Precision Noise */}
          {(auditFilter === "all" || auditFilter === "noise") && (
            <div>
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted tabular-nums">
                Excluded Low-Precision Noise ({combinedNoiseList.length})
              </p>
              {combinedNoiseList.length === 0 ? (
                <p className="rounded-lg border border-[#ffffff14] bg-[#0d2233]/50 p-3 text-xs text-muted">
                  No low-precision studies excluded at the current SE ≤ {maxSe.toFixed(2)} threshold.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {combinedNoiseList.map((nf) => (
                    <li
                      key={nf.systemId}
                      onClick={() => setActivePointId(nf.systemId)}
                      className={`cursor-pointer rounded-lg border p-2.5 text-xs transition-colors ${
                        selectedPoint?.systemId === nf.systemId
                          ? "border-signal bg-[#16344a]"
                          : "border-[#ffffff18] bg-[#0d2233]/70 hover:border-[#ffffff38]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums">
                        <span className="font-semibold text-fg">{nf.systemId}</span>
                        <span className="text-muted">
                          SE {nf.se != null ? nf.se.toFixed(2) : "missing"} · Fidelity {nf.fidelityScore}/100
                        </span>
                        {nf.pubmedUrl ? (
                          <a
                            href={nf.pubmedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(ev) => ev.stopPropagation()}
                            className="text-drug underline underline-offset-2"
                          >
                            {nf.pmid ? `PMID ${nf.pmid}` : "PubMed"} ↗
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[#c4cdd6]">{nf.pairLabel} · {nf.statLabel}</p>
                      <p className="mt-0.5 text-muted">
                        Held back:{" "}
                        {nf.exclusionReason ??
                          (nf.se != null && nf.se > maxSe
                            ? `Wide 95% CI (SE ${nf.se.toFixed(2)} > ${maxSe.toFixed(2)} cutoff)`
                            : "Missing CI or unvetted cohort")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
