import { EvidenceLink } from "@/components/EvidenceLink";
import { StudyTypeChip } from "@/components/data/StudyTypeChip";
import { formatGraphDate } from "@/lib/stats";
import { spotStatusLabel, type MarkerFinding } from "@/lib/findings";

/**
 * Publication-date ledger of the demo marker's findings, oldest to newest.
 * Dates come from OpenAlex, matched on PubMed ID. A finding whose date did not
 * resolve sits outside the timeline under "Date unknown" — encoded by position,
 * node geometry (circle vs rotated diamond), and explicit label, never colour alone.
 */
export function FindingsTimeline({ findings }: { findings: MarkerFinding[] }) {
  const dated = findings.filter((f) => f.published);
  const undated = findings.filter((f) => !f.published);
  return (
    <div className="my-8 space-y-10">
      <Group
        title="Chronological Ledger"
        note="Oldest first. Findings extracted from the same paper share its OpenAlex publication date."
        findings={dated}
      />
      {undated.length ? (
        <Group
          title="Date Unknown"
          note="OpenAlex returned no publication date for these records. They sit outside the chronological rail; follow the source link for the paper's own date."
          findings={undated}
        />
      ) : null}
    </div>
  );
}

function Group({
  title,
  note,
  findings,
}: {
  title: string;
  note: string;
  findings: MarkerFinding[];
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <h3 className="font-display text-lg font-semibold text-fg sm:text-xl">
          {title}{" "}
          <span className="ml-1.5 font-mono text-xs font-normal text-muted">
            ({findings.length})
          </span>
        </h3>
        <p className="text-xs text-muted">{note}</p>
      </div>

      <ol className="mt-6 space-y-4 border-l border-line-strong pl-5 sm:pl-7">
        {findings.map((f, index) => {
          const spotGlyph =
            f.spotCheck?.status === "supported"
              ? "✓"
              : f.spotCheck?.status === "partly_supported"
                ? "◐"
                : "·";

          return (
            <li key={f.systemId} className="relative">
              {/* Rail node: solid circle for dated, rotated hollow diamond for undated */}
              <span
                aria-hidden="true"
                className={`absolute -left-[26px] top-5 h-3 w-3 border-2 sm:-left-[34px] ${
                  f.published
                    ? "rounded-full border-drug bg-bg"
                    : "rotate-45 border-signal bg-bg"
                }`}
              />

              <div className="ro-panel overflow-hidden p-4 sm:p-5">
                {/* Metadata Top Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs tabular-nums">
                    <span className="text-muted">
                      #{String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-semibold text-drug">
                      {f.published ? (
                        <time dateTime={f.published}>
                          {formatGraphDate(f.published)}
                        </time>
                      ) : (
                        "Date unknown"
                      )}
                    </span>
                    <StudyTypeChip studyType={f.studyType} />
                  </div>

                  <span className="rounded-[4px] border border-line bg-[#050d17] px-2.5 py-1 font-mono text-xs text-fg">
                    Statistic: {f.statisticType}
                    {f.statisticValue !== null ? ` (${f.statisticValue})` : ""}
                  </span>
                </div>

                {/* Association Statement */}
                <p className="mt-3.5 text-base leading-snug text-fg">
                  <span className="font-semibold">{f.variable1}</span>
                  <span className="mx-1.5 font-mono text-xs uppercase tracking-wider text-muted">
                    — associated with —
                  </span>
                  <span className="font-semibold">{f.variable2}</span>
                </p>

                {/* Spot-Check Audit Row */}
                <div className="mt-3 rounded-[5px] border border-line bg-[#06101c] px-3.5 py-2.5 text-xs leading-relaxed text-body">
                  {f.spotCheck ? (
                    <p>
                      <span className="font-mono text-muted">
                        AI-assisted spot-check (not human-reviewed):{" "}
                      </span>
                      <span className="font-mono font-semibold text-fg">
                        {spotGlyph} {spotStatusLabel(f.spotCheck.status)}
                      </span>
                      {" — "}
                      {f.spotCheck.note}
                    </p>
                  ) : (
                    <p className="font-mono text-muted">
                      Not covered by the spot-check.
                    </p>
                  )}
                </div>

                {/* Paper Provenance Link */}
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-1">
                  <EvidenceLink
                    systemId={f.systemId}
                    pubmedId={f.pubmedId}
                    doi={f.doi}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
