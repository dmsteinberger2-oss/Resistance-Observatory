"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  countryCells,
  deriveAlerts,
  firedCount,
  type AlertEvent,
  type Trigger,
  type Watch,
  type WhoBasis,
} from "@/lib/alert/derive";
import { eventCopy } from "@/lib/alert/copy";
import {
  markerFromUrlId,
  pmidStr,
  toAlertData,
  type ClientPack,
  type Paper,
} from "@/lib/alert/pack";
import { GRAPH_RELEASE } from "@/lib/alert/receipt";
import { RULE_TRIGGER, eventIdFor, getDefaultMapAlerts } from "@/lib/alert/mapAlerts";
import {
  EVIDENCE_TIER,
  geoScope,
  localPrior,
  methodText,
  studyCellFor,
} from "@/lib/alert/context";
import { buildQualityLedger } from "@/lib/alert/quality";
import type { CountryRow } from "./CountryPicker";
import { WatchSentence } from "./WatchSentence";
import { SendTestAlert } from "./SendTestAlert";
import { HistoryChart } from "./HistoryChart";
import { SourceLanes, type GraphTick, type PaperTick, type WhoYear } from "./SourceLanes";
import { AlertFeed } from "./AlertFeed";
import { AlertDetail } from "./AlertDetail";
import { FidelityInspector } from "./FidelityInspector";
import { useSystem, type LiveProbe } from "./useSystem";
import css from "./alert.module.css";

/* ---------------------------------------------------------- watch state --- */

const TRIG_CODE: Record<Trigger, string> = {
  who_band: "band",
  rise: "rise",
  fall: "fall",
  change: "change",
  first_detection: "first",
  very_high_combo: "combo",
};
const CODE_TRIG = Object.fromEntries(
  Object.entries(TRIG_CODE).map(([k, v]) => [v, k]),
) as Record<string, Trigger>;

type Defaults = Pick<Watch, "trigger" | "level" | "points" | "minN">;

function defaultsFor(basis: WhoBasis, presets: ClientPack["thresholds"]["presets"]): Defaults {
  const minN = presets?.min_samples ?? 20;
  const points = presets?.change_points ?? 20;
  if (basis === "east_southern_africa") return { trigger: "who_band", level: 60, points, minN };
  if (basis === "central_west_africa") {
    return {
      trigger: "first_detection",
      level: presets?.central_west_africa?.threshold_pct ?? 5,
      points,
      minN,
    };
  }
  return {
    trigger: "change",
    level: presets?.outside_africa?.threshold_pct ?? 50,
    points,
    minN,
  };
}

const WATCH_PARAMS = ["area", "trig", "level", "pts", "n"] as const;

/* ------------------------------------------------------------ component --- */

