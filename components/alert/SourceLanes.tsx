"use client";

import type { AlertEvent, CellStat } from "@/lib/alert/derive";
import { KindMark } from "./glyphs";
import { radiusFor } from "./HistoryChart";
import css from "./alert.module.css";

const W = 740;
const GUT = 186;
const RPAD = 20;
const LANES = { genomes: 36, papers: 88, graph: 140 } as const;
const H = 180;

export type PaperTick = { year: number; total: number; inCountry: number };
export type GraphTick = { year: number; key: string; inCountry: boolean; label: string };
export type WhoYear = { year: number; label: string };

type Props = {
  domain: [number, number];
  replayYear: number;
  country: string;
  minN: number;
  cells: CellStat[];
  cellNote?: (year: number) => string;
  eventNote?: (e: AlertEvent) => string;
  papers: PaperTick[];
  graph: GraphTick[];
  events: AlertEvent[];
  whoYears: WhoYear[];
  selectedId: string | null;
  selectedYear: number | null;
  onSelect: (id: string) => void;
  freshYear: number | null;
};

export function SourceLanes(p: Props) {
  const [y0, y1] = p.domain;
  const x = (yr: number) => GUT + ((yr - y0) / Math.max(1, y1 - y0)) * (W - GUT - RPAD);
  const span = y1 - y0;
  const step = span > 45 ? 10 : span > 18 ? 5 : 2;
  const ticks: number[] = [];
  for (let t = Math.ceil(y0 / step) * step; t <= y1; t += step) ticks.push(t);
  const maxPapers = Math.max(1, ...p.papers.map((d) => d.total));
  const barH = (n: number) => (n / maxPapers) * 30;
  const vis = (yr: number) => yr <= p.replayYear;

  const fired = p.events.filter((e) => e.fired);
  const slot = new Map<string, number>();
  const placed = fired.map((e) => {
    const k = `${e.source}:${e.year}`;
    const i = slot.get(k) ?? 0;
    slot.set(k, i + 1);
    return { e, i };
  });

  const gSlot = new Map<number, number>();

  const cellsByNow = p.cells.filter((c) => c.year <= p.replayYear).length;
  const countryPapersByNow = p.papers
    .filter((d) => d.year <= p.replayYear)
    .reduce((sum, d) => sum + d.inCountry, 0);
  const graphLocalByNow = p.graph.filter((g) => g.year <= p.replayYear && g.inCountry).length;

  return (
    <section
      aria-labelledby="lanes-h"
      className="rounded-xl border border-[#ffffff18] bg-[#0d2233] p-4 shadow-[0_20px_50px_#040b1459] sm:p-5"
    >
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="lanes-h" className="text-sm font-semibold text-fg">
          Synchronized 3-Lane Evidence Replay
        </h2>
        <p className="font-mono text-xs text-muted tabular-nums">
          {cellsByNow} Pf8 cells · {countryPapersByNow} local papers · {graphLocalByNow} local graph items
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#ffffff14] bg-[#050d17]/65 p-1.5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[540px]"
          role="group"
          aria-label="Three-lane evidence timeline: MalariaGEN Pf8 Genomes, PubMed Literature, and System Public Graph"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {/* Lane guides and labels */}
          {(
            [
              ["genomes", "MalariaGEN Pf8 Genomes", "#f5f4ef"],
              ["papers", "PubMed Literature", "#94a9b7"],
              ["graph", "System Public Graph", "#8cf2dc"],
            ] as const
          ).map(([k, label, color]) => (
            <g key={k}>
              <line x1={GUT} x2={W - RPAD} y1={LANES[k]} y2={LANES[k]} stroke="#ffffff18" />
              <g transform={`translate(8 ${LANES[k] - 5})`} style={{ color }}>
                {k === "genomes" && <circle cx={4.5} cy={1} r={4} fill="none" stroke="currentColor" strokeWidth={1.8} />}
                {k === "papers" && <rect x={3} y={-4} width={3.2} height={10} rx={1} fill="currentColor" />}
                {k === "graph" && <rect x={0.5} y={-3.5} width={8.2} height={8.2} rx={1.5} fill="currentColor" />}
              </g>
              <text x={22} y={LANES[k] + 3} fontSize={12} fontWeight={600} fill="#f5f4ef">
                {label}
              </text>
            </g>
          ))}

          {/* Year axis */}
          {ticks.map((t) => (
            <g key={t} aria-hidden>
              <line x1={x(t)} x2={x(t)} y1={12} y2={H - 22} stroke="#ffffff14" strokeWidth={0.7} />
              <text
                x={x(t)}
                y={H - 6}
                textAnchor="middle"
                fontSize={12}
                fill="#94a9b7"
                fontFamily="var(--font-mono)"
              >
                {t}
              </text>
            </g>
          ))}

          {/* WHO guidance milestone lines */}
          {p.whoYears
            .filter((w) => w.year >= y0 && w.year <= y1)
            .map((w, i) => (
              <g key={`${w.year}-${i}`} opacity={vis(w.year) ? 0.9 : 0.25} className={css.mark}>
                <line
                  x1={x(w.year)}
                  x2={x(w.year)}
                  y1={12}
                  y2={H - 22}
                  stroke="#94a9b7"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <title>{`WHO context (${w.year}): ${w.label}`}</title>
              </g>
            ))}

          {/* Selected-year vertical crosshair */}
          {p.selectedYear != null && p.selectedYear >= y0 && p.selectedYear <= y1 ? (
            <line
              x1={x(p.selectedYear)}
              x2={x(p.selectedYear)}
              y1={10}
              y2={H - 22}
              stroke="#8cf2dc"
              strokeWidth={1.3}
              strokeDasharray="3 3"
              opacity={0.85}
              pointerEvents="none"
            />
          ) : null}

          {/* Lane 1: MalariaGEN Pf8 Genomes */}
          {p.cells.map((c) => {
            const ok = c.n >= p.minN;
            return (
              <circle
                key={c.year}
                cx={x(c.year)}
                cy={LANES.genomes}
                r={radiusFor(c.n) * 0.58}
                fill={ok ? "#f5f4ef" : "#0d2233"}
                fillOpacity={ok ? 0.85 : 1}
                stroke={ok ? "#050d17" : "#94a9b7"}
                strokeWidth={1.2}
                strokeDasharray={ok ? undefined : "2 1.6"}
                className={`${css.mark} ${vis(c.year) ? "" : css.markHidden}`}
              >
                <title>{`${p.country}, collected ${c.year}: ${c.x}/${c.n}${ok ? "" : ` (below n≥${p.minN})`}${p.cellNote?.(c.year) ? `. ${p.cellNote(c.year)}` : ""}`}</title>
              </circle>
            );
          })}

          {/* Lane 2: PubMed Literature */}
          {p.papers.map((d) => (
            <g
              key={d.year}
              className={`${css.mark} ${vis(d.year) ? "" : css.markHidden}`}
              style={{ transformOrigin: "bottom" }}
            >
              <rect
                x={x(d.year) - 2.8}
                y={LANES.papers - barH(d.total)}
                width={5.6}
                height={barH(d.total)}
                rx={1.4}
                fill="#94a9b7"
                opacity={0.28}
              />
              {d.inCountry > 0 ? (
                <rect
                  x={x(d.year) - 2.8}
                  y={LANES.papers - barH(d.inCountry)}
                  width={5.6}
                  height={barH(d.inCountry)}
                  rx={1.4}
                  fill="#f5f4ef"
                />
              ) : null}
              <title>{`Published ${d.year}: ${d.total} K540E paper${d.total === 1 ? "" : "s"}, ${d.inCountry} naming ${p.country}`}</title>
            </g>
          ))}

          {/* Lane 3: System Public Graph */}
          {p.graph.map((g) => {
            const i = gSlot.get(g.year) ?? 0;
            gSlot.set(g.year, i + 1);
            return (
              <rect
                key={g.key}
                x={x(g.year) - 3.6}
                y={LANES.graph - 8 - i * 9}
                width={7.2}
                height={7.2}
                rx={1.4}
                fill={g.inCountry ? "#8cf2dc" : "#050d17"}
                stroke="#8cf2dc"
                strokeWidth={1.3}
                className={`${css.mark} ${vis(g.year) ? "" : css.markHidden}`}
              >
                <title>{g.label}</title>
              </rect>
            );
          })}

          {/* Replay future veil */}
          <rect
            x={x(p.replayYear) + 6}
            y={10}
            width={Math.max(0, W - x(p.replayYear) - 6)}
            height={H - 32}
            fill="#050d17"
            opacity={0.62}
            pointerEvents="none"
          />

          {/* Fired alert markers */}
          {placed.map(({ e, i }) => {
            const cy =
              LANES[e.source] -
              (e.source === "genomes" ? 16 : e.source === "papers" ? 36 : 0) +
              (e.source === "graph" ? 13 : 0);
            const cx = x(e.year) + i * 10;
            const sel = e.id === p.selectedId;
            return (
              <g
                key={e.id}
                transform={`translate(${cx} ${cy})`}
                className={`${css.mark} ${vis(e.year) ? "" : css.markHidden}`}
                style={{ color: "#e8964b", cursor: "pointer", outline: "none" }}
                tabIndex={vis(e.year) ? 0 : -1}
                role="button"
                aria-label={`Triggered moment, ${e.dateBasis === "collection" ? "collected" : "published"} ${e.year}. Press Enter to inspect.`}
                onClick={() => p.onSelect(e.id)}
                onKeyDown={(k) => {
                  if (k.key === "Enter" || k.key === " ") {
                    k.preventDefault();
                    p.onSelect(e.id);
                  }
                }}
              >
                {p.eventNote ? <title>{p.eventNote(e)}</title> : null}
                <circle r={10} fill="transparent" />
                {p.freshYear === e.year ? <circle className={css.pulse} r={5.5} /> : null}
                {sel ? <circle r={9} fill="none" stroke="#e8964b" strokeWidth={1.5} /> : null}
                <KindMark kind={e.kind} direction={e.direction} r={5} />
              </g>
            );
          })}

          {/* Replay Playhead */}
          <g
            className={css.playhead}
            style={{ transform: `translateX(${x(p.replayYear) + 6}px)` }}
            pointerEvents="none"
          >
            <line x1={0} x2={0} y1={10} y2={H - 22} stroke="#f5f4ef" strokeWidth={1.3} />
            <path d="M-4.5 10 L4.5 10 L0 16 Z" fill="#f5f4ef" />
          </g>
        </svg>
      </div>
    </section>
  );
}
