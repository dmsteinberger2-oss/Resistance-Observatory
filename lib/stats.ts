/**
 * EVERY user-facing number in the app lives here. Nowhere else.
 *
 * CLAUDE.md hard rule: "Never fabricate figures. Every number in UI copy is a
 * named constant in lib/stats.ts prefixed PLACEHOLDER_ until a human sources
 * it." Each constant is also listed in the README TODO block.
 *
 * - `value: null` means "not yet sourced". The UI renders a visible
 *   placeholder token instead of a number. Do not replace null with a guess.
 * - A non-null value with `source` set but `checkedBy: null` came from project
 *   docs (CLAUDE.md / System's own documentation) and still needs a human
 *   check against the original.
 * - When a human sources a figure: fill `value`, `source`, `checkedBy`, update
 *   the README table, and (optionally) drop the PLACEHOLDER_ prefix.
 */

export type Stat = {
  /** The figure itself. null = unsourced; the UI shows a placeholder token. */
  value: number | string | null;
  /** What the figure is, in plain words. Used as its label. */
  label: string;
  /** Rendered after the value, e.g. "%" or " per year". */
  unit?: string;
  /** Where the figure comes from. Required before the PLACEHOLDER_ prefix goes. */
  source: string | null;
  /** Who checked it against the source. */
  checkedBy: string | null;
  /** Suggested source to look in, for whoever fills this. Not a citation. */
  lookIn?: string;
};

const unsourced = (label: string, opts: Partial<Stat> = {}): Stat => ({
  value: null,
  label,
  source: null,
  checkedBy: null,
  ...opts,
});

/* ---------------------------------------------------------------- Scale --- */
/* Listed in docs/SCIENCE.md "Front-page and Data-tab figures". */

export const PLACEHOLDER_ANNUAL_DEATHS = unsourced("Malaria deaths per year", {
  lookIn: "WHO World Malaria Report (latest edition)",
});

export const PLACEHOLDER_ANNUAL_CASES = unsourced("Malaria cases per year", {
  lookIn: "WHO World Malaria Report (latest edition)",
});

export const PLACEHOLDER_SHARE_UNDER_5 = unsourced(
  "Share of malaria deaths that are children under five",
  { unit: "%", lookIn: "WHO World Malaria Report (latest edition)" },
);

export const PLACEHOLDER_SHARE_AFRICA = unsourced(
  "Share of malaria deaths in the WHO African Region",
  { unit: "%", lookIn: "WHO World Malaria Report (latest edition)" },
);

/* Demo marker's drug — fill once the demo marker is frozen (docs/SCIENCE.md). */

export const PLACEHOLDER_DRUG_INTRODUCED_YEAR = unsourced(
  "Year the demo marker's drug came into wide use",
  { lookIn: "Original papers / WHO compendium of molecular markers" },
);

export const PLACEHOLDER_RESISTANCE_FIRST_REPORTED = unsourced(
  "Year reduced efficacy was first reported for the demo marker's drug",
  { lookIn: "Original papers / WHO compendium of molecular markers" },
);

/* ------------------------------------------------------------- The gap --- */

export const PLACEHOLDER_EVIDENCE_LAG_MONTHS = unsourced(
  "Typical time from publication to reaching the people choosing drugs",
  { unit: " months", lookIn: "Needs a published estimate — or cut this figure" },
);

export const PLACEHOLDER_PAPERS_PER_YEAR = unsourced(
  "Papers on antimalarial resistance markers published per year",
  { lookIn: "OpenAlex / PubMed count with a stated query" },
);

/* ------------------------------------------------- Data tab — timeline --- */
/* One pair per drug. Ordering on the timeline follows these values once they
 * exist; until then the timeline says so and does not imply chronology. */

export const PLACEHOLDER_CHLOROQUINE_INTRODUCED_YEAR = unsourced(
  "Chloroquine: year introduced into wide use",
);
export const PLACEHOLDER_CHLOROQUINE_RESISTANCE_YEAR = unsourced(
  "Chloroquine: year reduced efficacy first reported",
);
export const PLACEHOLDER_SP_INTRODUCED_YEAR = unsourced(
  "Sulfadoxine-pyrimethamine (SP): year introduced into wide use",
);
export const PLACEHOLDER_SP_RESISTANCE_YEAR = unsourced(
  "Sulfadoxine-pyrimethamine (SP): year reduced efficacy first reported",
);
export const PLACEHOLDER_ARTEMISININ_INTRODUCED_YEAR = unsourced(
  "Artemisinin: year introduced into wide use",
);
export const PLACEHOLDER_ARTEMISININ_PARTIAL_RESISTANCE_YEAR = unsourced(
  "Artemisinin: year partial resistance first reported",
);

/* ------------------------------------------- Data source (System graph) --- */
/* Values copied from CLAUDE.md, which quotes System's own documentation.
 * Sourced to project docs, not yet checked by a human against System's docs. */

export const PLACEHOLDER_GRAPH_VERSION = {
  value: "2.1",
  label: "System Public Graph version",
  source: "CLAUDE.md, quoting System documentation",
  checkedBy: null,
} satisfies Stat;

export const PLACEHOLDER_GRAPH_SNAPSHOT_DATE = {
  value: "July 1, 2026",
  label: "System Public Graph snapshot date",
  source: "CLAUDE.md, quoting System documentation",
  checkedBy: null,
} satisfies Stat;

export const PLACEHOLDER_GRAPH_KNOWN_BAD_SHARE = {
  value: 20,
  unit: "%",
  label: "Approximate share of API associations that are known-bad extractions",
  source: "CLAUDE.md, quoting System documentation",
  checkedBy: null,
} satisfies Stat;

export const PLACEHOLDER_GRAPH_UNGROUNDED_REMOVED = {
  value: "2.48 million",
  label: "Variables removed from the public release for failing to ground to Wikidata",
  source: "docs/SCIENCE.md, quoting System documentation",
  checkedBy: null,
} satisfies Stat;

/* --------------------------------------------------------------- helpers --- */

export function isSourced(s: Stat): boolean {
  return s.value !== null;
}

/** Full registry, for the README TODO block and any audit view. */
export const ALL_STATS = {
  PLACEHOLDER_ANNUAL_DEATHS,
  PLACEHOLDER_ANNUAL_CASES,
  PLACEHOLDER_SHARE_UNDER_5,
  PLACEHOLDER_SHARE_AFRICA,
  PLACEHOLDER_DRUG_INTRODUCED_YEAR,
  PLACEHOLDER_RESISTANCE_FIRST_REPORTED,
  PLACEHOLDER_EVIDENCE_LAG_MONTHS,
  PLACEHOLDER_PAPERS_PER_YEAR,
  PLACEHOLDER_CHLOROQUINE_INTRODUCED_YEAR,
  PLACEHOLDER_CHLOROQUINE_RESISTANCE_YEAR,
  PLACEHOLDER_SP_INTRODUCED_YEAR,
  PLACEHOLDER_SP_RESISTANCE_YEAR,
  PLACEHOLDER_ARTEMISININ_INTRODUCED_YEAR,
  PLACEHOLDER_ARTEMISININ_PARTIAL_RESISTANCE_YEAR,
  PLACEHOLDER_GRAPH_VERSION,
  PLACEHOLDER_GRAPH_SNAPSHOT_DATE,
  PLACEHOLDER_GRAPH_KNOWN_BAD_SHARE,
  PLACEHOLDER_GRAPH_UNGROUNDED_REMOVED,
} as const;
