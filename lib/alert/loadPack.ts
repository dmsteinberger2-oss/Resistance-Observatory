/**
 * Server-only: read the data pack from disk. The Alert page is prerendered,
 * so this runs at build time; the System route also reads the vetted id list
 * at request time. Returns null when the pack is not installed, and the tab
 * says so rather than showing anything invented.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StudyContextFile } from "./context";
import type {
  AuditedGraphRecord,
  ClientPack,
  GenomesFile,
  GraphFile,
  LiteratureFile,
  Pack,
  ThresholdsFile,
  VerificationStatus,
} from "./pack";

const dir = () => process.env.ALERT_PACK_DIR || path.join(process.cwd(), "k540e-data-pack");
const dataRoot = () => process.env.ALERT_DATA_DIR || path.join(process.cwd(), "data");

async function json<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(dir(), name), "utf8")) as T;
}

async function dataJson<T>(relPath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(dataRoot(), relPath), "utf8")) as T;
  } catch {
    return null;
  }
}

type ForecastGraphFindingsFile = {
  findings?: {
    systemId: string;
    kind: "codon540" | "haplotype" | "sp";
    spLooksLikeUptake?: boolean;
    variable1?: string;
    variable2?: string;
    statisticType?: string | null;
    statisticValue?: number | null;
    ciLower?: number | null;
    ciUpper?: number | null;
    pValue?: number | null;
    studyId?: string | null;
    pubmedId?: string | number | null;
    population?: string | null;
    countries?: { iso3: string; matchedText?: string }[];
    paper?: { year?: number | null } | null;
    inVettedCsv?: boolean;
  }[];
};

type ForecastVerificationFile = {
  records?: {
    systemId: string;
    pubmedId?: string | number | null;
    status: "supported" | "partly_supported" | "contradicted" | "not_verifiable";
    quote?: string | null;
    note?: string | null;
  }[];
};

type RawGraphAssoc = {
  system_id: string;
  study_id?: string | null;
  pubmed_id?: string | number | null;
  variable_1_name?: string;
  variable_2_name?: string;
  statistic_type?: string | null;
  statistic_value?: number | null;
  ci_lower?: number | null;
  ci_upper?: number | null;
  p_value?: number | null;
  in_vetted_csv?: boolean;
  vetted?: boolean;
  vetting_note?: string | null;
};

type GraphStatsFile = {
  rawAssociations?: RawGraphAssoc[];
  marker?: {
    associations?: RawGraphAssoc[];
    studies?: { study_id: string; pubmed_id?: string | number | null; study_type?: string | null; population?: string | null }[];
    publication_dates?: { pubmed_id: string | number; publication_date?: string | null }[];
  };
};

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function loadStudyTypes(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = await readFile(path.join(dataRoot(), "forecast/raw/graph/dataverse-studies-subset.tsv"), "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (const line of lines.slice(1)) {
      const cols = parseCsvRow(line);
      const studyId = cols[0]?.trim();
      const studyType = cols[4]?.trim();
      if (studyId && studyType) map.set(studyId, studyType);
    }
  } catch {
    /* optional auxiliary file */
  }
  return map;
}

