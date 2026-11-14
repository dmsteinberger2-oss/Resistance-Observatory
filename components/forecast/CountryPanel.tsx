"use client";

import { useState } from "react";
import Link from "next/link";
import { EvidenceLink } from "@/components";
import { DEMO_MARKER_ID, getMarker } from "@/content/markers";
import { GENOME, GRAPH, alertsFor, genomeSnapshot, graphFindingsFor } from "@/lib/forecast/data";
import { countryName } from "@/lib/forecast/geo";
import type { AlertFeed, GraphFinding } from "@/lib/forecast/types";
import { GenomeYears } from "./GenomeYears";

const LABEL = "text-[0.68rem] uppercase tracking-[0.18em] text-muted";

function Source({ children }: { children: React.ReactNode }) {
  return <p className={`${LABEL} mb-2`}>{children}</p>;
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
      {notes.map((n, i) => (
        <li key={i}>{n}</li>
      ))}
    </ul>
  );
}

function FindingCard({ f }: { f: GraphFinding }) {
  const stat =
    `${f.statisticType.replace(/_/g, " ")} ${f.statisticValue ?? ""}`.trim() +
    (f.ciLower != null && f.ciUpper != null ? ` (CI ${f.ciLower}–${f.ciUpper})` : "") +
    (f.pValue != null ? ` p = ${f.pValue}` : "");
  return (
    <li className="rounded-[10px] border border-line bg-surface-2 p-3 text-sm leading-relaxed">
      {f.spLooksLikeUptake && (
        <span className="mb-1 inline-block rounded-[5px] border border-line-strong px-1.5 py-0.5 text-[0.68rem] text-muted">
          about SP uptake
        </span>
      )}
      <p className="text-fg">
        {f.variable1} {"↔"} {f.variable2}
      </p>
      <p className="tabular-nums text-fg">{stat}</p>
      {f.population && (
        <p className="text-xs text-muted">Study population (Graph text): &ldquo;{f.population}&rdquo;</p>
      )}
      <p className="text-xs text-muted">
        {f.paper.title ? <>{f.paper.title} </> : null}
        {f.paper.year != null
          ? `(${f.paper.year}) (title and date from OpenAlex)`
          : "publication date not resolved"}
      </p>
      <div className="mt-2">
        <EvidenceLink systemId={f.systemId} pubmedId={f.pubmedId} doi={f.doi} />
      </div>
    </li>
  );
}

