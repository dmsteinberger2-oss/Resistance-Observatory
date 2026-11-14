/**
 * Pure data access for the Forecast tab. No React; safe in client components.
 * Every value comes from the two pinned JSON files in data/forecast/.
 */
import genomeJson from "@/data/forecast/genome-k540e.json";
import graphJson from "@/data/forecast/graph-findings.json";
import verificationJson from "@/data/forecast/graph-verification.json";
import type {
  AlertFeed,
  AlertRecord,
  GenomeChange,
  GenomeDataset,
  GenomeSnapshot,
  GenomeYear,
  GraphDataset,
  GraphFinding,
  GraphVerification,
  GraphVerificationMeta,
  Iso3,
  VerificationCounts,
  VerificationStatus,
} from "./types";

export const GENOME: GenomeDataset = genomeJson as GenomeDataset;

/* ----- Paper spot-check join (by systemId). Unknown statuses are ignored, never guessed. ----- */
const STATUSES: readonly VerificationStatus[] = [
  "supported",
  "partly_supported",
  "contradicted",
  "not_verifiable",
];
interface RawVerificationFile {
  method?: unknown;
  checkedBy?: unknown;
  checkedAt?: unknown;
  scope?: unknown;
  records?: unknown;
}
const rawVerification = verificationJson as RawVerificationFile;
const strOrNull = (x: unknown): string | null => (typeof x === "string" ? x : null);
const VERIFICATION_BY_ID = new Map<string, GraphVerification>();
for (const r of Array.isArray(rawVerification.records) ? rawVerification.records : []) {
  const rec = r as Record<string, unknown>;
  const status = rec.status as VerificationStatus;
  if (typeof rec.systemId !== "string" || !STATUSES.includes(status)) continue;
  VERIFICATION_BY_ID.set(rec.systemId, {
    status,
    where: rec.where === "abstract" || rec.where === "full_text" ? rec.where : null,
    quote: strOrNull(rec.quote),
    note: strOrNull(rec.note),
    countryAgrees: typeof rec.countryAgrees === "boolean" ? rec.countryAgrees : null,
  });
}

const graphBase = graphJson as GraphDataset;
export const GRAPH: GraphDataset = {
  ...graphBase,
  findings: graphBase.findings.map((f) => ({
    ...f,
    verification: VERIFICATION_BY_ID.get(f.systemId) ?? null,
  })),
};

export function verificationCounts(findings: GraphFinding[]): VerificationCounts {
  const c: VerificationCounts = {
    supported: 0,
    partly_supported: 0,
    contradicted: 0,
    not_verifiable: 0,
    unchecked: 0,
  };
  for (const f of findings) c[f.verification ? f.verification.status : "unchecked"] += 1;
  return c;
}

export const GRAPH_VERIFICATION: GraphVerificationMeta = {
  method: strOrNull(rawVerification.method) ?? "",
  checkedBy: strOrNull(rawVerification.checkedBy) ?? "",
  checkedAt: strOrNull(rawVerification.checkedAt) ?? "",
  scope: strOrNull(rawVerification.scope) ?? "",
  counts: verificationCounts(GRAPH.findings),
};
export const MIN_YEAR: number = GENOME.minYear;
export const MAX_YEAR: number = GENOME.maxYear;
export const MARKER_ID = "pfdhps-K540E";

const GENOME_BY_ISO: Record<Iso3, GenomeYear[]> = Object.fromEntries(
  GENOME.countries.map((c) => [c.iso3, c.years]),
);

export function clampYear(y: number): number {
  if (!Number.isFinite(y)) return MAX_YEAR;
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.round(y)));
}