export async function loadAuditedGraph(): Promise<AuditedGraphRecord[]> {
  const [gf, gv, gs, studyTypes] = await Promise.all([
    dataJson<ForecastGraphFindingsFile>("forecast/graph-findings.json"),
    dataJson<ForecastVerificationFile>("forecast/graph-verification.json"),
    dataJson<GraphStatsFile>("graph-stats.json"),
    loadStudyTypes(),
  ]);

  const verById = new Map((gv?.records ?? []).map((r) => [r.systemId, r]));
  const records = new Map<string, AuditedGraphRecord>();

  for (const f of gf?.findings ?? []) {
    const ver = verById.get(f.systemId);
    const pmid = f.pubmedId != null ? String(f.pubmedId) : ver?.pubmedId != null ? String(ver.pubmedId) : "";
    const countriesIso3: string[] = [];
    const countryNames: Record<string, string> = {};
    for (const c of f.countries ?? []) {
      if (c.iso3 && !countriesIso3.includes(c.iso3)) countriesIso3.push(c.iso3);
      if (c.iso3 && c.matchedText) countryNames[c.iso3] = c.matchedText;
    }
    const status: VerificationStatus = ver?.status ?? (f.inVettedCsv ? "not_verifiable" : "unvetted_api");
    records.set(f.systemId, {
      systemId: f.systemId,
      studyId: f.studyId ?? null,
      pmid,
      year: typeof f.paper?.year === "number" ? f.paper.year : null,
      countriesIso3,
      countryNames,
      kind: f.kind,
      spLooksLikeUptake: Boolean(f.spLooksLikeUptake),
      studyType: f.studyId ? (studyTypes.get(f.studyId) ?? null) : null,
      variable1: f.variable1 ?? "",
      variable2: f.variable2 ?? "",
      statisticType: f.statisticType ?? null,
      statisticValue: typeof f.statisticValue === "number" ? f.statisticValue : null,
      ciLower: typeof f.ciLower === "number" ? f.ciLower : null,
      ciUpper: typeof f.ciUpper === "number" ? f.ciUpper : null,
      pValue: typeof f.pValue === "number" ? f.pValue : null,
      inVettedCsv: Boolean(f.inVettedCsv),
      verificationStatus: status,
      verificationNote: ver?.note ?? null,
      verificationQuote: ver?.quote ?? null,
    });
  }

  const pubYearByPmid = new Map<string, number>();
  for (const d of gs?.marker?.publication_dates ?? []) {
    const y = d.publication_date ? Number(d.publication_date.slice(0, 4)) : NaN;
    if (Number.isFinite(y)) pubYearByPmid.set(String(d.pubmed_id), y);
  }
  const gsStudyById = new Map((gs?.marker?.studies ?? []).map((s) => [s.study_id, s]));

  const rawAssocs = [...(gs?.marker?.associations ?? []), ...(gs?.rawAssociations ?? [])];
  for (const a of rawAssocs) {
    if (!a?.system_id) continue;
    const existing = records.get(a.system_id);
    if (existing) {
      if (!existing.verificationNote && a.vetting_note) existing.verificationNote = a.vetting_note;
      if (a.vetted === false && existing.verificationStatus === "unvetted_api") {
        existing.verificationStatus = "contradicted";
      }
      continue;
    }
    const ver = verById.get(a.system_id);
    const pmid = a.pubmed_id != null ? String(a.pubmed_id) : ver?.pubmedId != null ? String(ver.pubmedId) : "";
    const st = a.study_id ? gsStudyById.get(a.study_id) : undefined;
    records.set(a.system_id, {
      systemId: a.system_id,
      studyId: a.study_id ?? null,
      pmid,
      year: pubYearByPmid.get(pmid) ?? null,
      countriesIso3: [],
      kind: "codon540",
      studyType: st?.study_type ?? (a.study_id ? (studyTypes.get(a.study_id) ?? null) : null),
      variable1: a.variable_1_name ?? "",
      variable2: a.variable_2_name ?? "",
      statisticType: a.statistic_type ?? null,
      statisticValue: typeof a.statistic_value === "number" ? a.statistic_value : null,
      ciLower: typeof a.ci_lower === "number" ? a.ci_lower : null,
      ciUpper: typeof a.ci_upper === "number" ? a.ci_upper : null,
      pValue: typeof a.p_value === "number" ? a.p_value : null,
      inVettedCsv: Boolean(a.in_vetted_csv),
      verificationStatus: ver?.status ?? (a.vetted === false ? "contradicted" : a.in_vetted_csv ? "not_verifiable" : "unvetted_api"),
      verificationNote: ver?.note ?? a.vetting_note ?? null,
      verificationQuote: ver?.quote ?? null,
    });
  }

  return [...records.values()];
}

let cached: Promise<Pack | null> | null = null;

export function loadPack(): Promise<Pack | null> {
  cached ??= (async () => {
    try {
      const [genomes, literature, graph, thresholds, studyContext, auditedGraph] = await Promise.all([
        json<GenomesFile>("k540e-genomes.json"),
        json<LiteratureFile>("k540e-literature.json"),
        json<GraphFile>("k540e-graph.json"),
        json<ThresholdsFile>("k540e-thresholds.json"),
        // optional: the tab works without it and says the context is not recorded
        json<StudyContextFile>("k540e-study-context.json").catch(() => null),
        loadAuditedGraph().catch(() => []),
      ]);
      return { genomes, literature, graph, thresholds, studyContext, auditedGraph };
    } catch {
      return null;
    }
  })();
  return cached;
}

export function toClientPack(pack: Pack): ClientPack {
  const { vetted_association_ids, ...graph } = pack.graph;
  return {
    ...pack,
    auditedGraph: pack.auditedGraph ?? [],
    graph: { ...graph, vetted_count: vetted_association_ids?.length ?? 0 },
  };
}

export async function vettedIds(): Promise<Set<string> | null> {
  const pack = await loadPack();
  const ids = pack?.graph.vetted_association_ids;
  return Array.isArray(ids) ? new Set(ids.map(String)) : null;
}