function FindingList({
  title,
  intro,
  items,
}: {
  title: string;
  intro?: string;
  items: GraphFinding[];
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 4);
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-fg">
        {title} ({items.length})
      </h4>
      {intro && <p className="mt-1 text-xs leading-relaxed text-muted">{intro}</p>}
      {items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {shown.map((f) => (
            <FindingCard key={f.systemId} f={f} />
          ))}
        </ul>
      )}
      {items.length > 4 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="mt-2 rounded-[5px] border border-line-strong px-3 py-1 text-xs text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-drug"
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

export function CountryPanel(props: {
  iso3: string;
  asOfYear: number;
  alertFeed: AlertFeed;
  resolvedFromCity: string | null;
  hrefForAlert: (alertId: string) => string;
  hrefForAlertTab: string;
  onClose: () => void;
}) {
  const { iso3, asOfYear, alertFeed, resolvedFromCity, hrefForAlert, hrefForAlertTab, onClose } =
    props;
  const country = countryName(iso3);
  const marker = getMarker(DEMO_MARKER_ID);
  const sentence = marker.oneSentence.reviewed ? marker.oneSentence.value : null;
  const g = genomeSnapshot(iso3, asOfYear);
  const gf = graphFindingsFor(iso3, asOfYear);
  const alerts = alertsFor(alertFeed, iso3, asOfYear);
  const latest = g.latest;
  const share =
    latest && latest.tested > 0 ? ((latest.withE / latest.tested) * 100).toFixed(1) : null;
  const sampled = g.years.filter((y) => y.tested > 0 && y.year <= asOfYear);

  return (
    <aside
      aria-label={`Evidence for ${country}`}
      className="h-full overflow-y-auto bg-surface p-4 text-fg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={LABEL}>Country view {"·"} as of {asOfYear}</p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight">{country}</h2>
        </div>
        <button
          type="button"
          aria-label="Close country panel"
          onClick={onClose}
          className="rounded-[5px] border border-line-strong px-2.5 py-1 text-sm text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-drug"
        >
          <span aria-hidden>{"✕"}</span>
        </button>
      </div>
      {resolvedFromCity && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {resolvedFromCity} is in {country}. The evidence here is at country level; there is no
          city-level data for this marker.
        </p>
      )}

      <section className="mt-5">
        <p className={`${LABEL} mb-1`}>The marker</p>
        {sentence && <p className="text-sm leading-relaxed">{sentence}</p>}
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Parasite: Plasmodium falciparum {"·"} Gene: pfdhps {"·"} Mutation: K540E {"·"}{" "}
          Drug: sulfadoxine, used with pyrimethamine as SP
        </p>
      </section>

      <section className="mt-6 border-t border-line pt-4" aria-labelledby="fc-genome">
        <Source>
          <span id="fc-genome">
            Genome data {"·"} {GENOME.source.label} {"·"} counted by sample collection year
          </span>
        </Source>
        {g.state === "not_sampled" && (
          <p className="rounded-[5px] border border-dashed border-line-strong p-2 text-sm leading-relaxed">
            <span aria-hidden>{"◌"} </span>
            Not sampled: no genomes from {country} collected up to {asOfYear} in this dataset. That
            is a gap in the data, not a zero.
          </p>
        )}
        {g.state === "tested_not_detected" && (
          <p className="rounded-[5px] border border-line-strong p-2 text-sm leading-relaxed">
            <span aria-hidden>{"○"} </span>
            Tested, K540E not detected: 0 of {g.totalTested} samples collected {g.firstTestedYear}
            {"–"}
            {latest?.year} carry K540E.
          </p>
        )}
        {g.state === "detected" && (
          <p className="rounded-[5px] border border-drug bg-drug-soft p-2 text-sm font-medium leading-relaxed">
            <span aria-hidden>{"●"} </span>K540E detected.
          </p>
        )}
        {latest && (
          <div className="mt-3 text-sm leading-relaxed">
            <p className="tabular-nums">
              Latest sampled year up to {asOfYear}: {latest.year} {"—"} {latest.withE} of{" "}
              {latest.tested} samples carry K540E
              {latest.mixedWithE > 0 && ` (${latest.mixedWithE} of them in mixed infections)`}
            </p>
            {share !== null && <p className="text-xs tabular-nums text-muted">{share}% of samples tested that year</p>}
          </div>
        )}
        {g.firstDetectionYear != null && (
          <p className="mt-2 text-sm leading-relaxed tabular-nums">
            First detection in our data: {g.firstDetectionYear} (
            {g.years.find((y) => y.year === g.firstDetectionYear)?.withE} of{" "}
            {g.years.find((y) => y.year === g.firstDetectionYear)?.tested} samples that year).
          </p>
        )}
        {sampled.length > 0 && (
          <div className="mt-3">
            <GenomeYears years={sampled} />
          </div>
        )}
        {g.totalOther > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Other calls at codon 540 that are not K540E (for example another amino acid):{" "}
            {g.totalOther} samples. They count as tested, not as K540E.
          </p>
        )}
        <Notes notes={GENOME.source.notes} />
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer text-fg">Source and licence</summary>
          <p className="mt-1">Licence: {GENOME.source.licence}</p>
          <p className="mt-1">{GENOME.source.citation}</p>
        </details>
      </section>

      <section className="mt-6 border-t border-line pt-4">
        <Source>Papers {"·"} counted by publication date</Source>
        <p className="text-sm leading-relaxed text-muted">
          The list of K540E papers is not loaded yet, so no paper counts are shown for {country}.
        </p>
      </section>

      <section className="mt-6 border-t border-line pt-4">
        <Source>
          Public Graph {"·"} {GRAPH.source.label} v{GRAPH.version} {"·"} findings whose study
          text names {country}
        </Source>
        <FindingList
          title="Findings on SP"
          intro={`What studies in ${country} measured about sulfadoxine-pyrimethamine. This is what is at stake if K540E rises.`}
          items={gf.sp}
        />
        <FindingList title="Findings on combinations that include codon 540" items={gf.codon540} />
        {gf.sp.length === 0 && gf.codon540.length === 0 && (
          <p className="mt-3 text-sm leading-relaxed">
            The Graph has no SP or codon-540 finding whose study text names {country}. That gap is
            itself a finding: of {GRAPH.totals.sp} Graph findings on SP,{" "}
            {GRAPH.totals.spNamingCountry} name any country.
          </p>
        )}
        <Notes notes={GRAPH.source.notes} />
      </section>

      <section className="mt-6 border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <Source>Alerts {"·"} from the Alert tab</Source>
          {alertFeed.placeholder && (
            <span className="mb-2 rounded-[5px] border border-signal bg-signal-soft px-1.5 py-0.5 text-[0.68rem] font-semibold tracking-wider text-signal">
              PLACEHOLDER
            </span>
          )}
        </div>
        {alertFeed.placeholder && (
          <p className="mb-2 text-xs text-muted">
            These are stand-ins for layout. The Alert tab&rsquo;s real alerts are not loaded yet.
          </p>
        )}
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">
            No alerts for {country} as of {asOfYear}.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-[10px] border border-line bg-surface-2 p-3 text-sm">
                <p className="tabular-nums text-muted">{a.year}</p>
                <p className="text-fg">{a.headline}</p>
                <span className="mt-1 inline-block rounded-[5px] border border-line-strong px-1.5 py-0.5 text-[0.68rem] text-muted">
                  {a.rule}
                </span>
                <div className="mt-1">
                  <Link href={hrefForAlert(a.id)} className="text-drug underline underline-offset-4">
                    Open in Alert tab {"→"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <Link href={hrefForAlertTab} className="text-drug underline underline-offset-4">
            Open the Alert tab for {country} {"→"}
          </Link>
        </p>
      </section>

      <p className="mt-6 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        Observed history only. No projections, no treatment advice. Each source keeps its own clock:
        genomes by collection year, papers and Graph findings by publication date.
      </p>
    </aside>
  );
}
