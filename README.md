# Resistance Observatory

When does new evidence change the picture for a malaria drug-resistance marker?

A hackathon prototype (System Public Challenge, Build Challenge 3). Next.js App
Router + Tailwind, deployed on Vercel (import this repo at vercel.com/new —
framework auto-detects as Next.js; the site needs no env vars at build or run
time for Overview, Learn and Data, because their figures are pinned in
`data/graph-stats.json`).

**Honesty note.** The evidence graph is a frozen snapshot. The alert demo
replays real publication history: findings are played forward in the order
they were actually published, and the matcher reacts as if they were new. The
logic is tested on real history; the feed is a snapshot. This is not live
surveillance, not clinical guidance, and not affiliated with or endorsed by WHO.

## Tabs and owners

| Route       | What                                               | Owner    |
| ----------- | -------------------------------------------------- | -------- |
| `/`         | Redirects to `/story.html`, the animated intro     | Solayman |
| `/overview` | Scroll-driven explainer: problem, evidence, gap    | Solayman |
| `/learn`    | Marker, drug, why it matters, one diagram          | Solayman |
| `/forecast` | Map of where the marker has been observed          | Benjamin |
| `/alert`    | Save a watch; replayed evidence fires alerts       | David    |
| `/data`     | Long-form guide, findings timeline, glossary       | Solayman |

`public/story.html` is a self-contained scrollytelling intro (canvas
animation, no external assets, its own nav and styles), served outside the app
shell. Its graphics are artistic illustration, not real Public Graph records;
the page says so. Its links lead into `/learn`, `/forecast` and `/alert`.

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
`hrefWithSelection` also passes through `&area=<ISO3>` (for example
`area=MWI`) when the current URL has one, so links to Forecast and Alert carry
both marker and area. Set or drop it with a third argument:
`hrefWithSelection("/forecast", {}, { area: "MWI" })`. The current value is
exposed as `area` from `useSelection()`.
A copied link restores the selection; the top nav carries it across tabs. No
localStorage.

## Shared components

`components/`: `Card`, `Chip`, `SectionHeading`, `EvidenceLink`, `Callout`.
Design tokens (light + dark) are CSS variables on `:root` in
`app/globals.css`, exposed to Tailwind as `bg-surface`, `text-muted`,
`text-drug`, `text-signal`, `text-gap`, etc.

`EvidenceLink` takes `systemId`, `pubmedId`, `doi` and always shows all three;
it links to doi.org first, PubMed second.

## Content

- `content/markers.ts` — typed marker content for Learn. The demo marker is
  `pfdhps-K540E` (drug: sulfadoxine, used with pyrimethamine as SP), and it is
  the only marker with written content. It is transcribed from
  `docs/MARKER-CONTENT.md`. Learn diagrams are built from the `diagram` config;
  labels are real `<text>`.
- `content/data.ts` — Data tab content, taken from `docs/SCIENCE.md`.
- Science content carries a `reviewed` flag (`content/review.ts`). Everything
  shipped is flagged `true`, and nothing is held on screen. Both source docs
  still say their claims were written from general knowledge and should be
  checked against the literature; that check has not been recorded here.
- K540E is usually reported with A437G as the double mutant. Learn says so in
  the mechanism section and on the ladder diagram, which is why other tabs can
  speak of haplotypes containing K540E and mean the same marker.

## Development