export function genomeSnapshot(iso3: Iso3, asOfYear: number): GenomeSnapshot {
  const all = GENOME_BY_ISO[iso3] ?? [];
  const years = all.filter((y) => y.year <= asOfYear);
  let latest: GenomeYear | null = null;
  let firstTestedYear: number | null = null;
  let firstDetectionYear: number | null = null;
  let totalTested = 0;
  let totalWithE = 0;
  let totalOther = 0;
  for (const y of years) {
    totalTested += y.tested;
    totalWithE += y.withE;
    totalOther += y.other;
    if (y.tested > 0) {
      latest = y;
      if (firstTestedYear === null) firstTestedYear = y.year;
    }
    if (y.withE > 0 && firstDetectionYear === null) firstDetectionYear = y.year;
  }
  const state =
    totalWithE > 0 ? "detected" : totalTested > 0 ? "tested_not_detected" : "not_sampled";
  return {
    iso3,
    asOfYear,
    state,
    years,
    latest,
    firstTestedYear,
    firstDetectionYear,
    totalTested,
    totalWithE,
    totalOther,
  };
}

export function allGenomeSnapshots(asOfYear: number): Record<Iso3, GenomeSnapshot> {
  const out: Record<Iso3, GenomeSnapshot> = {};
  for (const c of GENOME.countries) out[c.iso3] = genomeSnapshot(c.iso3, asOfYear);
  return out;
}

export function genomeChangesInYear(year: number): GenomeChange[] {
  const out: GenomeChange[] = [];
  for (const c of GENOME.countries) {
    const counts = c.years.find((y) => y.year === year);
    if (!counts) continue;
    const before = genomeSnapshot(c.iso3, year - 1);
    if (counts.tested > 0 && before.firstTestedYear === null) {
      out.push({ iso3: c.iso3, year, kind: "first_tested", counts });
    }
    if (counts.withE > 0 && before.firstDetectionYear === null) {
      out.push({ iso3: c.iso3, year, kind: "first_detection", counts });
    }
  }
  return out;
}

function byPaperYear(a: GraphFinding, b: GraphFinding): number {
  const ya = a.paper.year;
  const yb = b.paper.year;
  if (ya === null && yb === null) return a.systemId.localeCompare(b.systemId);
  if (ya === null) return 1;
  if (yb === null) return -1;
  return ya - yb || a.systemId.localeCompare(b.systemId);
}

function visible(f: GraphFinding, asOfYear?: number): boolean {
  return asOfYear === undefined || f.paper.year === null || f.paper.year <= asOfYear;
}

export function graphFindingsFor(
  iso3: Iso3,
  asOfYear?: number,
): { sp: GraphFinding[]; codon540: GraphFinding[] } {
  const hits = GRAPH.findings
    .filter((f) => f.countries.some((c) => c.iso3 === iso3) && visible(f, asOfYear))
    .sort(byPaperYear);
  return {
    sp: hits.filter((f) => f.kind === "sp"),
    codon540: hits.filter((f) => f.kind === "codon540"),
  };
}

export type GraphCountryCounts = { sp: number; codon540: number } & VerificationCounts;

/** sp / codon540 count findings by kind; the five verification fields count both kinds together. */
export function graphCountsByCountry(asOfYear?: number): Record<Iso3, GraphCountryCounts> {
  const out: Record<Iso3, GraphCountryCounts> = {};
  for (const f of GRAPH.findings) {
    if (!visible(f, asOfYear)) continue;
    const isos = new Set(f.countries.map((c) => c.iso3));
    for (const iso of isos) {
      const row = (out[iso] ??= {
        sp: 0,
        codon540: 0,
        supported: 0,
        partly_supported: 0,
        contradicted: 0,
        not_verifiable: 0,
        unchecked: 0,
      });
      row[f.kind] += 1;
      row[f.verification ? f.verification.status : "unchecked"] += 1;
    }
  }
  return out;
}

export function alertsFor(feed: AlertFeed, iso3: Iso3, asOfYear?: number): AlertRecord[] {
  return feed.alerts
    .filter((a) => a.country_iso3 === iso3 && (asOfYear === undefined || a.year <= asOfYear))
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}
