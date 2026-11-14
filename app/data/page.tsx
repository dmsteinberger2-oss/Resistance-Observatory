import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ANTIFOLATE,
  CANDIDATE_MARKERS,
  GLOSSARY,
  HISTORY_SLOTS,
  ONE_PARAGRAPH,
  TIMELINE,
} from "@/content/data";
import { canShow, isDraft } from "@/content/review";
import { ALL_STATS } from "@/lib/stats";
import { StatFigure } from "@/components/StatFigure";
import { PullQuote } from "@/components/PullQuote";
import { Timeline } from "@/components/data/Timeline";
import { DraftTag, Held } from "@/components/learn/Gate";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Data",
  description: "A long-form guide to antimalarial resistance evidence: history, timeline, key numbers and glossary.",
};

const TOC = [
  ["why", "Why markers are tracked"],
  ["history", "A history, being sourced"],
  ["timeline", "Introduced vs. emerging"],
  ["markers", "Five markers"],
  ["antifolate", "How antifolate resistance stacks"],
  ["method", "How we read the evidence"],
  ["limits", "What evidence can’t tell you"],
  ["numbers", "Key numbers"],
  ["glossary", "Glossary"],
] as const;

export default function DataPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Masthead */}
      <header className="border-b border-line pb-14 pt-16 sm:pt-24">
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-muted">Data · the long view</p>
        <h1 className="max-w-4xl font-display text-[clamp(2.6rem,6.5vw,5.4rem)] font-semibold leading-[0.98] tracking-tight text-balance">
          Drugs, mutations, and the slow arithmetic of evidence.
        </h1>
        <p className="mt-8 max-w-2xl text-xl leading-relaxed text-muted text-pretty">
          A field guide to how antimalarial resistance is tracked, what the evidence can and cannot say, and
          the vocabulary this project uses. Every figure on this page is held until a person sources it.
        </p>
      </header>

      <div className="grid gap-12 py-14 lg:grid-cols-[13rem_1fr]">
        {/* Table of contents */}
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-24 space-y-2 border-l border-line pl-4 text-sm">
            {TOC.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} className="group flex gap-2 text-muted hover:text-fg">
                  <span className="font-mono text-xs tabular-nums text-line-strong group-hover:text-signal">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 text-lg leading-[1.75] [&_p]:text-pretty">
          {/* 1 */}
          <Section id="why" n={1} title="Why markers are tracked">
            {canShow(ONE_PARAGRAPH) ? (
              <>
                {isDraft(ONE_PARAGRAPH) ? <DraftTag /> : null}
                {ONE_PARAGRAPH.value.map((p, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? "mt-4 first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-7xl first-letter:font-semibold first-letter:leading-[0.8] first-letter:text-signal"
                        : "mt-4"
                    }
                  >
                    {p}
                  </p>
                ))}
              </>
            ) : (
              <Held what="The background paragraph">From docs/SCIENCE.md, pending science-lead check.</Held>
            )}
            <p className="mt-6">
              A researcher tracking a marker has no simple way to know when the evidence has shifted enough to
              matter. That gap is what this project addresses.
            </p>
          </Section>

          {/* 2 */}
          <Section id="history" n={2} title="A history, being sourced">
            <p>
              This history will not be told from memory. Each chapter below is a slot waiting for cited text,
              and stays empty until a person writes it from the sources named.
            </p>
            <div className="mt-6 space-y-4">
              {HISTORY_SLOTS.map((s) => (
                <Held key={s.heading} what={s.heading}>
                  Needs: {s.needs}
                </Held>
              ))}
            </div>
          </Section>

          {/* 3 */}
          <Section id="timeline" n={3} title="Drugs introduced, resistance emerging" wide>
            <p>
              Each lane pairs the year a drug came into wide use with the year reduced efficacy — for
              artemisinin, partial resistance — was first reported.
            </p>
            <Timeline lanes={TIMELINE} />
          </Section>

          {/* 4 */}
          <Section id="markers" n={4} title="Five markers worth knowing">
            <p>A marker means nothing without its drug, so they are always listed together.</p>
            {canShow(CANDIDATE_MARKERS) ? (
              <div className="mt-6 overflow-x-auto rounded-xl border border-line">
                {isDraft(CANDIDATE_MARKERS) ? (
                  <p className="border-b border-line px-4 py-2">
                    <DraftTag />
                  </p>
                ) : null}
                <table className="w-full text-left text-base">
                  <thead className="bg-surface-2 font-mono text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">Gene</th>
                      <th scope="col" className="px-4 py-3">Key alteration(s)</th>
                      <th scope="col" className="px-4 py-3">Drug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CANDIDATE_MARKERS.value.map((m) => (
                      <tr key={m.gene} className="border-t border-line">
                        <th scope="row" className="px-4 py-3 font-mono font-semibold">{m.gene}</th>
                        <td className="px-4 py-3 font-mono text-signal">{m.alterations}</td>
                        <td className="px-4 py-3">{m.drug}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Held what="Candidate markers table">From docs/SCIENCE.md, pending science-lead check.</Held>
            )}
          </Section>

          {/* 5 */}
          <Section id="antifolate" n={5} title="How antifolate resistance stacks">
            {canShow(ANTIFOLATE) ? (
              <>
                {isDraft(ANTIFOLATE) ? <DraftTag /> : null}
                <p className="mt-4">{ANTIFOLATE.value.body}</p>
                <PullQuote cite="The hard constraint">{ANTIFOLATE.value.constraint}</PullQuote>
              </>
            ) : (
              <Held what="Antifolate accumulation">From docs/SCIENCE.md, pending science-lead check.</Held>
            )}
          </Section>

          {/* 6 */}
          <Section id="method" n={6} title="How this project reads the evidence">
            <p>
              The evidence comes from the System Public Graph, version {String(ALL_STATS.PLACEHOLDER_GRAPH_VERSION.value)},
              a snapshot frozen on {String(ALL_STATS.PLACEHOLDER_GRAPH_SNAPSHOT_DATE.value)}. Its atomic unit is
              an <em>association</em>: two variables linked by a statistic. It holds statistical associations, not
              prevalence measurements, so this site shows no prevalence figures.
            </p>
            <p className="mt-4">
              The graph has no geography field and no per-finding publication date. Publication dates are resolved
              through OpenAlex from each finding&rsquo;s PubMed ID or DOI. Locations on the Forecast map come from a
              separate source and are attributed to it, never to the graph.
            </p>
            <p className="mt-4">
              By System&rsquo;s own documentation, roughly{" "}
              {String(ALL_STATS.PLACEHOLDER_GRAPH_KNOWN_BAD_SHARE.value)}
              {ALL_STATS.PLACEHOLDER_GRAPH_KNOWN_BAD_SHARE.unit} of associations served by its API are known-bad
              extractions, and {String(ALL_STATS.PLACEHOLDER_GRAPH_UNGROUNDED_REMOVED.value)} variables that failed
              to ground to a Wikidata concept were removed from the public release. A codon-level mutation may
              simply not be present. Findings shown in the demo are meant to be checked against the source paper;
              what was checked is recorded in the project README.
            </p>
            <PullQuote cite="How the alert demo works">
              The logic is tested on real history; the feed is a snapshot.
            </PullQuote>
            <p>
              Because the graph is frozen, the Alert demo replays real publication history: findings are played
              forward in the order they were actually published, and the matcher reacts as if they were new. It is
              not live surveillance. Every finding keeps its system ID, PubMed ID and DOI, so you can always click
              through to the paper.
            </p>
          </Section>

          {/* 7 */}
          <Section id="limits" n={7} title="What the evidence can’t tell you">
            <ul className="space-y-3">
              {[
                "That a marker’s presence means a patient’s treatment will fail.",
                "That a divergent finding is wrong, refuted, or an error. Studies differ for good reasons.",
                "Any prevalence figure. The graph holds associations, not prevalence.",
                "Where a marker is, from the graph alone. The graph has no geography.",
                "Any numerical forecast. No forecasting model has been evaluated.",
                "A comparison of effect sizes across different statistic types.",
                "That absence of evidence is evidence of absence. A missing relationship may reflect extraction gaps, grounding failures, or no published study.",
                "Any treatment recommendation, for anyone. Nor any WHO endorsement, integration or operational readiness.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-1 font-mono text-sm font-bold text-signal">✕</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <PullQuote cite="Our rule for disagreement">We flag disagreement; we do not adjudicate.</PullQuote>
          </Section>

          {/* 8 */}
          <Section id="numbers" n={8} title="Key numbers" wide>
            <p>
              Every number in this app lives in one file, <code className="font-mono text-base">lib/stats.ts</code>.
              Until a person sources a figure, it renders as a dashed placeholder naming the constant to fill.
            </p>
            <div className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2">
              {(
                [
                  "PLACEHOLDER_ANNUAL_DEATHS",
                  "PLACEHOLDER_ANNUAL_CASES",
                  "PLACEHOLDER_SHARE_UNDER_5",
                  "PLACEHOLDER_SHARE_AFRICA",
                  "PLACEHOLDER_PAPERS_PER_YEAR",
                  "PLACEHOLDER_GRAPH_KNOWN_BAD_SHARE",
                ] as const
              ).map((k, i) => (
                <Reveal key={k} delay={(i % 2) * 100}>
                  <StatFigure stat={ALL_STATS[k]} name={k} />
                </Reveal>
              ))}
            </div>
          </Section>

          {/* 9 */}
          <Section id="glossary" n={9} title="Glossary">
            <dl className="divide-y divide-line border-y border-line">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
                  <dt className="font-display text-xl font-semibold">{g.term}</dt>
                  <dd className="text-muted">
                    {canShow(g) ? (
                      <>
                        {g.definition}
                        {isDraft(g) ? <DraftTag /> : null}
                      </>
                    ) : (
                      <span className="text-gap">Definition held · awaiting science-lead review.</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        </article>
      </div>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  children,
  wide = false,
}: {
  id: string;
  n: number;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-24 pb-16 ${wide ? "" : "max-w-[44rem]"}`}>
      <p className="font-mono text-xs tabular-nums text-signal">{String(n).padStart(2, "0")}</p>
      <h2 id={`${id}-h`} className="mb-5 mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl text-balance">
        {title}
      </h2>
      {children}
    </section>
  );
}
