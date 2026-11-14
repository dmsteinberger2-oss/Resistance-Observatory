/**
 * EVERY user-facing number in the app lives here. Nowhere else.
 *
 * Every figure is read from data/graph-stats.json, the pinned output of
 * scripts/graph-stats.ts, which queries the System Public Graph API
 * (https://public-api.system.com/v1, header x-api-key). Nothing is typed in by
 * hand and nothing comes from any other source. Each constant carries the
 * exact API query it derives from. To refresh: re-run the script, commit the
 * JSON.
 *
 * "Finding" = one association in the graph (two variables linked by a
 * statistic). Per System's own documentation roughly 20% of API associations
 * are known-bad extractions; the findings counted here have not yet been
 * cross-verified against the Dataverse CSV or the source papers.
 */
import graph from "@/data/graph-stats.json";

export type Stat = {
  value: number | string;
  /** What the figure is, in plain words. Used as its label. */
  label: string;
  /** Rendered after the value, e.g. "%". */
  unit?: string;
  /** Shown on screen under the figure. */
  source: string;
  /** The exact API query (or queries) the value derives from. */
  query: string;
};

const SOURCE = `System Public Graph v${graph.source.version}`;
const SEARCHES = graph.searches.map((s) => s.term).join(", ");

type DatedAssociation = {
  relationship: { num_findings: number; last_published_date: string } | null;
};

/** A finding is dated only when its relationship holds exactly one finding, so
 *  the relationship's last_published_date is unambiguously that finding's. */
export function graphPublishedDate(a: DatedAssociation): string | null {
  const r = a.relationship;
  return r && r.num_findings === 1 && r.last_published_date ? r.last_published_date.slice(0, 10) : null;
}

/** "2015-06-15" -> "June 15, 2015", without timezone drift. */
export function formatGraphDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1];
  return `${month} ${d}, ${y}`;
}

const markerDates = (graph.marker.associations as DatedAssociation[])
  .map(graphPublishedDate)
  .filter((d): d is string => d !== null)
  .sort();

/* --------------------------------------- The marker: codon 540 of pfdhps --- */
/* The graph has no variable for K540E on its own. The marker's evidence is
 * every variable whose NAME mentions codon 540 (graph.marker.name_pattern),
 * alone or inside a named combination. */

// GET /variables?search=name:<term>&limit=50&offset=<n>&include_total=true
//   for <term> in dhps, pfdhps, dihydropteroate, K540E, 540E, sulfadoxine,
//   sulfadoxine-pyrimethamine; keep hits whose name matches /540\s*E|540\s*K\/E|Glu-540/i
export const GRAPH_MARKER_VARIABLES = {
  value: graph.marker.variables.length,
  label: "Graph variables whose name mentions codon 540 of pfdhps",
  source: SOURCE,
  query: `GET /variables?search=name:<term>&limit=50&offset=<n>&include_total=true (terms: ${SEARCHES}), name-filtered`,
} satisfies Stat;

// For each marker variable:
// GET /variables/{id}/associations?limit=50&offset=<n>&include_total=true
//   de-duplicated by association system_id
export const GRAPH_MARKER_FINDINGS = {
  value: graph.marker.associations.length,
  label: "Findings in the graph for codon 540 of pfdhps (sulfadoxine)",
  source: SOURCE,
  query: "GET /variables/{id}/associations?limit=50&offset=<n>&include_total=true, per marker variable",
} satisfies Stat;

// Distinct study_id over those associations; each resolved with
// GET /studies/{study_id}
export const GRAPH_MARKER_STUDIES = {
  value: graph.marker.studies.length,
  label: "Studies those findings come from",
  source: SOURCE,
  query: "distinct study_id over the marker associations; GET /studies/{study_id}",
} satisfies Stat;

// For each marker association with both variables grounded to a concept:
// GET /relationships/{concept_1}%7C{concept_2}  -> num_findings, last_published_date
// A finding counts as dated only when that relationship has num_findings = 1.
export const GRAPH_MARKER_DATED_FINDINGS = {
  value: markerDates.length,
  label: "Of those findings, how many the graph gives a publication date for",
  source: SOURCE,
  query: "GET /relationships/{concept_1}%7C{concept_2} per marker association; num_findings = 1",
} satisfies Stat;

// Latest last_published_date over the same relationships
// (GET /relationships/{concept_1}%7C{concept_2}).
export const GRAPH_MARKER_LAST_PUBLISHED = {
  value: markerDates.length ? formatGraphDate(markerDates[markerDates.length - 1]) : "No date in the graph",
  label: "Most recent publication date the graph records for these findings",
  source: SOURCE,
  query: "max last_published_date over GET /relationships/{concept_1}%7C{concept_2} per marker association",
} satisfies Stat;

/* ------------------------------------------------- Context: pfdhps overall --- */
/* Variables whose name explicitly identifies the P. falciparum dhps gene
 * (graph.pfdhps_context.selection_rule). Includes the marker set. */

// Same searches as above, name-filtered to P. falciparum dhps; then
// GET /variables/{id}/associations?limit=50&offset=<n>&include_total=true
//   per variable, de-duplicated by association system_id
export const GRAPH_PFDHPS_FINDINGS = {
  value: graph.pfdhps_context.associations.length,
  label: "Findings in the graph for pfdhps overall, any alteration",
  source: SOURCE,
  query: "GET /variables/{id}/associations?limit=50&offset=<n>&include_total=true, per pfdhps variable",
} satisfies Stat;

// Distinct study_id over those associations.
export const GRAPH_PFDHPS_STUDIES = {
  value: graph.pfdhps_context.study_ids.length,
  label: "Studies behind the pfdhps findings",
  source: SOURCE,
  query: "distinct study_id over the pfdhps associations",
} satisfies Stat;

/* ------------------------------------------------------- The graph itself --- */
/* Release metadata recorded in graph-stats.json `source`. These describe the
 * dataset (DOI 10.7910/DVN/7V6JDO); the API does not return them. */

export const GRAPH_VERSION = {
  value: graph.source.version,
  label: "System Public Graph version",
  source: `System Public Graph, doi:${graph.source.doi}`,
  query: "release metadata (graph-stats.json source.version); not an API field",
} satisfies Stat;

export const GRAPH_SNAPSHOT_DATE = {
  value: formatGraphDate(graph.source.snapshot),
  label: "System Public Graph snapshot date",
  source: `System Public Graph, doi:${graph.source.doi}`,
  query: "release metadata (graph-stats.json source.snapshot); not an API field",
} satisfies Stat;

export const GRAPH_KNOWN_BAD_SHARE = {
  value: graph.source.documented_known_bad_extraction_share_percent,
  unit: "%",
  label: "Approximate share of API associations that are known-bad extractions",
  source: "System API documentation",
  query: "documented by System (graph-stats.json source.documented_known_bad_extraction_share_percent); not an API field",
} satisfies Stat;

export const GRAPH_LICENSE = graph.source.license;
export const GRAPH_DOI = graph.source.doi;

/** Full registry, for the Data tab and any audit view. */
export const ALL_STATS = {
  GRAPH_MARKER_VARIABLES,
  GRAPH_MARKER_FINDINGS,
  GRAPH_MARKER_STUDIES,
  GRAPH_MARKER_DATED_FINDINGS,
  GRAPH_MARKER_LAST_PUBLISHED,
  GRAPH_PFDHPS_FINDINGS,
  GRAPH_PFDHPS_STUDIES,
  GRAPH_VERSION,
  GRAPH_SNAPSHOT_DATE,
  GRAPH_KNOWN_BAD_SHARE,
} as const;
