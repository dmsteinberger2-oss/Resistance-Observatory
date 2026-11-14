# Resistance Observatory

When does new evidence change the picture for a malaria drug-resistance marker?

A hackathon prototype (System Public Challenge, Build Challenge 3). Next.js App
Router + Tailwind, deployed on Vercel (import this repo at vercel.com/new —
framework auto-detects as Next.js, no env vars needed).

**Honesty note.** The evidence graph is a frozen snapshot. The alert demo
replays real publication history: findings are played forward in the order
they were actually published, and the matcher reacts as if they were new. The
logic is tested on real history; the feed is a snapshot. This is not live
surveillance, not clinical guidance, and not affiliated with or endorsed by WHO.

## Tabs and owners

| Route       | What                                               | Owner    |
| ----------- | -------------------------------------------------- | -------- |
| `/`         | Scroll-driven explainer: problem, scale, gap       | Solayman |
| `/learn`    | Marker, drug, why it matters, one diagram          | Solayman |
| `/forecast` | Map of where the marker has been observed          | Benjamin |
| `/alert`    | Save a watch; replayed evidence fires alerts       | David    |
| `/data`     | Long-form history, timeline, glossary              | Solayman |

`app/forecast/page.tsx` and `app/alert/page.tsx` are placeholders — replace
them wholesale.

## Shared selection state

```ts
import { useSelection } from "@/lib/selection";

const {
  markerId, timeRange, selectedFindingId,       // read
  setMarkerId, setTimeRange, setSelectedFindingId, setSelection, // write
  hrefWithSelection,                            // build a link that carries state
} = useSelection();
```

The URL is the source of truth: `?marker=<id>&range=<from>-<to>&finding=<id>`.
A copied link restores the selection; the top nav carries it across tabs. No
localStorage.

## Shared components

`components/`: `Card`, `Chip`, `SectionHeading`, `EvidenceLink`, `Callout`.
Design tokens (light + dark) are CSS variables on `:root` in
`app/globals.css`, exposed to Tailwind as `bg-surface`, `text-muted`,
`text-drug`, `text-signal`, `text-gap`, etc.

`EvidenceLink` takes `systemId`, `pubmedId`, `doi` and always shows all three;
it links to doi.org first, PubMed second.

## Content and the science-review gate

- `content/markers.ts` — typed marker content for Learn. **Swap the demo
  marker by editing `DEMO_MARKER_ID`.** It is provisionally `pfdhps-K540E`
  (chosen only because the dhfr/dhps ladder is fully specified in
  `docs/SCIENCE.md`); freeze it from the coverage check. Learn diagrams are
  built from the `diagram` config (ladder or before/after), labels are real
  `<text>`.
