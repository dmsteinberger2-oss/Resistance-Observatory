# Resistance Observatory

When does new evidence change the picture for a malaria drug-resistance marker?

A hackathon prototype (System Public Challenge, Build Challenge 3). Next.js App
Router + Tailwind, deployed on Vercel (import this repo at vercel.com/new —
framework auto-detects as Next.js; the site needs no env vars at build or run
time, because its figures are pinned in `data/graph-stats.json`).

**Honesty note.** The evidence graph is a frozen snapshot. The alert demo
replays real publication history: findings are played forward in the order
they were actually published, and the matcher reacts as if they were new. The
logic is tested on real history; the feed is a snapshot. This is not live
surveillance, not clinical guidance, and not affiliated with or endorsed by WHO.

## Tabs and owners

| Route       | What                                               | Owner    |
| ----------- | -------------------------------------------------- | -------- |
| `/`         | Scroll-driven explainer: problem, evidence, gap    | Solayman |
| `/learn`    | Marker, drug, why it matters, one diagram          | Solayman |
| `/forecast` | Map of where the marker has been observed          | Benjamin |
| `/alert`    | Save a watch; replayed evidence fires alerts       | David    |
| `/data`     | Long-form guide, findings timeline, glossary       | Solayman |

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

- `content/markers.ts` — typed marker content for Learn. The demo marker is
  `pfdhps-K540E` (drug: sulfadoxine, used with pyrimethamine as SP); swap it
  by editing `DEMO_MARKER_ID`. Its content is transcribed from
  `docs/MARKER-CONTENT.md` and marked `reviewed: true`, so Learn renders with
  no held panels. Learn diagrams are built from the `diagram` config (ladder
  or before/after); labels are real `<text>`.
- `content/data.ts` — Data tab content.
- `content/review.ts` — every science field carries `reviewed: boolean`.
  Unreviewed content is **held** in production (a visible "awaiting
  science-lead review" panel renders in its place), per `docs/LEARN.md`.
  To review it in context, run with `NEXT_PUBLIC_SHOW_UNREVIEWED=1` (locally or
  on a Vercel *preview* env only); it then renders with a DRAFT tag. Flip
  `reviewed: true` once the science lead signs off.

Still unreviewed (held, not generated): the other four markers' mechanism
text and diagrams, the Data-tab background paragraphs and history chapters.

## Development

Requires Node 22.18 or newer.

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint    # tsc --noEmit
npm run build
```

The app runs without any key: every figure it shows is read from the pinned
file `data/graph-stats.json`.

To refresh that file from the System Public Graph API, put your key in
`.env.local` (gitignored — never commit it):

```bash
echo 'SYSTEM_API_KEY=<your key>' > .env.local
node --env-file=.env.local scripts/graph-stats.ts
```

The script is server-side only, makes about 300 requests (the limit is
10,000 per day per key), and never logs or writes the key. Commit the
regenerated JSON.

## Figures

Every number in UI copy is a named `GRAPH_*` constant in `lib/stats.ts`, read
from `data/graph-stats.json`, with the exact API query in a comment beside it.
Nothing is typed in by hand and nothing comes from any other source. There are
no placeholder figures left.

| Constant | Value | How it is derived |
| --- | --- | --- |
| `GRAPH_MARKER_VARIABLES` | 8 | variables returned by `GET /variables?search=name:<term>` whose name mentions codon 540 of pfdhps |
| `GRAPH_MARKER_FINDINGS` | 8 | associations of those variables, `GET /variables/{id}/associations`, de-duplicated |
| `GRAPH_MARKER_STUDIES` | 5 | distinct `study_id` over those associations, `GET /studies/{study_id}` |
| `GRAPH_MARKER_DATED_FINDINGS` | 2 | marker findings sitting in a single-finding relationship, `GET /relationships/{a}%7C{b}` |
| `GRAPH_MARKER_LAST_PUBLISHED` | June 15, 2015 | latest `last_published_date` over those relationships |
| `GRAPH_PFDHPS_FINDINGS` | 32 | associations of every variable whose name identifies P. falciparum dhps (includes the 8 above) |
| `GRAPH_PFDHPS_STUDIES` | 24 | distinct `study_id` over those associations |
| `GRAPH_VERSION`, `GRAPH_SNAPSHOT_DATE` | 2.1, July 1, 2026 | release metadata, not an API field |
| `GRAPH_KNOWN_BAD_SHARE` | ~20% | System's API documentation, not an API field |

Coverage limitations, stated on screen as well:

- **The graph has no variable for K540E itself.** `search=name:K540E` returns
  nothing. The marker's evidence is indexed at the pfdhps / codon-540 level:
  the 8 variables whose names mention codon 540, alone or inside a named
  combination (for example the A437G/K540E double mutant). The selection rules
  are recorded in `data/graph-stats.json` (`marker.selection_rule`,
  `pfdhps_context.selection_rule`).
- **The graph has no per-finding publication date.** It records
  `last_published_date` only on concept-level relationships. Only 2 of the 8
  marker findings sit in such a relationship, so the Data-tab timeline dates
  those 2 and lists the other 6 as undated. No date is taken from any other
  source.
- The search terms and filters are name-text matches, so a relevant variable
  with an unusual name can be missed.

## Data sources

- **System Public Graph** — v2.1, July 1 2026 snapshot, CC BY-NC 4.0, DOI
  [10.7910/DVN/7V6JDO](https://doi.org/10.7910/DVN/7V6JDO). Queried through
  API v1.0, `https://public-api.system.com/v1/`. Work deriving from the graph
  inherits CC BY-NC.

This is the only data source. No WHO or other external statistics are used.

**Extraction errors and verification.** System's own documentation says
roughly 20% of the associations its API serves are known-bad extractions. The
findings shown in this app have **not yet been cross-verified** against the
Dataverse CSV or the source papers. Every finding keeps its `system_id`,
`pubmed_id` and `doi`, and links to the paper so a reader can check it.

## AI coding tool disclosure

This repository was built with the help of Claude Code (Anthropic), an AI
coding assistant, under the direction of the team. This includes the app
code, the data-pull script `scripts/graph-stats.ts`, and the transcription of
the Learn content from `docs/MARKER-CONTENT.md`. Science content carries a
`reviewed` flag and is held from display until it is set (see
`docs/SCIENCE.md`, `docs/LEARN.md`).
