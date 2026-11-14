# Resistance Observatory

When does new evidence change the picture for a malaria drug-resistance marker?

A hackathon prototype (System Public Challenge, Build Challenge 3). Next.js App
Router + Tailwind, deployed on Vercel.

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
