import Link from "next/link";
import { StatFigure } from "@/components/StatFigure";
import { Reveal } from "@/components/Reveal";
import {
  GRAPH_DOI,
  GRAPH_KNOWN_BAD_SHARE,
  GRAPH_LICENSE,
  GRAPH_MARKER_EXCLUDED_FINDINGS,
  GRAPH_MARKER_FINDINGS,
  GRAPH_MARKER_K540E_ALONE_FINDINGS,
  GRAPH_MARKER_STUDIES,
  GRAPH_PFDHPS_FINDINGS,
  GRAPH_PFDHPS_STUDIES,
  GRAPH_SNAPSHOT_DATE,
  GRAPH_VERSION,
  OPENALEX_MARKER_LAST_PUBLISHED,
} from "@/lib/stats";

/**
 * The scale of the evidence — framed as scarcity, for a reader with no
 * biology background. The three figures that carry the argument are up top;
 * how they were counted sits behind a disclosure. Every figure comes from
 * lib/stats.ts (the pinned System Public Graph pull), except the papers count,
 * which the page reads from the Alert tab's literature pack.
 */
export function Scale({
  papers,
}: {
  papers: { read: number; total: number };
}) {
  return (
    <section
      id="scale"
      aria-labelledby="scale-h"
      className="border-b border-line bg-[#06101c] py-24 sm:py-28"
    >
      <div className="ro-wrap">
        <Reveal>
          <div className="ro-chapter-bar">
            <span className="font-mono font-semibold text-drug">
              01 — The Evidence
            </span>
            <span className="font-mono">
              Specimen: pfdhps K540E · sulfadoxine (SP)
            </span>
          </div>
          <h2
            id="scale-h"
            className="mt-8 max-w-4xl font-display text-[clamp(1.85rem,3.3vw,2.75rem)] font-semibold leading-[1.12] text-fg text-balance"
          >
            pfdhps K540E is a mutation in the malaria parasite, linked to a
            malaria drug working less well. This is how much published evidence
            the System graph holds on it.
          </h2>
        </Reveal>

        {/* The three numbers that carry the argument */}
        <div className="ro-panel mt-12 grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          <Reveal className="p-6 sm:p-7">
            <StatFigure
              stat={{
                value: `${papers.read} of ${papers.total}`,
                label: "papers on this mutation have been read by the graph",
                source: "PubMed search, from the Alert tab's data",
                query:
                  "k540e-data-pack/k540e-literature.json: papers with in_graph, over all papers",
              }}
            />
          </Reveal>
          <Reveal delay={100} className="p-6 sm:p-7">
            <StatFigure
              stat={{
                ...GRAPH_MARKER_EXCLUDED_FINDINGS,
                label:
                  "findings we excluded after checking them against their papers",
              }}
              showSource={false}
            />
          </Reveal>
          <Reveal delay={200} className="p-6 sm:p-7">
            <StatFigure
              stat={{
                ...GRAPH_MARKER_K540E_ALONE_FINDINGS,
                label:
                  "findings name K540E on its own; every one names it as part of a combination",
              }}
              showSource={false}
            />
          </Reveal>
        </div>

        <Reveal className="mt-12">
          <p className="max-w-3xl text-xl leading-snug text-body text-pretty">
            What is left:{" "}
            <strong className="font-semibold text-fg">
              {GRAPH_MARKER_FINDINGS.value} findings from{" "}
              {GRAPH_MARKER_STUDIES.value} studies
            </strong>{" "}
            that mention this mutation, each linked to its paper on the{" "}
            <Link
              href="/data"
              className="text-drug underline decoration-drug/40 underline-offset-4 hover:decoration-drug"
            >
              Data tab
            </Link>
            .
          </p>
        </Reveal>

        {/* The turn */}
        <Reveal className="mt-10">
          <p className="max-w-4xl font-display text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1.08] text-fg text-balance">
            When the total is this small,{" "}
            <span className="text-drug">
              one new finding changes the picture.
            </span>
          </p>
        </Reveal>

        {/* One statement of limits */}
        <Reveal className="mt-8">
          <p className="max-w-3xl text-base leading-relaxed text-muted text-pretty">
            This is a snapshot of the graph from {GRAPH_SNAPSHOT_DATE.value},
            not live surveillance and not clinical guidance. The findings
            counted here were compared with their papers in an AI-assisted
            spot-check that no person has reviewed.
          </p>
        </Reveal>

        {/* How it was counted: for anyone who wants it */}
        <Reveal className="mt-8">
          <details className="ro-panel max-w-4xl overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-display text-base font-semibold text-fg transition-colors hover:bg-[#081523] hover:text-drug sm:px-6">
              How we counted, and the wider numbers
            </summary>
            <div className="space-y-4 border-t border-line bg-[#050f1a]/80 px-5 py-5 text-sm leading-relaxed text-body text-pretty sm:px-6 sm:text-base">
              <p>
                These are the findings the live API returns when a
                variable&rsquo;s name mentions codon 540. None of them is in
                System&rsquo;s vetted release. The Map and Alert tabs also draw
                on the vetted findings from the K540E papers the graph has read,
                so their counts differ.
              </p>
              <p>
                <strong className="font-semibold text-fg">
                  A coverage limitation, stated plainly:
                </strong>{" "}
                the graph indexes K540E only lightly.{" "}
                {GRAPH_MARKER_K540E_ALONE_FINDINGS.value === 0
                  ? "No finding that survived review names K540E on its own."
                  : `${GRAPH_MARKER_K540E_ALONE_FINDINGS.value} findings name K540E on its own.`}{" "}
                The{" "}
                {GRAPH_MARKER_FINDINGS.value -
                  GRAPH_MARKER_K540E_ALONE_FINDINGS.value}{" "}
                codon-540 findings counted here sit at the pfdhps level: they
                name codon 540 inside a combination or a list, such as the
                A437G/K540E double mutant, or compare how common it is between
                two groups. No graph finding gives a prevalence figure for
                K540E.
                {GRAPH_MARKER_EXCLUDED_FINDINGS.value > 0
                  ? ` ${GRAPH_MARKER_EXCLUDED_FINDINGS.value} more findings the live API returned were checked against their paper, found to be mis-extracted, and left out. The Data tab shows them.`
                  : ""}
              </p>
              <p>
                For context, a wider question: {GRAPH_PFDHPS_FINDINGS.value}{" "}
                findings from {GRAPH_PFDHPS_STUDIES.value} studies cover pfdhps
                overall, any alteration. The most recent publication among the
                findings that name codon 540 directly is{" "}
                {OPENALEX_MARKER_LAST_PUBLISHED.value}; the graph has no
                per-finding date, so that one is resolved through OpenAlex from
                the finding&rsquo;s PubMed ID.
              </p>
              <p>
                Each count answers the question written beside it. Other tabs
                ask the graph different questions about this marker, so they
                show different counts. That is expected, not a discrepancy.
              </p>
              <p className="border-t border-line pt-3 font-mono text-xs leading-relaxed text-muted">
                Source: System Public Graph v{GRAPH_VERSION.value},{" "}
                {GRAPH_SNAPSHOT_DATE.value} snapshot, {GRAPH_LICENSE}, doi:
                {GRAPH_DOI}. A finding is one association in the graph: two
                variables linked by a statistic. By System&rsquo;s own
                documentation roughly {GRAPH_KNOWN_BAD_SHARE.value}
                {GRAPH_KNOWN_BAD_SHARE.unit} of API associations are known-bad
                extractions. Publication dates: OpenAlex.
              </p>
            </div>
          </details>
        </Reveal>
      </div>
    </section>
  );
}
