"use client";

import { useState } from "react";
import type { AlertEvent, CellStat, Watch, WhoBasis } from "@/lib/alert/derive";
import { WHO_BAND_LINES } from "@/lib/alert/derive";
import { ci, frac, pct } from "@/lib/alert/copy";
import { pmidStr, type AbstractPrevalence } from "@/lib/alert/pack";
import { KindMark } from "./glyphs";
import css from "./alert.module.css";

const W = 740;
const H = 296;
const M = { l: 46, r: 84, t: 22, b: 34 };

export const radiusFor = (n: number) => Math.max(4, Math.min(12.5, 2.8 + Math.sqrt(n) / 2.15));

export type PlottedPaperFigure = {
  key: string;
  pmid: string;
  pubYear: number;
  plotYear: number;
  pct: number;
  site: string | null;
  quote: string;
  eventId: string | null;
};

type HoverItem =
  | { kind: "genome"; cell: CellStat }
  | { kind: "paper"; fig: PlottedPaperFigure };

type Props = {
  country: string;
  marker: string;
  drug: string;
  cells: CellStat[];
  companion: CellStat[];
  paperFigures: AbstractPrevalence[];
  allEvents: AlertEvent[];
  watch: Watch;
  basis: WhoBasis;
  domain: [number, number];
  replayYear: number;
  onReplayYear: (y: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onResetReplay: () => void;
  freshYear: number | null;
  selectedId: string | null;
  selectedYear: number | null;
  onSelect: (id: string) => void;
};

export function HistoryChart(props: Props) {
  const {
    cells,
    companion,
    paperFigures,
    allEvents,
    watch,
    basis,
    domain,
    replayYear,
    country,
    marker,
    drug,
    selectedId,
    selectedYear,
  } = props;
  const [hover, setHover] = useState<HoverItem | null>(null);

  const plottedPapers: PlottedPaperFigure[] = paperFigures
    .filter((f): f is AbstractPrevalence & { prevalence_pct: number } => typeof f.prevalence_pct === "number")
    .map((f, idx) => {
      const pmid = pmidStr(f.pmid);
      const plotYear = f.year_end ?? f.year_start ?? f.pub_year;
      const matchEv = allEvents.find(
        (ev) => ev.source === "papers" && ev.rule === "abstract_figure" && ev.pmid === pmid && ev.quote === f.quote,
      );
      return {
        key: `${pmid}-${idx}`,
        pmid,
        pubYear: f.pub_year,
        plotYear,
        pct: Math.max(0, Math.min(100, f.prevalence_pct)),
        site: f.site ?? null,
        quote: f.quote,
        eventId: matchEv?.id ?? null,
      };
    });

  const allYears = [
    ...cells.map((c) => c.year),
    ...plottedPapers.map((p) => p.plotYear),
    ...(selectedYear != null ? [selectedYear] : []),
  ];
  const y0 = allYears.length ? Math.min(...allYears) : domain[0];
  const y1 = allYears.length ? Math.max(...allYears) : domain[1];
  const pad = y1 - y0 < 4 ? 2 : 1;
  const xMin = y0 - pad;
  const xMax = Math.max(xMin + 2, y1 + pad);

  const x = (yr: number) => M.l + ((yr - xMin) / Math.max(1, xMax - xMin)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - v / 100) * (H - M.t - M.b);
  const span = xMax - xMin;
  const step = span > 36 ? 10 : span > 16 ? 5 : span > 8 ? 2 : 1;
  const xTicks: number[] = [];
  for (let t = Math.ceil(xMin / step) * step; t <= xMax; t += step) xTicks.push(t);

  const esa = basis === "east_southern_africa";
  const bandMode = watch.trigger === "who_band" || watch.trigger === "very_high_combo";
  const showBands = esa;
  const showCompanion = bandMode && companion.length > 0;
  const levelLine = watch.trigger === "rise" || watch.trigger === "fall" ? watch.level : null;
  const levelIsWho = esa && (levelLine === WHO_BAND_LINES.medium || levelLine === WHO_BAND_LINES.high);

  const qual = cells.filter((c) => c.n >= watch.minN);
  const visible = (yr: number) => yr <= replayYear;
  const genomeEvents = allEvents.filter((ev) => ev.source === "genomes" && ev.cell);
  const eventByYear = new Map(genomeEvents.map((ev) => [ev.year, ev]));

  return (
    <section
      aria-labelledby="traj-h"
      className="rounded-xl border border-[#ffffff18] bg-[#0d2233] p-4 shadow-[0_20px_50px_#040b1459] sm:p-5"
    >
      {/* Card Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="traj-h" className="text-sm font-semibold text-fg sm:text-base">
            {marker} trajectory in {country}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            MalariaGEN Pf8 convenience samples (95% Wilson CI) &amp; unpooled PubMed figures · {drug}
          </p>
        </div>

        {/* Compact Shape + Colour Legend */}
        <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-[#c4cdd6]">
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-signal" aria-hidden />
            Fired cell
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-fg" aria-hidden />
            Pf8 genomes
          </li>
          {plottedPapers.length > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden>
                <path d="M0 -4.8 L4.8 0 L0 4.8 L-4.8 0 Z" fill="#050d17" stroke="#8cf2dc" strokeWidth="1.8" />
              </svg>
              Paper %
            </li>
          ) : null}
        </ul>
      </div>

      {cells.length === 0 && plottedPapers.length === 0 ? (
        <div className="grid h-52 place-items-center rounded-lg border border-dashed border-[#ffffff2e] bg-[#050d17]/50 px-4 text-center text-xs text-muted sm:text-sm">
          No Pf8 genome counts or abstract figures recorded for {country}. Unsampled is not zero prevalence.
        </div>
      ) : (
        <figure className="m-0">
          <div className="overflow-x-auto rounded-lg border border-[#ffffff14] bg-[#050d17]/65 p-1.5">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block h-auto w-full min-w-[520px]"
              role="group"
              aria-label={`${marker} trajectory in ${country} with WHO bands, 95% Wilson intervals, and published paper figures`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {/* WHO threshold bands (East & Southern Africa) */}
              {showBands ? (
                <g aria-hidden>
                  <rect
                    x={M.l}
                    y={y(100)}
                    width={W - M.l - M.r}
                    height={y(60) - y(100)}
                    fill="#16344a"
                    opacity={0.7}
                  />
                  <rect
                    x={M.l}
                    y={y(60)}
                    width={W - M.l - M.r}
                    height={y(40) - y(60)}
                    fill="#16344a"
                    opacity={0.35}
                  />
                  {[
                    ["High", 80],
                    ["Med", 50],
                    ["Low", 20],
                  ].map(([label, at]) => (
                    <text
                      key={label}
                      x={W - M.r + 8}
                      y={y(at as number) + 4}
                      fontSize={12}
                      fill="#94a9b7"
                      fontFamily="var(--font-mono)"
                    >
                      {label}
                    </text>
                  ))}
                </g>
              ) : null}

              {/* Horizontal percentage grid */}
              {[0, 20, 40, 60, 80, 100].map((t) => (
                <g key={t} aria-hidden>
                  <line
                    x1={M.l}
                    x2={W - M.r}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="#ffffff18"
                    strokeWidth={t === 0 ? 1.2 : 0.75}
                  />
                  <text
                    x={M.l - 8}
                    y={y(t) + 4}
                    textAnchor="end"
                    fontSize={12}
                    fill="#94a9b7"
                    fontFamily="var(--font-mono)"
                  >
                    {t}%
                  </text>
                </g>
              ))}

              {/* X-axis ticks */}
              {xTicks.map((t) => (
                <g key={t} aria-hidden>
                  <line x1={x(t)} x2={x(t)} y1={H - M.b} y2={H - M.b + 5} stroke="#ffffff40" />
                  <text
                    x={x(t)}
                    y={H - M.b + 19}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#94a9b7"
                    fontFamily="var(--font-mono)"
                  >
                    {t}
                  </text>
                </g>
              ))}

              {/* Selected-year vertical crosshair */}
              {selectedYear != null && selectedYear >= xMin && selectedYear <= xMax ? (
                <g aria-hidden>
                  <line
                    x1={x(selectedYear)}
                    x2={x(selectedYear)}
                    y1={M.t - 4}
                    y2={H - M.b}
                    stroke="#8cf2dc"
                    strokeWidth={1.3}
                    strokeDasharray="3 3"
                    opacity={0.85}
                  />
                  <rect
                    x={x(selectedYear) - 22}
                    y={3}
                    width={44}
                    height={16}
                    rx={4}
                    fill="#12363a"
                    stroke="#8cf2dc"
                    strokeWidth={0.9}
                  />
                  <text
                    x={x(selectedYear)}
                    y={14.5}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="#8cf2dc"
                    fontFamily="var(--font-mono)"
                  >
                    {selectedYear}
                  </text>
                </g>
              ) : null}

              {/* WHO 40% & 60% lines */}
              {showBands
                ? [WHO_BAND_LINES.medium, WHO_BAND_LINES.high].map((t) => (
                    <g key={t} aria-hidden>
                      <line
                        x1={M.l}
                        x2={W - M.r}
                        y1={y(t)}
                        y2={y(t)}
                        stroke="#ffffff55"
                        strokeWidth={1.2}
                        strokeDasharray="5 4"
                      />
                      <text
                        x={W - M.r + 8}
                        y={y(t) + 4}
                        fontSize={12}
                        fontWeight={600}
                        fill="#f5f4ef"
                        fontFamily="var(--font-mono)"
                      >
                        {t}%
                      </text>
                    </g>
                  ))
                : null}

              {/* Active preset / crossing cutoff line */}
              {levelLine !== null && !(showBands && levelIsWho) ? (
                <g aria-hidden>
                  <line
                    x1={M.l}
                    x2={W - M.r}
                    y1={y(levelLine)}
                    y2={y(levelLine)}
                    stroke="#e8964b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={W - M.r + 8}
                    y={y(levelLine) + 4}
                    fontSize={12}
                    fontWeight={600}
                    fill="#e8964b"
                    fontFamily="var(--font-mono)"
                  >
                    {levelLine}%
                  </text>
                </g>
              ) : null}

              {showCompanion ? (
                <g aria-hidden>
                  <line
                    x1={M.l}
                    x2={W - M.r}
                    y1={y(WHO_BAND_LINES.a581g)}
                    y2={y(WHO_BAND_LINES.a581g)}
                    stroke="#8cf2dc"
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    opacity={0.7}
                  />
                </g>
              ) : null}

              {/* Trajectory connecting qualifying genome cells */}
              {qual.slice(1).map((c, i) => {
                const p = qual[i];
                const gap = c.year - p.year > 1;
                return (
                  <line
                    key={c.year}
                    x1={x(p.year)}
                    y1={y(p.pct)}
                    x2={x(c.year)}
                    y2={y(c.pct)}
                    stroke="#f5f4ef"
                    strokeOpacity={gap ? 0.35 : 0.68}
                    strokeWidth={1.7}
                    strokeDasharray={gap ? "3 4" : undefined}
                    className={`${css.mark} ${visible(c.year) ? "" : css.markHidden}`}
                  />
                );
              })}

              {/* Companion A581G markers when applicable */}
              {showCompanion
                ? companion.map((c) => (
                    <g
                      key={`comp-${c.year}`}
                      transform={`translate(${x(c.year)} ${y(c.pct)})`}
                      className={`${css.mark} ${visible(c.year) ? "" : css.markHidden}`}
                      opacity={c.n >= watch.minN ? 0.85 : 0.4}
                    >
                      <circle r={3} fill="#050d17" stroke="#8cf2dc" strokeWidth={1.3} />
                      <title>{`Companion A581G (${c.year}): ${frac(c)} (${pct(c.pct)}, ${ci(c)})`}</title>
                    </g>
                  ))
                : null}

              {/* Published paper abstract prevalence diamonds (unpooled) */}
              {plottedPapers.map((pf) => {
                const isVis = pf.pubYear <= replayYear;
                const isSel = pf.eventId != null && pf.eventId === selectedId;
                return (
                  <g
                    key={pf.key}
                    transform={`translate(${x(pf.plotYear)} ${y(pf.pct)})`}
                    className={`${css.mark} ${isVis ? "" : css.markHidden}`}
                    tabIndex={isVis && pf.eventId ? 0 : -1}
                    role={pf.eventId ? "button" : "img"}
                    aria-label={`Published ${pf.pubYear} (PMID ${pf.pmid}): stated ${pf.pct.toFixed(1)}%${pf.site ? ` at ${pf.site}` : ""} — unpooled paper abstract figure`}
                    onMouseEnter={() => setHover({ kind: "paper", fig: pf })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ kind: "paper", fig: pf })}
                    onBlur={() => setHover(null)}
                    onClick={() => pf.eventId && props.onSelect(pf.eventId)}
                    onKeyDown={(k) => {
                      if (pf.eventId && (k.key === "Enter" || k.key === " ")) {
                        k.preventDefault();
                        props.onSelect(pf.eventId);
                      }
                    }}
                    style={{ cursor: pf.eventId ? "pointer" : "default", outline: "none" }}
                  >
                    <circle r={10} fill="transparent" />
                    {isSel ? <circle r={8.5} fill="none" stroke="#8cf2dc" strokeWidth={1.5} /> : null}
                    <path d="M0 -5.4 L5.4 0 L0 5.4 L-5.4 0 Z" fill="#050d17" stroke="#8cf2dc" strokeWidth={1.9} />
                  </g>
                );
              })}

              {/* Genome cells with 95% Wilson CI whiskers */}
              {cells.map((c) => {
                const ok = c.n >= watch.minN;
                const r = radiusFor(c.n);
                const ev = eventByYear.get(c.year);
                const fired = ev?.fired;
                const isSelected = Boolean(ev && ev.id === selectedId);
                const isHovered = hover?.kind === "genome" && hover.cell.year === c.year;

                return (
                  <g
                    key={c.year}
                    className={`${css.mark} ${visible(c.year) ? "" : css.markHidden}`}
                    tabIndex={visible(c.year) ? 0 : -1}
                    role={ev ? "button" : "img"}
                    aria-label={`Collected ${c.year}: ${frac(c)} carried ${marker}, ${pct(c.pct)}, ${ci(c)}${ok ? "" : `, under minimum ${watch.minN}`}${fired ? ". Alert fired; press Enter to inspect." : ""}`}
                    onMouseEnter={() => setHover({ kind: "genome", cell: c })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ kind: "genome", cell: c })}
                    onBlur={() => setHover(null)}
                    onClick={() => ev && props.onSelect(ev.id)}
                    onKeyDown={(k) => {
                      if (ev && (k.key === "Enter" || k.key === " ")) {
                        k.preventDefault();
                        props.onSelect(ev.id);
                      }
                    }}
                    style={{ cursor: ev ? "pointer" : "default", outline: "none" }}
                  >
                    <rect x={x(c.year) - 11} y={M.t} width={22} height={H - M.t - M.b} fill="transparent" />
                    <line
                      x1={x(c.year)}
                      x2={x(c.year)}
                      y1={y(c.ci.hi)}
                      y2={y(c.ci.lo)}
                      stroke={ok ? "#f5f4ef" : "#94a9b7"}
                      strokeWidth={ok ? 1.5 : 1}
                      strokeOpacity={ok ? 0.75 : 0.55}
                    />
                    {[c.ci.hi, c.ci.lo].map((v, i) => (
                      <line
                        key={i}
                        x1={x(c.year) - 3}
                        x2={x(c.year) + 3}
                        y1={y(v)}
                        y2={y(v)}
                        stroke={ok ? "#f5f4ef" : "#94a9b7"}
                        strokeWidth={1}
                        strokeOpacity={0.7}
                      />
                    ))}
                    <circle
                      cx={x(c.year)}
                      cy={y(c.pct)}
                      r={r}
                      fill={ok ? (fired ? "#e8964b" : "#f5f4ef") : "#0d2233"}
                      stroke={ok ? "#050d17" : "#94a9b7"}
                      strokeWidth={ok ? 2 : 1.3}
                      strokeDasharray={ok ? undefined : "2.5 2"}
                    />
                    {isHovered || isSelected ? (
                      <circle
                        cx={x(c.year)}
                        cy={y(c.pct)}
                        r={r + 4.2}
                        fill="none"
                        stroke={isSelected ? "#e8964b" : "#8cf2dc"}
                        strokeWidth={1.8}
                      />
                    ) : null}
                    {fired && ev ? (
                      <g
                        transform={`translate(${x(c.year)} ${Math.max(M.t + 8, y(c.ci.hi) - 12)})`}
                        style={{ color: "#e8964b" }}
                      >
                        {props.freshYear === c.year ? <circle className={css.pulse} r={6} /> : null}
                        <KindMark kind={ev.kind} direction={ev.direction} r={6} />
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Readout Line */}
          <figcaption className="mt-2.5 flex min-h-[1.5rem] items-center justify-between gap-3 text-xs text-muted tabular-nums">
            <p aria-live="polite" className="truncate font-mono text-xs text-[#c4cdd6]">
              {hover?.kind === "genome" ? (
                <>
                  <strong className="text-fg">
                    {country} · collected {hover.cell.year}:
                  </strong>{" "}
                  {pct(hover.cell.pct)} ({frac(hover.cell)}) · {ci(hover.cell)}
                  {hover.cell.n < watch.minN ? ` · below n≥${watch.minN}` : ""}
                </>
              ) : hover?.kind === "paper" ? (
                <>
                  <strong className="text-drug">
                    Paper figure · published {hover.fig.pubYear} (PMID {hover.fig.pmid}):
                  </strong>{" "}
                  stated {hover.fig.pct.toFixed(1)}%{hover.fig.site ? ` · ${hover.fig.site}` : ""} (unpooled)
                </>
              ) : (
                <span>Click any point or diamond to inspect provenance · circle area scales with sample size n</span>
              )}
            </p>
          </figcaption>
        </figure>
      )}

      {/* Integrated Compact Timeline Replay Scrubber */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#ffffff18] pt-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={props.onTogglePlay}
            aria-pressed={props.playing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-drug/50 bg-drug-soft/80 px-3 text-xs font-semibold text-drug transition-colors hover:border-drug"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
              {props.playing ? (
                <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" />
              ) : (
                <path d="M2 1l9 5-9 5z" fill="currentColor" />
              )}
            </svg>
            {props.playing ? "Pause" : replayYear >= domain[1] ? "Play Replay" : "Play"}
          </button>
          <button
            type="button"
            onClick={props.onResetReplay}
            disabled={replayYear >= domain[1] && !props.playing}
            className="inline-flex h-8 items-center rounded-lg border border-[#ffffff24] bg-[#050d17]/70 px-2.5 text-xs font-medium text-[#c4cdd6] transition-colors hover:border-[#ffffff4d] hover:text-fg disabled:opacity-40"
          >
            Reset
          </button>
        </div>

        <label className="flex min-w-[10rem] flex-1 items-center gap-2">
          <span className="sr-only">Replay history year</span>
          <input
            type="range"
            className={css.scrub}
            min={domain[0]}
            max={domain[1]}
            step={1}
            value={replayYear}
            onChange={(e) => props.onReplayYear(Number(e.target.value))}
            aria-valuetext={`Showing evidence up to ${replayYear}`}
          />
        </label>

        <output
          className="shrink-0 rounded-md border border-[#ffffff1f] bg-[#050d17] px-2.5 py-1 font-mono text-xs font-semibold text-fg tabular-nums"
          aria-live="off"
        >
          Up to {replayYear}
        </output>
      </div>
    </section>
  );
}