- `content/data.ts` — Data tab content.
- `content/review.ts` — every science field carries `reviewed: boolean`.
  Unreviewed content is **held** in production (a visible "awaiting
  science-lead review" panel renders in its place), per `docs/LEARN.md`.
  To review it in context, run with `NEXT_PUBLIC_SHOW_UNREVIEWED=1` (locally or
  on a Vercel *preview* env only); it then renders with a DRAFT tag. Flip
  `reviewed: true` once the science lead signs off.

Still to be written by the science lead (left `null`, not generated): the
three mechanism paragraphs per marker, the ladder rung "effect on drug"
labels, the pfmdr1 one-sentence answer, the Data-tab history chapters.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## TODO — unsourced figures

Every number in UI copy is a named constant in `lib/stats.ts`. Until a human
sources it, its value is `null` and the UI renders a dashed placeholder token,
not a number. Fill `value`, `source` and `checkedBy` in `lib/stats.ts` and
update this table.

| Constant | Value | Source | Checked by |
| --- | --- | --- | --- |
| `PLACEHOLDER_ANNUAL_DEATHS` | — | — | — |
| `PLACEHOLDER_ANNUAL_CASES` | — | — | — |
| `PLACEHOLDER_SHARE_UNDER_5` | — | — | — |
| `PLACEHOLDER_SHARE_AFRICA` | — | — | — |
| `PLACEHOLDER_DRUG_INTRODUCED_YEAR` | — | — | — |
| `PLACEHOLDER_RESISTANCE_FIRST_REPORTED` | — | — | — |
| `PLACEHOLDER_EVIDENCE_LAG_MONTHS` | — | — | — |
| `PLACEHOLDER_PAPERS_PER_YEAR` | — | — | — |
| `PLACEHOLDER_CHLOROQUINE_INTRODUCED_YEAR` | — | — | — |
| `PLACEHOLDER_CHLOROQUINE_RESISTANCE_YEAR` | — | — | — |
| `PLACEHOLDER_SP_INTRODUCED_YEAR` | — | — | — |
| `PLACEHOLDER_SP_RESISTANCE_YEAR` | — | — | — |
| `PLACEHOLDER_ARTEMISININ_INTRODUCED_YEAR` | — | — | — |
| `PLACEHOLDER_ARTEMISININ_PARTIAL_RESISTANCE_YEAR` | — | — | — |
| `PLACEHOLDER_GRAPH_VERSION` | 2.1 | CLAUDE.md (quotes System docs) | — |
| `PLACEHOLDER_GRAPH_SNAPSHOT_DATE` | July 1, 2026 | CLAUDE.md (quotes System docs) | — |
| `PLACEHOLDER_GRAPH_KNOWN_BAD_SHARE` | ~20% | CLAUDE.md (quotes System docs) | — |
| `PLACEHOLDER_GRAPH_UNGROUNDED_REMOVED` | 2.48 million | docs/SCIENCE.md (quotes System docs) | — |

## Data sources

- **System Public Graph** v2.1, July 1 2026 snapshot, CC BY-NC 4.0 —
  `https://public-api.system.com/v1/`. Work deriving from the graph inherits
  CC BY-NC.
- **OpenAlex** — resolves pubmed_id / doi to publication dates.
- **Forecast map data** — Benjamin's separate source (to be named here). Any
  location on the map is attributed to that source, never to the System graph.

Verification of demo findings against the Dataverse CSV / source papers: _to
be recorded here._

## AI coding tool disclosure

This repository was built with the help of Claude Code (Anthropic), an AI
coding assistant, under the direction of the team. All science content is
gated on human review (see `docs/SCIENCE.md`, `docs/LEARN.md`).

## Alert tab — sources, method and disclosure

The Alert tab (`/alert`) goes deep on one marker, **PfDHPS K540E**, and the
drug it bears on, sulfadoxine-pyrimethamine (SP). A researcher writes a watch
as a sentence; the tab replays every moment the evidence moved, with the
counts, the threshold and its basis, what the System graph holds, and the
email a subscriber would receive. It replays the historical record. It is not
live surveillance and not clinical guidance.

**URL convention for the other tabs:** `?marker=pfdhps-K540E&area=<ISO3>`
(the shell's existing `marker` id plus an ISO3 country). The current watch
adds `trig`, `level`, `pts`, `n`; the open alert uses the shell's `finding`
parameter. Saved, named watches live in `localStorage` in the user's browser
only; the link always holds the current watch.

### Data sources (all in `k540e-data-pack/`)

| Evidence | Source | Licence / notes |
| --- | --- | --- |
| Genome counts by country and collection year (K540E, A581G, A437G, quintuple haplotype) | MalariaGEN Pf8, <https://zenodo.org/records/18681980> (DOI 10.5281/zenodo.18681980) | CC BY 4.0. Convenience samples, dated by collection year. Wilson 95% intervals are computed in the app. |
| 372 papers mentioning K540E, with abstract figures, association sentences and first-report claims | PubMed (NCBI E-utilities), searched 14 November 2026 | Abstract items were read by a language model; a program kept only quotes that appear word for word in the abstract. Not checked by hand, so every one is shown as a quote with its PubMed link. |
| Graph findings, concept ids, vetted association ids; live queries | System Public Graph, <https://doi.org/10.7910/DVN/7V6JDO>; API <https://public-api.system.com> | Non-commercial. Work deriving from the graph is CC BY-NC. |
| Marker status, SP-resistance categories, history | WHO guidelines for malaria, 13 August 2025, <https://iris.who.int/server/api/core/bitstreams/26a6af2d-060c-4449-8207-1f25e63c6cc3/content> (categories: PDF page 105; continuing IPTp-SP: PDF pages 104 and 107–108); WHO Compendium of molecular markers for antimalarial drug resistance, <https://www.who.int/publications/m/item/compendium-of-molecular-markers-for-antimalarial-drug-resistance>; other WHO documents linked inside `k540e-thresholds.json` | Quoted verbatim with page references. Presets outside East and Southern Africa are this project's, and are labelled as presets. |

Citation: System, Inc. (2026). *System Public Graph* (Version 2.1) [Data set].
DOI: <https://doi.org/10.7910/DVN/7V6JDO>

### How the graph is used, and what was verified

- The graph has read 10 of the 372 K540E papers, and no graph finding names
  K540E on its own. The tab shows that gap, what the graph did extract from
  those 10 papers, and the unread papers for the selected country as a
  ready-to-ingest PubMed id queue.
- About a fifth of associations returned by the API are known-bad
  extractions. `/api/alert/system` returns only associations whose id is in
  the vetted list (4,912 ids, from the Dataverse CSV snapshot of 8 July 2026)
  and counts the rest as quarantined; they are never displayed.
- Seven graph findings were compared against their paper
  (`source_checked: true` in the pack) and are labelled "Source-checked
  against paper". Every other graph finding is labelled "Reported by System
  Graph, unverified".
- Alert sentences are templates filled from the data. No language model runs
  in the app.

### Running and testing

```bash
node --test lib/alert/*.test.mts   # derivation + the data pack's check figures (Node 24, no test library)
npx tsc --noEmit
npx next build
```

Optional server-side environment variables: a System API key
(`SYSTEM_API_KEY`) for live graph calls, and `RESEND_API_KEY` (plus optional
`ALERT_FROM_EMAIL`) to send alert emails. Without them the tab shows the
snapshot and the email control reads "Preview only".

### AI-assistance disclosure (Alert tab)

The Alert tab's code was written with AI assistance (Claude Code, Anthropic)
under the direction of the team. The data pack was also prepared with AI
assistance from the public sources above, including the machine-read,
quote-verified abstract items, which no human has checked.

### Forecast map contract

`data/alerts.json` lists the Alert tab's default alerts for every country
(each region's default rule on the genome counts; cells of at least 20
samples, except first detections, which are badged weak when thin). Each item
is `{ id, marker_id, country_iso3, year, rule, headline }`.
`getDefaultMapAlerts()` in `lib/alert/mapAlerts.ts` returns the same list.
Regenerate with `node lib/alert/generate-map-alerts.mts` (a test fails if the
file drifts from the pack). Link an alert to its inspector with
`/alert?alert=<id>`; the Alert tab links back with
`/forecast?country=<ISO3>&marker=pfdhps-K540E`.
