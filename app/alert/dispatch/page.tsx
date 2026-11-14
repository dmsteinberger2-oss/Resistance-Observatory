import type { Metadata } from "next";
import { composeAlert } from "@/lib/alert/compose";
import { deriveAlerts, type AlertEvent, type Trigger, type Watch, type WhoBasis } from "@/lib/alert/derive";
import { loadPack, toClientPack } from "@/lib/alert/loadPack";
import { RULE_TRIGGER, eventIdFor, getDefaultMapAlerts } from "@/lib/alert/mapAlerts";
import { markerFromUrlId, pmidStr, toAlertData, type ClientPack } from "@/lib/alert/pack";
import { buildPermalinkPath } from "@/lib/alert/quality";
import { GRAPH_RELEASE } from "@/lib/alert/receipt";
import { DispatchView } from "./DispatchView";

export const metadata: Metadata = {
  title: "Permanent Evidence Dispatch · Resistance Observatory",
  description:
    "Frozen archival surveillance dispatch for pfdhps K540E and sulfadoxine-pyrimethamine (SP), verified against MalariaGEN Pf8 and System Public Graph v2.1.",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const TRIG_MAP: Record<string, Trigger> = {
  who_band: "who_band",
  band: "who_band",
  rise: "rise",
  fall: "fall",
  change: "change",
  first_detection: "first_detection",
  first: "first_detection",
  very_high_combo: "very_high_combo",
  combo: "very_high_combo",
};

const TRIG_URL_CODE: Record<Trigger, string> = {
  who_band: "band",
  rise: "rise",
  fall: "fall",
  change: "change",
  first_detection: "first",
  very_high_combo: "combo",
};

function firstParam(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim() || null;
  return null;
}

function numParam(v: string | string[] | undefined, lo: number, hi: number): number | null {
  const s = firstParam(v);
  if (s === null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
}

function defaultsFor(basis: WhoBasis, presets: ClientPack["thresholds"]["presets"]) {
  const minN = presets?.min_samples ?? 20;
  const points = presets?.change_points ?? 20;
  if (basis === "east_southern_africa") return { trigger: "who_band" as Trigger, level: 60, points, minN };
  if (basis === "central_west_africa") {
    return { trigger: "first_detection" as Trigger, level: presets?.central_west_africa?.threshold_pct ?? 5, points, minN };
  }
  return { trigger: "change" as Trigger, level: presets?.outside_africa?.threshold_pct ?? 50, points, minN };
}

function pickBestEvent(events: AlertEvent[], findingId: string | null): AlertEvent | undefined {
  if (findingId) {
    const exact = events.find((e) => e.id === findingId);
    if (exact) return exact;
  }
  return (
    events.filter((e) => e.source === "genomes" && e.fired).at(-1) ??
    events.filter((e) => e.fired).at(-1) ??
    events.filter((e) => e.source === "genomes").at(-1) ??
    events.at(-1)
  );
}

export default async function AlertDispatchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const [rawPack, sp] = await Promise.all([loadPack(), searchParams]);

  if (!rawPack) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Permanent Evidence Dispatch
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          The K540E data pack is not installed
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          This route reads <code className="font-mono text-xs text-fg">k540e-data-pack/</code> at the repository root
          (MalariaGEN Pf8 genome counts, PubMed literature, System Public Graph v2.1, and WHO thresholds). No number is
          ever invented.
        </p>
      </div>
    );
  }

  const pack = toClientPack(rawPack);
  const mapAlerts = getDefaultMapAlerts();
  const alertParam = firstParam(sp.alert);
  const matchedMapAlert = alertParam ? mapAlerts.find((a) => a.id === alertParam) ?? null : null;

  const marker = markerFromUrlId(matchedMapAlert?.marker_id ?? firstParam(sp.marker));
  const data = toAlertData(marker, pack);
  const papers = new Map(pack.literature.papers.map((p) => [pmidStr(p.pmid), p]));

  const requestedArea = (matchedMapAlert?.country_iso3 ?? firstParam(sp.area) ?? "").toUpperCase();
  const hasValidArea = Boolean(requestedArea && pack.genomes.countries[requestedArea]);

  /* Default to COD 2022 rise>=25% demo alert when no valid area or alert id is specified */
  const area = hasValidArea ? requestedArea : pack.genomes.countries.COD ? "COD" : Object.keys(pack.genomes.countries)[0];
  const countryInfo = pack.genomes.countries[area];
  const country = countryInfo?.country ?? area;
  const basis: WhoBasis = countryInfo?.who_basis ?? "central_west_africa";
  const regDefaults = defaultsFor(basis, pack.thresholds.presets);

  const explicitTrigRaw = firstParam(sp.trig);
  const explicitTrig = explicitTrigRaw ? TRIG_MAP[explicitTrigRaw] ?? null : null;

  let watch: Watch;
  let findingId: string | null = firstParam(sp.finding);

  if (matchedMapAlert) {
    watch = {
      marker: marker.key,
      area,
      trigger: RULE_TRIGGER[matchedMapAlert.rule] ?? regDefaults.trigger,
      level: numParam(sp.level, 0, 100) ?? regDefaults.level,
      points: numParam(sp.pts, 1, 100) ?? regDefaults.points,
      minN: numParam(sp.n, 1, 1000) ?? regDefaults.minN,
    };
    findingId = findingId ?? eventIdFor(matchedMapAlert);
  } else if (!hasValidArea) {
    watch = {
      marker: marker.key,
      area: "COD",
      trigger: "rise",
      level: 25,
      points: regDefaults.points,
      minN: regDefaults.minN,
    };
    findingId = findingId ?? "g:COD:2022:level_crossed";
  } else {
    watch = {
      marker: marker.key,
      area,
      trigger: explicitTrig ?? regDefaults.trigger,
      level: numParam(sp.level, 0, 100) ?? regDefaults.level,
      points: numParam(sp.pts, 1, 100) ?? regDefaults.points,
      minN: numParam(sp.n, 1, 1000) ?? regDefaults.minN,
    };
  }

  let events = deriveAlerts(watch, data);
  let chosen = pickBestEvent(events, findingId);

  /* If area was specified without an explicit trigger and default watch had no fired genome alert (e.g. COD),
   * check rise>=25% so the country's flagship emergence signal is surfaced cleanly. */
  if (
    hasValidArea &&
    !matchedMapAlert &&
    !explicitTrig &&
    !findingId &&
    (!chosen || !chosen.fired) &&
    area === "COD"
  ) {
    const demoWatch: Watch = { ...watch, trigger: "rise", level: 25 };
    const demoEvents = deriveAlerts(demoWatch, data);
    const demoChosen = pickBestEvent(demoEvents, "g:COD:2022:level_crossed");
    if (demoChosen) {
      watch = demoWatch;
      events = demoEvents;
      chosen = demoChosen;
    }
  }

  /* Ultimate safety net so /alert/dispatch NEVER renders an empty error state */
  if (!chosen) {
    const fallbackWatch: Watch = {
      marker: marker.key,
      area: "COD",
      trigger: "rise",
      level: 25,
      points: 20,
      minN: 20,
    };
    const fallbackEvents = deriveAlerts(fallbackWatch, data);
    const fallbackChosen = pickBestEvent(fallbackEvents, "g:COD:2022:level_crossed") ?? fallbackEvents[0];
    watch = fallbackWatch;
    chosen = fallbackChosen;
  }

  const composed = composeAlert({
    e: chosen,
    watch,
    marker,
    country,
    basis: pack.genomes.countries[watch.area]?.who_basis ?? basis,
    pack,
    cells: data.cells,
    papers,
  });

  const permalinkPath = buildPermalinkPath({
    alertId: matchedMapAlert?.id ?? null,
    markerUrlId: marker.urlId,
    area: watch.area,
    trig: watch.trigger,
    level: watch.trigger === "rise" || watch.trigger === "fall" ? watch.level : undefined,
    findingId: chosen.id,
  });

  const obsParams = new URLSearchParams({
    marker: marker.urlId,
    area: watch.area,
    trig: TRIG_URL_CODE[watch.trigger],
  });
  if (watch.trigger === "rise" || watch.trigger === "fall") {
    obsParams.set("level", String(watch.level));
  } else if (watch.trigger === "change") {
    obsParams.set("pts", String(watch.points));
  }
  obsParams.set("finding", chosen.id);
  const observatoryHref = `/alert?${obsParams.toString()}`;

  const mapParams = new URLSearchParams({
    country: watch.area,
    marker: marker.urlId,
  });
  if (chosen.year) {
    mapParams.set("range", `1966-${chosen.year}`);
  }
  const mapHref = `/forecast?${mapParams.toString()}`;

  const asOfLine = `Evaluated against frozen snapshot · MalariaGEN Pf8 & ${GRAPH_RELEASE}.`;

  return (
    <DispatchView
      composed={composed}
      event={chosen}
      watch={watch}
      marker={marker}
      country={pack.genomes.countries[watch.area]?.country ?? country}
      basis={pack.genomes.countries[watch.area]?.who_basis ?? basis}
      alertId={matchedMapAlert?.id ?? null}
      permalinkPath={permalinkPath}
      observatoryHref={observatoryHref}
      mapHref={mapHref}
      asOfLine={asOfLine}
    />
  );
}
