/**
 * Marker content for the Learn tab. Swapping the demo marker is ONE edit:
 * change DEMO_MARKER_ID below.
 *
 * Source of every field: docs/SCIENCE.md "Candidate markers" table and the
 * antifolate accumulation paragraph. Nothing here goes beyond that file.
 * Everything is `reviewed: false` until the science lead signs it off — see
 * content/review.ts for what that does on screen.
 *
 * Fields the science lead must write (one-sentence answer for markers where the
 * LEARN.md template does not fit, the three mechanism paragraphs, the ladder
 * rung effect labels) are `null` here on purpose. Do not fill them from memory.
 */
import type { Reviewable } from "./review";

/* ------------------------------------------------------------ diagrams --- */

export type LadderRung = {
  /** Named combination, as the literature uses it (docs/SCIENCE.md). */
  name: string;
  /** Alterations present at this rung, each with its gene. */
  alterations: { gene: string; codon: string; isNew: boolean }[];
  /** Effect on the drug. Science lead writes this. null = pending. */
  effect: string | null;
};

export type LadderDiagram = {
  kind: "ladder";
  title: string;
  /** Lowest rung first (earlier rungs sit lower). */
  rungs: LadderRung[];
  caption: string;
};

export type BeforeAfterDiagram = {
  kind: "before-after";
  title: string;
  /** Label for the protein element highlighted in both panels. */
  element: string;
  before: { heading: string; note: string };
  after: { heading: string; note: string };
  caption: string;
};

export type Diagram = LadderDiagram | BeforeAfterDiagram;

/* -------------------------------------------------------------- marker --- */

export type Marker = {
  id: string;
  organism: "Plasmodium falciparum";
  gene: string;
  alteration: string;
  /** The drug, named every time the marker is named. */
  drug: string;
  /** Sourced classification chip. null = omit the chip entirely (LEARN.md). */
  classification: { label: string; source: string } | null;
  identity: Reviewable<true>;
  /** The one bolded sentence. null = science lead has not written it. */
  oneSentence: Reviewable<string> | null;
  /** Three paragraphs: normal function, what changes, why the drug is blunted. */
  mechanism: Reviewable<[string, string, string]> | null;
  diagram: Reviewable<Diagram> | null;
};

/** The marker Learn shows when the URL carries none. ONE EDIT to swap.
 *  Provisional: docs/SCIENCE.md says freeze at kickoff from the coverage check.
 *  Chosen for now only because the dhfr/dhps ladder is fully specified by
 *  docs/SCIENCE.md. Replace with the frozen marker. */
export const DEMO_MARKER_ID = "pfdhps-K540E";

/** LEARN.md template. Science lead reviews the result before it ships. */
function templateSentence(gene: string, alteration: string, drug: string): string {
  return `Parasites carrying ${alteration} in ${gene} are associated with reduced efficacy of ${drug}.`;
}

/* The accumulation ladder, from docs/SCIENCE.md: triple (dhfr N51I + C59R +
 * S108N), quintuple (+ dhps A437G + K540E), sextuple (+ dhps A581G). */
const ANTIFOLATE_LADDER: LadderDiagram = {
  kind: "ladder",
  title: "Antifolate alterations accumulate, one parasite at a time",
  rungs: [
    {
      name: "Triple mutant",
      alterations: [
        { gene: "dhfr", codon: "N51I", isNew: true },
        { gene: "dhfr", codon: "C59R", isNew: true },
        { gene: "dhfr", codon: "S108N", isNew: true },
      ],
      effect: null,
    },
    {
      name: "Quintuple mutant",
      alterations: [
        { gene: "dhfr", codon: "triple", isNew: false },
        { gene: "dhps", codon: "A437G", isNew: true },
        { gene: "dhps", codon: "K540E", isNew: true },
      ],
      effect: null,
    },
    {
      name: "Sextuple mutant",
      alterations: [
        { gene: "dhfr + dhps", codon: "quintuple", isNew: false },
        { gene: "dhps", codon: "A581G", isNew: true },
      ],
      effect: null,
    },
  ],
  caption:
    "A teaching visual. Each combination is a property of an individual parasite, not of a region — it is never inferred from separate single-mutation findings in different papers.",
};

function beforeAfter(gene: string, alteration: string, drug: string): BeforeAfterDiagram {
  return {
    kind: "before-after",
    title: `${drug}: without and with ${alteration}`,
    element: `${gene} protein`,
    before: { heading: "Drug acting normally", note: `${gene} without ${alteration}` },
    after: { heading: `Drug blunted`, note: `${gene} carrying ${alteration}` },
    caption: "A teaching visual, not a structural model. Mechanism text pending science-lead review.",
  };
}

const p = <T,>(value: T): Reviewable<T> => ({ value, reviewed: false });

export const MARKERS: Record<string, Marker> = {
  "pfdhps-K540E": {
    id: "pfdhps-K540E",
    organism: "Plasmodium falciparum",
    gene: "pfdhps",
    alteration: "K540E",
    drug: "sulfadoxine (with pyrimethamine, as SP)",
    classification: null,
    identity: p(true),
    oneSentence: p(templateSentence("pfdhps", "K540E", "sulfadoxine-pyrimethamine (SP)")),
    mechanism: null,
    diagram: p(ANTIFOLATE_LADDER),
  },
  "pfdhfr-S108N": {
    id: "pfdhfr-S108N",
    organism: "Plasmodium falciparum",
    gene: "pfdhfr",
    alteration: "S108N",
    drug: "pyrimethamine (as SP)",
    classification: null,
    identity: p(true),
    oneSentence: p(templateSentence("pfdhfr", "S108N", "pyrimethamine (as SP)")),
    mechanism: null,
    diagram: p(ANTIFOLATE_LADDER),
  },
  "pfcrt-K76T": {
    id: "pfcrt-K76T",
    organism: "Plasmodium falciparum",
    gene: "pfcrt",
    alteration: "K76T",
    drug: "chloroquine",
    classification: null,
    identity: p(true),
    oneSentence: p(templateSentence("pfcrt", "K76T", "chloroquine")),
    mechanism: null,
    diagram: p(beforeAfter("pfcrt", "K76T", "chloroquine")),
  },
  "kelch13-C580Y": {
    id: "kelch13-C580Y",
    organism: "Plasmodium falciparum",
    gene: "kelch13 (K13)",
    alteration: "C580Y",
    drug: "artemisinin (partial resistance)",
    classification: null,
    identity: p(true),
    // "Partial resistance" is the correct term for artemisinin (CLAUDE.md).
    oneSentence: p(
      "Parasites carrying C580Y in kelch13 (K13) are associated with artemisinin partial resistance.",
    ),
    mechanism: null,
    diagram: p(beforeAfter("kelch13", "C580Y", "artemisinin")),
  },
  "pfmdr1-N86Y": {
    id: "pfmdr1-N86Y",
    organism: "Plasmodium falciparum",
    gene: "pfmdr1",
    alteration: "N86Y",
    drug: "partner drugs (direction varies)",
    classification: null,
    identity: p(true),
    // Direction varies by partner drug (docs/SCIENCE.md), so the LEARN.md
    // template does not fit. Science lead must write this one.
    oneSentence: null,
    mechanism: null,
    diagram: null,
  },
};

export function getMarker(id: string | null | undefined): Marker {
  return (id && MARKERS[id]) || MARKERS[DEMO_MARKER_ID];
}
