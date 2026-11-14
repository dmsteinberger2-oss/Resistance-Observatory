/**
 * The demo marker's findings, straight from data/graph-stats.json (pinned
 * output of scripts/graph-stats.ts). Every finding keeps its system_id,
 * pubmed_id and doi so a reader can always click through to the paper.
 */
import graph from "@/data/graph-stats.json";
import { publishedDate } from "@/lib/stats";

export type MarkerFinding = {
  systemId: string;
  studyId: string;
  pubmedId: string | null;
  doi: string | null;
  variable1: string;
  variable2: string;
  statisticType: string;
  population: string | null;
  /** study_type exactly as the graph's Studies table records it; null = not recorded. */
  studyType: string | null;
  /** ISO publication date (YYYY-MM-DD) of the paper, from OpenAlex; null = unknown. */
  published: string | null;
};

type RawAssociation = {
  system_id: string;
  study_id: string;
  pubmed_id?: number | null;
  variable_1_name: string;
  variable_2_name: string;
  statistic_type: string;
  vetted?: boolean;
  vetting_note?: string;
};

const studies = new Map(graph.marker.studies.map((s) => [s.study_id, s]));

const toFinding = (a: RawAssociation): MarkerFinding => {
    const study = studies.get(a.study_id);
    const pmid = a.pubmed_id ?? study?.pubmed_id ?? null;
    return {
      systemId: a.system_id,
      studyId: a.study_id,
      pubmedId: pmid === null ? null : String(pmid),
      doi: study?.doi ?? null,
      variable1: a.variable_1_name,
      variable2: a.variable_2_name,
      statisticType: a.statistic_type.replaceAll("_", " "),
      population: study?.population ?? null,
      studyType: (study?.study_type as string | null | undefined)?.trim() || null,
      published: publishedDate(pmid),
    };
};

const RAW = graph.marker.associations as RawAssociation[];

/** Findings flagged `vetted: false`: checked against the paper and found
 *  mis-extracted. Kept in the pinned file, never shown as evidence. */
export const EXCLUDED_FINDINGS: MarkerFinding[] = RAW.filter((a) => a.vetted === false).map(toFinding);

/** The marker's evidence. Dated findings first, oldest to newest; then any
 *  with no resolved date. Excludes anything flagged `vetted: false`. */
export const MARKER_FINDINGS: MarkerFinding[] = RAW.filter((a) => a.vetted !== false)
  .map(toFinding)
  .sort((a, b) => {
    if (a.published && b.published) return a.published.localeCompare(b.published);
    if (a.published) return -1;
    if (b.published) return 1;
    return Number(a.pubmedId ?? 0) - Number(b.pubmedId ?? 0) || a.systemId.localeCompare(b.systemId);
  });
