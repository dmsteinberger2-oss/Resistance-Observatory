import {
  GRAPH_DOI,
  GRAPH_LICENSE,
  GRAPH_SNAPSHOT_DATE,
  GRAPH_VERSION,
} from "@/lib/stats";

/**
 * Architectural 3-column scientific colophon. Documents data provenance,
 * frozen-snapshot replay methodology, and clinical/regulatory boundaries.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-[#030912]">
      <div className="ro-wrap py-14">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-fg">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 place-items-center rounded-full border border-drug/60 text-sm text-drug"
            >
              ⌁
            </span>
            <span>Resistance Observatory</span>
          </div>
          <p className="font-mono text-xs text-muted">
            Specimen: <span className="text-fg">pfdhps K540E</span> · Drug context:{" "}
            <span className="text-drug">sulfadoxine (SP)</span>
          </p>
        </div>

        <div className="mt-8 grid gap-8 text-xs leading-relaxed text-muted md:grid-cols-3 md:gap-10">
          <div>
            <p className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-fg">
              01 — Data Provenance
            </p>
            <p>
              Statistical associations from the System Public Graph (v
              {String(GRAPH_VERSION.value)}, {String(GRAPH_SNAPSHOT_DATE.value)}{" "}
              snapshot,{" "}
              <a
                href={`https://doi.org/${GRAPH_DOI}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-drug underline decoration-drug/40 underline-offset-4 hover:decoration-drug"
              >
                doi:{GRAPH_DOI}
              </a>
              , {GRAPH_LICENSE}). Publication dates resolved via OpenAlex;
              spatial observations on Map attributed to MalariaGEN Pf8; crystal
              structures from RCSB PDB (6JWX, 6KCL).
            </p>
          </div>

          <div>
            <p className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-fg">
              02 — Snapshot Replay Scope
            </p>
            <p>
              Built on a frozen evidence snapshot. The Alert module replays real
              publication history in chronological order so rule evaluation can
              be audited transparently; it is not live surveillance, and the
              Map module shows observed history only, with no numerical
              projections.
            </p>
          </div>

          <div>
            <p className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-fg">
              03 — Epistemic &amp; Clinical Limits
            </p>
            <p>
              Research prototype for System Public Challenge (Build 3). Not
              clinical guidance, not a treatment recommendation, and not
              affiliated with or endorsed by the World Health Organization. A
              marker association does not establish treatment failure for any
              individual patient.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
