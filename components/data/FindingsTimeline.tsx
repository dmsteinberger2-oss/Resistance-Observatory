import { EvidenceLink } from "@/components/EvidenceLink";
import { formatGraphDate } from "@/lib/stats";
import type { MarkerFinding } from "@/lib/findings";

/**
 * Publication-date timeline of the demo marker's findings. Dated findings run
 * oldest to newest. Findings the graph gives no date for are listed after,
 * under their own heading — position, shape and label, never colour alone.
 */
export function FindingsTimeline({ findings }: { findings: MarkerFinding[] }) {
  const dated = findings.filter((f) => f.published);
  const undated = findings.filter((f) => !f.published);
  return (
    <div className="my-10 space-y-12">
      <Group title="Dated in the graph" note="Oldest first." findings={dated} />
      {undated.length ? (
        <Group
          title="No publication date in the graph"
          note="The graph dates a finding only through a concept-level relationship, and these have none. They are listed by PubMed ID, which is not a date. Follow the link for the paper's own publication date."
          findings={undated}
        />
      ) : null}
    </div>
  );
}

function Group({ title, note, findings }: { title: string; note: string; findings: MarkerFinding[] }) {
  return (
    <section>
      <h3 className="font-display text-xl font-semibold">
        {title} <span className="font-mono text-sm font-normal text-muted">({findings.length})</span>
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-muted">{note}</p>
      <ol className="mt-6 border-l-2 border-line-strong">
        {findings.map((f) => (
          <li key={f.systemId} className="relative pb-8 pl-6 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[7px] top-1.5 h-3 w-3 border-2 border-fg ${f.published ? "rounded-full bg-fg" : "rotate-45 bg-bg"}`}
            />
            <p className="font-mono text-sm font-semibold tabular-nums">
              {f.published ? <time dateTime={f.published}>{formatGraphDate(f.published)}</time> : "Undated in the graph"}
            </p>
            <p className="mt-1 text-base leading-snug">
              <span className="font-semibold">{f.variable1}</span>
              <span className="text-muted"> — associated with — </span>
              <span className="font-semibold">{f.variable2}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              Statistic reported: {f.statisticType}.{f.population ? ` Population: ${f.population}` : ""}
            </p>
            <EvidenceLink systemId={f.systemId} pubmedId={f.pubmedId} doi={f.doi} className="mt-2" />
          </li>
        ))}
      </ol>
    </section>
  );
}
