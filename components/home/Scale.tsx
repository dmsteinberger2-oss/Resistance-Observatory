import { StatFigure } from "@/components/StatFigure";
import { Reveal } from "@/components/Reveal";
import {
  GRAPH_DOI,
  GRAPH_KNOWN_BAD_SHARE,
  GRAPH_LICENSE,
  GRAPH_MARKER_DATED_FINDINGS,
  GRAPH_MARKER_FINDINGS,
  GRAPH_MARKER_LAST_PUBLISHED,
  GRAPH_MARKER_STUDIES,
  GRAPH_MARKER_VARIABLES,
  GRAPH_PFDHPS_FINDINGS,
  GRAPH_PFDHPS_STUDIES,
  GRAPH_SNAPSHOT_DATE,
  GRAPH_VERSION,
} from "@/lib/stats";

/**
 * The scale of the evidence — framed as scarcity. Every figure comes from
 * lib/stats.ts, which reads the pinned System Public Graph pull.
 */
export function Scale() {
  return (
    <section id="scale" aria-labelledby="scale-h" className="border-y border-line bg-surface py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            The evidence · pfdhps K540E and sulfadoxine
          </p>
          <h2 id="scale-h" className="sr-only">
            How much evidence the graph holds for pfdhps K540E and sulfadoxine
          </h2>
        </Reveal>

        {/* The marker itself: codon 540 */}
        <div className="mt-10 grid gap-x-12 gap-y-12 md:grid-cols-2">
          <Reveal>
            <StatFigure
              stat={{ ...GRAPH_MARKER_FINDINGS, unit: " findings." }}
              showLabel={false}
              showSource={false}
            />
          </Reveal>
          <Reveal delay={120}>
            <StatFigure
              stat={{ ...GRAPH_MARKER_STUDIES, unit: " studies." }}
              showLabel={false}
              showSource={false}
            />
          </Reveal>
        </div>
        <Reveal className="mt-10">
          <p className="max-w-3xl font-display text-2xl leading-snug sm:text-3xl text-pretty">
            That is the entire published evidence base for this marker in the graph.
          </p>
          <p className="mt-4 max-w-3xl text-base text-muted text-pretty">
            <strong className="text-fg">A coverage limitation, stated plainly:</strong> the graph has no variable
            for K540E itself. Its evidence is indexed at the pfdhps / codon-540 level. These counts cover the{" "}
            {GRAPH_MARKER_VARIABLES.value} graph variables whose names mention codon 540 of pfdhps, alone or
            inside a named combination such as the A437G/K540E double mutant.
          </p>
        </Reveal>

        {/* Context: pfdhps overall */}
        <Reveal className="mt-20">
          <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            For context · pfdhps overall, any alteration
          </h3>
        </Reveal>
        <div className="mt-6 grid gap-x-12 gap-y-10 md:grid-cols-3">
          <Reveal>
            <StatFigure stat={GRAPH_PFDHPS_FINDINGS} size="md" showSource={false} />
          </Reveal>
          <Reveal delay={100}>
            <StatFigure stat={GRAPH_PFDHPS_STUDIES} size="md" showSource={false} />
          </Reveal>
          <Reveal delay={200}>
            <StatFigure stat={GRAPH_MARKER_LAST_PUBLISHED} size="md" showSource={false} />
            <p className="mt-2 max-w-xs text-sm text-muted">
              For the codon-540 findings. The graph gives a publication date for only{" "}
              {GRAPH_MARKER_DATED_FINDINGS.value} of the {GRAPH_MARKER_FINDINGS.value}.
            </p>
          </Reveal>
        </div>

        {/* The turn */}
        <Reveal className="mt-20">
          <p className="max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
            When the total is this small, <span className="text-signal">one new finding changes the picture.</span>
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <p className="max-w-3xl border-t border-line pt-4 font-mono text-xs leading-relaxed text-muted">
            Source: System Public Graph v{GRAPH_VERSION.value}, {GRAPH_SNAPSHOT_DATE.value} snapshot, {GRAPH_LICENSE},
            doi:{GRAPH_DOI}. A finding is one association in the graph: two variables linked by a statistic. By
            System&rsquo;s own documentation roughly {GRAPH_KNOWN_BAD_SHARE.value}
            {GRAPH_KNOWN_BAD_SHARE.unit} of API associations are known-bad extractions; the findings counted
            here are not yet cross-verified.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