Requires Node 22.18 or newer.

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint    # tsc --noEmit
npm run build
```

Overview, Learn and Data run without any key: every figure they show is read from
the pinned file `data/graph-stats.json`.

To refresh that file, put your System key in `.env.local` (gitignored — never
commit it):

```bash
echo 'SYSTEM_API_KEY=<your key>' > .env.local
echo 'OPENALEX_MAILTO=<your email>' >> .env.local   # optional: OpenAlex polite pool
node --env-file=.env.local scripts/graph-stats.ts
```

The script is server-side only. It makes about 300 requests to the System API
(the limit is 10,000 per day per key), one to OpenAlex, and streams the
~440 MB vetted associations CSV from Dataverse without saving it. To re-run
only that verification step on the pinned file, with no API key:
`VERIFY_ONLY=1 node scripts/graph-stats.ts`. It never logs or
writes the key, and the email is sent to OpenAlex only. Commit the regenerated
JSON.

## Figures

Every number in UI copy is a named constant in `lib/stats.ts`, read from
`data/graph-stats.json`, with the exact query in a comment beside it. Counts
are `GRAPH_*` (System Public Graph); publication dates are `OPENALEX_*`.
Nothing is typed in by hand, and there are no placeholder figures left.

**Each count answers one question, and is labelled with it on screen.** Other
tabs ask the graph different questions about the same marker and show
different counts. That is expected.

| Constant | Value | How it is derived |
| --- | --- | --- |
| `GRAPH_MARKER_VARIABLES` | 7 | variables that **name codon 540 directly**: hits of `GET /variables?search=name:<term>` whose name mentions codon 540 of pfdhps |
| `GRAPH_MARKER_FINDINGS` | 6 | findings that **name codon 540 directly**: associations of those variables, `GET /variables/{id}/associations`, de-duplicated |
| `GRAPH_MARKER_K540E_ALONE_FINDINGS` | 0 | of those, findings whose variable names K540E on its own, with no other codon or combination |
| `GRAPH_MARKER_STUDIES` | 4 | studies that **name codon 540 directly**: distinct `study_id` over those associations |
| `GRAPH_MARKER_EXCLUDED_FINDINGS` | 2 | codon-540 findings the live API returned that were checked against their paper, found mis-extracted, and excluded from every other count |
| `GRAPH_PFDHPS_FINDINGS` | 30 | findings that **cover pfdhps overall**: associations of every variable whose name identifies P. falciparum dhps (includes the 6 above) |
| `GRAPH_PFDHPS_STUDIES` | 23 | studies that **cover pfdhps overall**: distinct `study_id` over those associations |
| `OPENALEX_MARKER_DATED_FINDINGS` | 6 | codon-540 findings whose paper's publication date resolved in OpenAlex, matched on `pubmed_id` |
| `OPENALEX_MARKER_LAST_PUBLISHED` | January 21, 2023 | latest of those publication dates |
| `GRAPH_VERSION`, `GRAPH_SNAPSHOT_DATE` | 2.1, July 1, 2026 | release metadata, not an API field |
| `GRAPH_KNOWN_BAD_SHARE` | ~20% | System's API documentation, not an API field |

Coverage limitations, stated on screen as well:

- **The graph indexes K540E only lightly.** After review, no finding names
  K540E on its own. The 6 codon-540 findings sit at the pfdhps level: their
  variables name codon 540 inside a combination or a list (for example the
  A437G/K540E double mutant), or compare how common it is between two groups.
  No graph finding gives a prevalence figure for K540E. `search=name:K540E`
  returns nothing because of how names are written, so the script matches on
  name text; the selection rules are recorded in `data/graph-stats.json`
  (`marker.selection_rule`, `pfdhps_context.selection_rule`).
- **Two findings were caught in review and excluded.** `paFNq6MPX5` and
  `AeI-laBxXr` (variable "Presence of K540 E: in dihydropteroate synthase",
  PMID 25564249) were returned by the live API. Checked against the source
  abstract, their numbers belong to the A581G sextuple mutant, not K540E. They
  stay in `data/graph-stats.json` flagged `vetted: false` with a note, and are
  left out of every count and list. The Data tab shows them under "Caught in
  review".
- **The graph has no per-finding publication date.** Dates on Overview and on the
  Data-tab timeline are each paper's publication date from OpenAlex, matched
  on the finding's `pubmed_id`. All 6 resolved. A finding whose date does not
  resolve is shown as "Date unknown", outside the timeline.
- The search terms and filters are name-text matches, so a relevant variable
  with an unusual name can be missed.

## Data sources

### Primary evidence source

- **System Public Graph** — v2.1, July 1 2026 snapshot, CC BY-NC 4.0, DOI
  [10.7910/DVN/7V6JDO](https://doi.org/10.7910/DVN/7V6JDO). Queried through
  API v1.0, `https://public-api.system.com/v1/`. Every finding and every count
  on Overview, Learn and Data comes from it. Work deriving from the graph inherits
  CC BY-NC.