export function AlertTab({ pack }: { pack: ClientPack }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  /* Resolve incoming /alert?alert=<id> synchronously on initial render AND normalize URL */
  const alertParam = sp.get("alert");
  const incomingAlert = useMemo(
    () => (alertParam ? getDefaultMapAlerts().find((x) => x.id === alertParam) : undefined),
    [alertParam],
  );

  const marker = markerFromUrlId(incomingAlert?.marker_id ?? sp.get("marker"));

  /* Countries with data for this marker */
  const rows = pack.genomes.observations[marker.key] ?? [];
  const countryStats = useMemo(() => {
    const m = new Map<string, { cells: number; samples: number; first: number; last: number }>();
    for (const [iso, year, , n] of rows) {
      if (n <= 0) continue;
      const s = m.get(iso) ?? { cells: 0, samples: 0, first: year, last: year };
      s.cells++;
      s.samples += n;
      s.first = Math.min(s.first, year);
      s.last = Math.max(s.last, year);
      m.set(iso, s);
    }
    return m;
  }, [rows]);

  const countryName = useCallback(
    (iso: string) => pack.genomes.countries[iso]?.country ?? iso,
    [pack.genomes.countries],
  );
  const isoList = useMemo(
    () => [...countryStats.keys()].sort((a, b) => countryName(a).localeCompare(countryName(b))),
    [countryStats, countryName],
  );

  const paperCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pack.literature.papers) {
      for (const iso of p.countries_iso3 ?? []) m.set(iso, (m.get(iso) ?? 0) + 1);
    }
    return m;
  }, [pack.literature.papers]);

  const areaCandidate = (incomingAlert?.country_iso3 ?? sp.get("area") ?? "").toUpperCase();
  const area = countryStats.has(areaCandidate)
    ? areaCandidate
    : countryStats.has("KEN")
      ? "KEN"
      : (isoList[0] ?? "");
  const basis: WhoBasis = pack.genomes.countries[area]?.who_basis ?? "outside_africa";
  const defaults = defaultsFor(basis, pack.thresholds.presets);

  const intParam = (k: string, lo: number, hi: number) => {
    const v = Number(sp.get(k));
    return sp.get(k) !== null && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
  };

  const incomingTrigger: Trigger | null = incomingAlert
    ? (RULE_TRIGGER[incomingAlert.rule] ?? "who_band")
    : null;

  const watch: Watch = useMemo(
    () => ({
      marker: marker.key,
      area,
      trigger: incomingTrigger ?? CODE_TRIG[sp.get("trig") ?? ""] ?? defaults.trigger,
      level: intParam("level", 0, 100) ?? defaults.level,
      points: intParam("pts", 1, 100) ?? defaults.points,
      minN: intParam("n", 1, 1000) ?? defaults.minN,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp, marker.key, area, incomingTrigger, defaults.trigger, defaults.level, defaults.points, defaults.minN],
  );

  const replaceParams = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(sp.toString());
      mutate(q);
      if (!q.get("marker")) q.set("marker", marker.urlId);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [sp, router, pathname, marker.urlId],
  );

  const setWatch = (patch: Partial<Record<(typeof WATCH_PARAMS)[number], string | null>>) =>
    replaceParams((q) => {
      for (const [k, v] of Object.entries(patch)) v === null ? q.delete(k) : q.set(k, v);
      q.delete("finding");
    });

  const setArea = (iso: string) =>
    replaceParams((q) => {
      for (const k of WATCH_PARAMS) q.delete(k);
      q.set("area", iso);
      q.delete("finding");
    });

  const select = (id: string | null) =>
    replaceParams((q) => (id ? q.set("finding", id) : q.delete("finding")));

  /* Normalize incoming /alert?alert=<id> into canonical watch query params */
  useEffect(() => {
    if (!alertParam) return;
    const a = getDefaultMapAlerts().find((x) => x.id === alertParam);
    replaceParams((q) => {
      q.delete("alert");
      if (!a) return;
      for (const k of WATCH_PARAMS) q.delete(k);
      q.set("marker", a.marker_id);
      q.set("area", a.country_iso3);
      q.set("trig", TRIG_CODE[RULE_TRIGGER[a.rule] ?? "who_band"]);
      q.set("finding", eventIdFor(a));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertParam]);

  useEffect(() => {
    if (alertParam) return;
    if (area && (sp.get("marker") !== marker.urlId || sp.get("area") !== area)) {
      replaceParams((q) => {
        q.set("marker", marker.urlId);
        q.set("area", area);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, marker.urlId, alertParam]);

  const pickerRows: CountryRow[] = useMemo(
    () =>
      isoList.map((iso) => ({
        iso3: iso,
        name: countryName(iso),
        basis: pack.genomes.countries[iso]?.who_basis ?? "outside_africa",
        cells: countryStats.get(iso)?.cells ?? 0,
        qualifying: rows.filter((r) => r[0] === iso && r[3] >= watch.minN).length,
        papers: paperCounts.get(iso) ?? 0,
      })),
    [isoList, countryName, pack.genomes.countries, countryStats, rows, watch.minN, paperCounts],
  );

  /* Derivation & Quality Ledger */
  const data = useMemo(() => toAlertData(marker, pack), [marker, pack]);
  const events = useMemo(() => deriveAlerts(watch, data), [watch, data]);
  const cells = useMemo(() => countryCells(data.cells, area), [data.cells, area]);
  const companion = useMemo(() => countryCells(data.a581g, area), [data.a581g, area]);
  const papers = useMemo(
    () => new Map<string, Paper>(pack.literature.papers.map((p) => [pmidStr(p.pmid), p])),
    [pack.literature.papers],
  );
  const country = countryName(area);
  const ledger = useMemo(
    () => buildQualityLedger(pack, area, country),
    [pack, area, country],
  );
  const countryPaperFigures = useMemo(
    () => pack.literature.abstract_prevalence.filter((f) => f.iso3 === area),
    [pack.literature.abstract_prevalence, area],
  );

  /* Replay state */
  const lastYear = useMemo(
    () => Math.max(...pack.literature.papers.map((p) => p.pub_year), ...rows.map((r) => r[1]), 0),
    [pack.literature.papers, rows],
  );
  const firstPaperYear = useMemo(
    () =>
      pack.literature.papers.length
        ? Math.min(...pack.literature.papers.map((p) => p.pub_year))
        : rows.length
          ? Math.min(...rows.map((r) => r[1]))
          : lastYear,
    [pack.literature.papers, rows, lastYear],
  );
  const firstYear = Math.min(cells[0]?.year ?? firstPaperYear, firstPaperYear) - 1;
  const [replayYear, setReplayYear] = useState(lastYear);
  const [playing, setPlaying] = useState(false);
  const [freshYear, setFreshYear] = useState<number | null>(null);

  useEffect(() => {
    setReplayYear(lastYear);
    setPlaying(false);
    setFreshYear(null);
  }, [area, lastYear]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setReplayYear((y) => {
        if (y >= lastYear) {
          setPlaying(false);
          return y;
        }
        setFreshYear(y + 1);
        return y + 1;
      });
    }, 620);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, lastYear]);

  const togglePlay = () => {
    if (!playing && replayYear >= lastYear) {
      setReplayYear(firstYear);
      setFreshYear(null);
    }
    setPlaying((p) => !p);
  };

  const resetReplay = () => {
    setPlaying(false);
    setFreshYear(null);
    setReplayYear(lastYear);
  };

  /* Selected moment (explicit URL finding or incoming ?alert=, falling back to newest fired/context moment) */
  const explicitFindingId = incomingAlert ? eventIdFor(incomingAlert) : sp.get("finding");
  const visibleEvents = useMemo(
    () => events.filter((e) => e.year <= replayYear),
    [events, replayYear],
  );
  const placedVisible = useMemo(
    () => visibleEvents.filter((e) => !e.noCountryGiven),
    [visibleEvents],
  );

  const selected: AlertEvent | null = useMemo(() => {
    if (explicitFindingId) {
      const exact = events.find((e) => e.id === explicitFindingId);
      if (exact) return exact;
    }
    return (
      placedVisible.filter((e) => e.source === "genomes" && e.fired).at(-1) ??
      placedVisible.filter((e) => e.fired).at(-1) ??
      placedVisible.at(-1) ??
      events.find((e) => !e.noCountryGiven) ??
      null
    );
  }, [explicitFindingId, events, placedVisible]);

  const firedTotal = useMemo(
    () => firedCount(events.filter((e) => !e.noCountryGiven)),
    [events],
  );

  /* Provenance notes for feed & lanes */
  const cellNote = useCallback(
    (year: number): string => {
      const c = studyCellFor(pack.studyContext, area, year);
      if (!c) return "";
      const alt = c.codon540_breakdown.alt_mutant_540N;
      return `${EVIDENCE_TIER.genomes}: ${c.study_count} stud${c.study_count === 1 ? "y" : "ies"} (${c.studies.map((s) => s.study_id).join(", ")}) · ${geoScope(c, marker.mutation).short.replace(/ \([^)]*\)$/, "")} · ${methodText(c.dna_method_all)}${
        alt > 0 ? ` · K540N in ${alt}/${c.n}` : ""
      }`;
    },
    [pack.studyContext, area, marker.mutation],
  );

  const flagForFeed = useCallback(
    (e: AlertEvent): string | null => {
      if (e.source === "genomes" && e.cell) {
        const c = studyCellFor(pack.studyContext, area, e.cell.year);
        const parts: string[] = [];
        if (c) {
          const g = geoScope(c, marker.mutation);
          if (g.flag) parts.push(g.site ? `${g.flag}: ${g.site}` : g.flag);
          parts.push(methodText(c.dna_method_all));
          if (c.codon540_breakdown.alt_mutant_540N > 0) {
            parts.push(`K540N (${c.codon540_breakdown.alt_mutant_540N}/${c.n})`);
          }
        }
        const prior = localPrior(data.cells, area, e.cell.year);
        if (prior.kind === "zero") parts.push("Zero local prior");
        return parts.join(" · ") || null;
      }
      if (e.source === "papers" && e.pmid) {
        const p = papers.get(e.pmid);
        return p?.title ?? `PMID ${e.pmid}`;
      }
      if (e.source === "graph" && e.graphFindingId) {
        const f = pack.graph.haplotype_findings.find((x) => x.system_id === e.graphFindingId);
        return f ? `${f.variable_1} ↔ ${f.variable_2}` : e.graphFindingId;
      }
      return null;
    },
    [pack.studyContext, pack.graph.haplotype_findings, area, marker.mutation, data.cells, papers],
  );

  /* Synchronized lane data */
  const paperTicks: PaperTick[] = useMemo(() => {
    const m = new Map<number, PaperTick>();
    for (const p of pack.literature.papers) {
      const t = m.get(p.pub_year) ?? { year: p.pub_year, total: 0, inCountry: 0 };
      t.total++;
      if ((p.countries_iso3 ?? []).includes(area)) t.inCountry++;
      m.set(p.pub_year, t);
    }
    return [...m.values()].sort((a, b) => a.year - b.year);
  }, [pack.literature.papers, area]);

  const graphTicks: GraphTick[] = useMemo(
    () =>
      [
        ...pack.literature.papers
          .filter((p) => p.in_graph)
          .map((p) => ({
            year: p.pub_year,
            key: `paper-${pmidStr(p.pmid)}`,
            inCountry: (p.countries_iso3 ?? []).includes(area),
            label: `Graph ingested (${p.pub_year}): ${p.title}`,
          })),
        ...(data.graphFindings ?? []).map((f) => ({
          year: f.pubYear,
          key: `finding-${f.id}`,
          inCountry: f.iso3 === area,
          label: `Graph haplotype finding ${f.id} (${f.pubYear})`,
        })),
      ].sort((a, b) => a.year - b.year),
    [pack.literature.papers, data.graphFindings, area],
  );

  const whoYears: WhoYear[] = useMemo(() => {
    const out: WhoYear[] = (pack.thresholds.history ?? []).map((h) => ({
      year: h.year,
      label: h.text,
    }));
    const src = pack.thresholds.who_categories?.sources?.[0]?.name;
    const y = src ? Number(/(\d{4})\s*$/.exec(src)?.[1]) : NaN;
    if (src && Number.isFinite(y)) out.push({ year: y, label: src });
    return out.sort((a, b) => a.year - b.year);
  }, [pack.thresholds]);

  /* Live System API status + email configuration */
  const liveProbe = useSystem<LiveProbe>(
    `op=probe&q=${encodeURIComponent(marker.probes[0] ?? marker.mutation)}`,
  );
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean; from: string } | null>(
    null,
  );
  useEffect(() => {
    fetch("/api/alert/email")
      .then((r) => r.json())
      .then(setEmailStatus)
      .catch(() => setEmailStatus({ configured: false, from: "" }));
  }, []);

  const fmtDate = (iso: string | undefined) => {
    const m = iso ? /(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
    return m
      ? `${Number(m[3])} ${
          [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ][Number(m[2]) - 1]
        } ${m[1]}`
      : null;
  };
  const lastCollection = rows.reduce((mx, r) => Math.max(mx, r[1]), 0);
  const pubmedDate = fmtDate(pack.literature._meta?.source as string | undefined);
  const asOfLine = `Data as of: genome counts, MalariaGEN Pf8, collections to ${lastCollection}; papers, PubMed searched ${pubmedDate ?? "date not stated"}; ${GRAPH_RELEASE}.`;

  const linkTo = (path: string) =>
    `${path}?marker=${encodeURIComponent(marker.urlId)}&area=${encodeURIComponent(area)}`;

  /* BENJAMIN'S EXACT MAP-YEAR LINK FIX */
  const forecastLink = `/forecast?country=${encodeURIComponent(area)}&marker=${encodeURIComponent(marker.urlId)}${selected ? `&range=1966-${selected.year}` : ""}`;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-6 sm:px-6">
      {/* ZONE 1: COMPACT OBSERVATORY MASTHEAD & SLEEK HORIZONTAL WATCH BAR */}
      <header className="mb-5 space-y-3.5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.16em] text-drug">
              <span className="inline-block h-px w-6 bg-drug" aria-hidden />
              EVIDENCE SURVEILLANCE · REPLAY ON REAL PUBLICATION HISTORY
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              <span className="text-signal">pfdhps K540E</span>{" "}
              <span className="font-normal text-muted">&amp;</span>{" "}
              <span className="text-drug">{marker.drug}</span>
            </h1>
          </div>

          {/* Live System API / Snapshot Status Pill */}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[#ffffff20] bg-[#0d2233] px-3 py-1.5 font-mono text-xs text-[#c4cdd6]"
            aria-live="polite"
          >
            {liveProbe?.state === "live" ? (
              <>
                <span className={`h-2 w-2 rounded-full bg-drug ${css.liveDot}`} aria-hidden />
                <span className="font-medium text-drug">System API · connected</span>
              </>
            ) : liveProbe?.state === "loading" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-muted" aria-hidden />
                <span>Checking System API…</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-signal" aria-hidden />
                <span className="text-signal">Snapshot fallback</span>
              </>
            )}
            <span className="text-muted">·</span>
            <span className="text-muted">{GRAPH_RELEASE}</span>
          </div>
        </div>

        {/* Sleek Horizontal Watch Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ffffff1f] bg-[#0d2233]/95 px-4 py-3 shadow-[0_20px_50px_#040b1466]">
          <WatchSentence
            marker={marker}
            watch={watch}
            basis={basis}
            pickerRows={pickerRows}
            firedTotal={firedTotal}
            onAreaChange={setArea}
            onTriggerChange={(t) => setWatch({ trig: TRIG_CODE[t] })}
            onLevelChange={(lvl) => setWatch({ level: lvl })}
          />

          <SendTestAlert
            pack={pack}
            marker={marker}
            data={data}
            papers={papers}
            asOfLine={asOfLine}
            configured={emailStatus ? emailStatus.configured : null}
            onJump={(qs) =>
              replaceParams((q) => {
                for (const k of WATCH_PARAMS) q.delete(k);
                for (const [k, v] of Object.entries(qs)) q.set(k, v);
              })
            }
          />
        </div>
      </header>

      {/* ZONES 2 & 3: 57% LEFT TRAJECTORY / REPLAY / FEED + 43% STICKY 3-TAB INSPECTOR */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,57fr)_minmax(0,43fr)]">
        {/* ZONE 2: LEFT COLUMN (~57%) */}
        <div className="min-w-0 space-y-4">
          <HistoryChart
            country={country}
            marker={marker.label}
            drug={marker.drug}
            cells={cells}
            companion={companion}
            paperFigures={countryPaperFigures}
            allEvents={events}
            watch={watch}
            basis={basis}
            domain={[firstYear, lastYear]}
            replayYear={replayYear}
            onReplayYear={(y) => {
              setPlaying(false);
              setFreshYear(null);
              setReplayYear(y);
            }}
            playing={playing}
            onTogglePlay={togglePlay}
            onResetReplay={resetReplay}
            freshYear={freshYear}
            selectedId={selected?.id ?? null}
            selectedYear={selected?.year ?? null}
            onSelect={(id) => select(id)}
          />

          <SourceLanes
            domain={[firstYear, lastYear]}
            replayYear={replayYear}
            country={country}
            minN={watch.minN}
            cells={cells}
            cellNote={cellNote}
            eventNote={(e) =>
              `${eventCopy(e, watch, marker.label, country).title}${
                e.source === "genomes" && cellNote(e.year) ? ` · ${cellNote(e.year)}` : ""
              }`
            }
            papers={paperTicks}
            graph={graphTicks}
            events={events.filter((e) => !e.noCountryGiven)}
            whoYears={whoYears}
            selectedId={selected?.id ?? null}
            selectedYear={selected?.year ?? null}
            onSelect={(id) => select(id)}
            freshYear={freshYear}
          />

          <AlertFeed
            events={visibleEvents}
            watch={watch}
            markerLabel={marker.label}
            country={country}
            replayYear={replayYear}
            lastYear={lastYear}
            hasCells={cells.length > 0}
            selectedId={selected?.id ?? null}
            freshYear={freshYear}
            flagFor={flagForFeed}
            onSelect={(id) => select(id)}
          />
        </div>

        {/* ZONE 3: RIGHT COLUMN (~43%, STICKY) */}
        <div id="alert-detail" className="min-w-0 scroll-mt-24 lg:sticky lg:top-24">
          {selected ? (
            <AlertDetail
              event={selected}
              watch={watch}
              marker={marker}
              country={country}
              basis={basis}
              pack={pack}
              cells={data.cells}
              papers={papers}
              ledger={ledger}
              asOfLine={asOfLine}
              emailConfigured={emailStatus ? emailStatus.configured : null}
              emailFrom={emailStatus?.from ?? null}
              links={{
                forecast: forecastLink,
                learn: linkTo("/learn"),
              }}
            />
          ) : (
            <div className="space-y-4 rounded-xl border border-[#ffffff20] bg-[#0d2233] p-5 shadow-[0_24px_64px_#03091280]">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                  Graph Fidelity &amp; Provenance Inspector
                </p>
                <p className="mt-1 text-sm text-[#c4cdd6]">
                  No triggered genome or literature moments matched {country} under this rule. You
                  can still audit System Graph associations and quarantined errors below.
                </p>
              </div>
              <FidelityInspector ledger={ledger} marker={marker} country={country} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