**Extraction errors.** System's own documentation says roughly 20% of the
associations its API serves are known-bad extractions. Every finding keeps its
`system_id`, `pubmed_id` and `doi`, and links to the paper so a reader can
check it.

### Verification layer

- **System Public Graph, vetted Dataverse release** — the same dataset DOI,
  file `system-public-graph-v1-associations.csv`. Live API results are checked
  against it: `scripts/graph-stats.ts` looks up every finding it pins by
  `system_id` and records `in_vetted_csv` on it. Alert's finding IDs are
  vetted against the same file.

What that check does and does not show for Overview and Data:

- The vetted CSV holds only associations whose two variables are both matched
  to a concept. Most findings the API returns for this marker have one
  unmatched variable, so they cannot appear in it. Of the 32 findings pinned,
  2 are in the vetted CSV (both in the wider pfdhps set).
- Two codon-540 findings were then checked by hand against the source
  abstract, found mis-extracted, and excluded (see Figures).
- The remaining 6 codon-540 findings have **not** been checked against their
  papers. One of them, `QIrkddNp_j` (PMID 16023986), has both variables
  matched to a concept and is still absent from the vetted CSV, the same
  pattern as an excluded finding. It is still shown; it should be checked
  next.

### Publication dates

- **OpenAlex** — `https://api.openalex.org`, CC0. Resolves each codon-540
  finding's `pubmed_id` to its paper's publication date
  (`scripts/graph-stats.ts`). Used for the "most recent" figure on Overview and
  the Data-tab timeline.

### Structural figure on Learn

A separate published source from the System Public Graph. Nothing about these
structures comes from the graph.

- **RCSB Protein Data Bank** — two crystal structures of *P. falciparum*
  HPPK-DHPS, both from the same publication (doi:10.1111/febs.15196):
  - [6JWX](https://www.rcsb.org/structure/6JWX) — wild type, sulfadoxine bound.
  - [6KCL](https://www.rcsb.org/structure/6KCL) — A437G/K540E double mutant.
- **UCSF ChimeraX** — used to render the two images
  (`public/structures/dhps-wt.png`, `public/structures/dhps-mutant.png`).

The figure states only what its captions say; it makes no claim about binding
geometry or mechanism. `components/learn/StructureFigure.tsx` leaves the
figure out entirely if either image file is missing.

### Alert sources (David)

Taken from David's spec for the Alert tab. Items marked _to be added_ are his
to fill in.

- **MalariaGEN Pf8** — genome counts by country and collection year: 33
  countries, 1966–2022. Dataset DOI: _to be added by David_. Licence: _to be
  added_.
- **PubMed abstracts** — 372 papers on K540E. The fields Alert uses were
  **extracted by an AI model and have not been hand-checked**.
- **WHO malaria guidelines, 13 August 2025** — the source of the resistance
  bands Alert displays. Citing the guidelines is not a WHO endorsement of this
  project, and the bands are shown as published context, not as a clinical
  action rule.
- **System Public Graph, vetted Dataverse CSV** — used to vet the finding IDs
  Alert shows (see Verification layer above).
- **Resend** — email delivery service for alert emails. A service, not a data
  source; listed because the shipped app uses it.

### Forecast sources (Benjamin)

- Map data source — name, version, licence and link _to be added by
  Benjamin_. Any location on the map is attributed to that source, never to
  the System graph.

## AI coding tool disclosure

This repository was built with the help of Claude Code (Anthropic), an AI
coding assistant, under the direction of the team. This includes the app
code, the data-pull script `scripts/graph-stats.ts`, and the transcription of
the Learn content from `docs/MARKER-CONTENT.md`. Separately, the Alert tab's
PubMed abstract fields were extracted by an AI model and not hand-checked
(see Data sources).
