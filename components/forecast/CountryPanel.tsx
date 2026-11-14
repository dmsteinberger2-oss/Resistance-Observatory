"use client";

import { useState } from "react";
import Link from "next/link";
import { EvidenceLink } from "@/components";
import { DEMO_MARKER_ID, getMarker } from "@/content/markers";
import {
  GENOME,
  GRAPH,
  GRAPH_VERIFICATION,
  GRAPH_VETTED,
  PAPERS,
  alertsFor,
  genomeSnapshot,
  graphFindingsFor,
  papersFor,
  papersTotals,
  verificationCounts,
} from "@/lib/forecast/data";
import { countryName } from "@/lib/forecast/geo";
import type { AlertFeed, GraphFinding, PaperRecord } from "@/lib/forecast/types";
import { GenomeYears } from "./GenomeYears";
import { CountryTimeline } from "./CountryTimeline";

const LABEL = "text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-muted";

function Source({ children }: { children: React.ReactNode }) {
  return <p className={`${LABEL} mb-2`}>{children}</p>;
}

const NOTE_CLS = "list-disc space-y-1 pl-4 text-[0.8125rem] leading-relaxed text-muted tabular-nums";

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  const list = (xs: string[]) => (
    <ul className={NOTE_CLS}>
      {xs.map((n, i) => (
        <li key={i}>{n}</li>
      ))}
    </ul>
  );
  return (
    <div className="mt-2.5">
      {list(notes.slice(0, 2))}
      {notes.length > 2 && (
        <details className="mt-1.5 text-[0.8125rem] text-muted">
          <summary className="cursor-pointer font-medium text-fg hover:text-drug">More about this data</summary>
          <div className="mt-1.5">{list(notes.slice(2))}</div>
        </details>
      )}
    </div>
  );
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const paperDate = (p: PaperRecord) => (p.month ? `${MONTHS[p.month - 1]} ${p.year}` : `${p.year}`);
const sentence = (t: string) => {
  const x = t.replace(/_/g, " ");
  return x.charAt(0).toUpperCase() + x.slice(1);
};
const ORDER: Record<string, number> = { supported: 0, partly_supported: 1, not_verifiable: 2, unchecked: 2, contradicted: 3 };
function sortByCheck(items: GraphFinding[]): GraphFinding[] {
  return items
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) =>
        ORDER[a.f.verification?.status ?? "unchecked"] - ORDER[b.f.verification?.status ?? "unchecked"] ||
        a.i - b.i,
    )
    .map((x) => x.f);
}

function VerificationLine({ f }: { f: GraphFinding }) {
  const v = f.verification;
  let head: React.ReactNode;
  let note: string | null = null;
  if (!v) head = <span className="text-muted">Not checked against the paper</span>;
  else if (v.status === "supported")
    head = (
      <>
        <span className="font-medium text-drug">{"\u2713"} Matches the paper</span>
        {v.where && (
          <span className="text-muted"> (checked against the {v.where === "abstract" ? "abstract" : "full text"})</span>
        )}
      </>
    );
  else if (v.status === "partly_supported") {
    head = <span className="font-medium text-fg">{"\u2248"} Partly matches the paper</span>;
    note = v.note;
  } else if (v.status === "contradicted") {
    head = <span className="font-medium text-signal">{"\u2715"} Differs from the paper</span>;
    note = v.note;
  } else head = <span className="text-muted">? Could not be checked against the abstract or open full text</span>;
  return (
    <div className="mt-2 border-t border-white/[0.08] pt-2 text-[0.8125rem] leading-relaxed">
      <p>{head}</p>
      {note && <p className="mt-0.5 tabular-nums text-muted">{note}</p>}
      {v?.quote && (
        <details className="mt-1 text-muted">
          <summary className="cursor-pointer font-medium text-fg hover:text-drug">Quote from the paper</summary>
          <p className="mt-1 rounded-[6px] border border-white/[0.07] bg-[#040c16]/70 p-2 tabular-nums">&ldquo;{v.quote}&rdquo;</p>
        </details>
      )}
    </div>
  );
}

function FindingCard({ f, noCountry }: { f: GraphFinding; noCountry?: boolean }) {
  const stat =
    `${sentence(f.statisticType)}: ${f.statisticValue ?? ""}`.trim() +
    (f.ciLower != null && f.ciUpper != null ? ` (CI ${f.ciLower}\u2013${f.ciUpper})` : "") +
    (f.pValue != null ? ` \u00b7 p = ${f.pValue}` : "");
  const quiet = f.verification?.status === "contradicted";
  return (
    <li
      className={`fc-subcard p-3.5 text-sm leading-relaxed ${
        quiet ? "opacity-80 text-muted" : "border-white/[0.14]"
      }`}
    >
      {vetted(f) != null && (
        <span className="mb-2 inline-block rounded-[5px] border border-white/[0.16] bg-[#050e19]/75 px-2 py-0.5 text-[0.75rem] font-medium text-muted">
          {vetted(f) ? "In System's vetted release" : "API only: not in System's vetted release"}
        </span>
      )}
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted">Graph variables, verbatim</p>
      <p className={`mt-0.5 font-medium ${quiet ? "" : "text-fg"}`}>
        &ldquo;{f.variable1}&rdquo; {"\u2194"} &ldquo;{f.variable2}&rdquo;
      </p>
      <p className="mt-2 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted">Statistic, as extracted by the Graph</p>
      <p className={`mt-0.5 font-medium tabular-nums ${quiet ? "" : "text-fg"}`}>{stat}</p>
      {f.population && (
        <p className="mt-1.5 text-[0.8125rem] tabular-nums text-muted">
          Study population (Graph text{noCountry ? ", no country named" : ""}): &ldquo;{f.population}&rdquo;
        </p>
      )}
      <p className="mt-1 text-[0.8125rem] tabular-nums text-muted">
        {f.paper.title ? <>&ldquo;{f.paper.title}&rdquo; </> : null}
        {f.paper.year != null
          ? `(${f.paper.year}) (title and date from OpenAlex)`
          : "publication date not resolved"}
      </p>
      <VerificationLine f={f} />
      <div className="mt-2.5">
        <EvidenceLink systemId={f.systemId} pubmedId={f.pubmedId} doi={f.doi} />
      </div>
    </li>
  );
}

function tally(items: GraphFinding[]): string {
  const c = verificationCounts(items);
  const parts: string[] = [];
  if (c.supported) parts.push(`${c.supported} match the paper`);
  if (c.partly_supported) parts.push(`${c.partly_supported} partly`);
  if (c.contradicted) parts.push(`${c.contradicted} differ`);
  if (c.not_verifiable) parts.push(`${c.not_verifiable} could not be checked`);
  if (c.unchecked) parts.push(`${c.unchecked} not checked`);
  return parts.join(" \u00b7 ");
}

const vetted = (f: GraphFinding) => f.inVettedCsv;

function FindingList({
  title,
  titleSuffix,
  intro,
  empty,
  items,
  hideWhenEmpty,
  collapsed,
  noCountry,
}: {
  title: string;
  titleSuffix?: string;
  intro?: string;
  empty?: string;
  items: GraphFinding[];
  hideWhenEmpty?: boolean;
  collapsed?: boolean;
  noCountry?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);
  const [all, setAll] = useState(false);
  const [apiOnly, setApiOnly] = useState(false);
  if (hideWhenEmpty && items.length === 0) return null;
  const main = items.filter((f) => vetted(f) !== false);
  const api = items.filter((f) => vetted(f) === false);
  const anyVetted = items.some((f) => vetted(f) === true);
  const visible = sortByCheck(apiOnly ? items : main);
  const shown = all ? visible : visible.slice(0, 4);
  const t = tally(main);
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium tabular-nums text-fg">
        {title} ({items.length}){titleSuffix}
        {main.length > 0 && (
          <span className="font-normal text-muted">
            {" "}
            {"\u2014"} {anyVetted || api.length > 0 ? `${main.length} in System's vetted release: ` : ""}
            {t}
            {api.length > 0 && !apiOnly ? ` \u00b7 ${api.length} more served by the API only (not in the vetted release), listed below` : ""}
          </span>
        )}
      </h4>
      {collapsed && items.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 rounded-[7px] border border-line-strong bg-[#0a1d2e]/80 px-3 py-1 text-[0.8125rem] font-medium text-fg transition-colors hover:border-drug/60 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-drug"
        >
          {open ? "Hide" : "Show"}
        </button>
      )}
      {open && items.length > 0 && intro && <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{intro}</p>}
      {items.length === 0 && empty && <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{empty}</p>}
      {open && visible.length > 0 && (
        <ul className="mt-2.5 space-y-2.5">
          {shown.map((f) => (
            <FindingCard key={f.systemId} f={f} noCountry={noCountry} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {open && visible.length > 4 && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="mt-2.5 rounded-[7px] border border-line-strong bg-[#0a1d2e]/80 px-3 py-1 text-[0.8125rem] font-medium tabular-nums text-fg transition-colors hover:border-drug/60 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-drug"
          >
            {all ? "Show fewer" : `Show all ${visible.length}`}
          </button>
        )}
        {open && api.length > 0 && (
          <button
            type="button"
            onClick={() => setApiOnly((v) => !v)}
            aria-expanded={apiOnly}
            className="mt-2.5 rounded-[7px] border border-line bg-[#071522]/70 px-3 py-1 text-[0.8125rem] tabular-nums text-muted transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-drug"
          >
            {apiOnly
              ? "Hide API-only records"
              : `Show ${api.length} more served by the API but not in System's vetted release`}
          </button>
        )}
      </div>
    </div>
  );
}

function PaperLink({ p, children }: { p: PaperRecord; children: React.ReactNode }) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-drug underline decoration-drug/40 underline-offset-4 transition-colors hover:decoration-drug"
    >
      {children}
      <span aria-hidden> {"\u2197"}</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function PapersBlock({ iso3, country, asOfYear }: { iso3: string; country: string; asOfYear: number }) {
  const [all, setAll] = useState(false);
  const r = papersFor(iso3, asOfYear);
  const tot = papersTotals(asOfYear);
  const newest = [...r.papers].reverse();
  const shown = all ? newest : newest.slice(0, 3);
  const n = r.papers.length;
  return (
    <section className="mt-6 border-t border-line pt-4">
      <Source>
        Papers {"\u00b7"} {PAPERS.source.label} {"\u00b7"} counted by publication date
      </Source>
      {n === 0 ? (
        <p className="text-sm leading-relaxed tabular-nums">
          No paper in this list concerns {country} up to {asOfYear}. That is a gap in this list, not
          proof that nothing was published.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed tabular-nums">
            <span className="font-semibold text-fg">{n}</span> papers that mention K540E concern {country}, published up to {asOfYear}.
          </p>
          {r.earliest && (
            <p className="mt-2 text-sm leading-relaxed tabular-nums">
              Earliest by publication date:{" "}
              <PaperLink p={r.earliest}>{r.earliest.title}</PaperLink> ({paperDate(r.earliest)}
              {r.earliest.journal ? `; ${r.earliest.journal}` : ""})
            </p>
          )}
          <p className="mt-2 text-sm leading-relaxed tabular-nums">
            The Graph has read <span className="font-semibold text-fg">{r.readByGraph}</span> of these{" "}
            <span className="font-semibold text-fg">{n}</span> papers.
          </p>
          <p className="text-[0.8125rem] text-muted">
            Read means the Graph&rsquo;s vetted release holds at least one finding from the paper.
          </p>
        </>
      )}
      <p className="mt-1.5 text-[0.8125rem] tabular-nums text-muted">
        Across all countries: {tot.readByGraph} of {tot.total} K540E papers published up to {asOfYear} are in
        the Graph.
      </p>
      {n > 0 && (
        <>
          <ul className="mt-3 space-y-2">
            {shown.map((p) => (
              <li key={p.pmid} className="fc-subcard p-3.5 text-sm leading-relaxed">
                <PaperLink p={p}>{p.title}</PaperLink>
                <p className="mt-1 text-[0.8125rem] tabular-nums text-muted">
                  {p.journal ? `${p.journal} \u00b7 ` : ""}
                  {paperDate(p)} {"\u00b7"} PMID {p.pmid}
                </p>
                {p.readByGraph && (
                  <span className="mt-1.5 inline-block rounded-[5px] border border-drug/40 bg-drug-soft px-2 py-0.5 text-[0.75rem] font-medium text-drug">
                    {"\u2713"} read by the Graph
                  </span>
                )}
              </li>
            ))}
          </ul>
          {n > 3 && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              aria-expanded={all}
              className="mt-2.5 rounded-[7px] border border-line-strong bg-[#0a1d2e]/80 px-3 py-1 text-[0.8125rem] font-medium tabular-nums text-fg transition-colors hover:border-drug/60 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-drug"
            >
              {all ? "Show fewer" : `Show all ${n}`}
            </button>
          )}
        </>
      )}
      <Notes notes={PAPERS.source.notes} />
    </section>
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
  const haplotype = gf.haplotype ?? [];
  const alerts = alertsFor(alertFeed, iso3, asOfYear);
  const latest = g.latest;
  const share =
    latest && latest.tested > 0 && latest.withE > 0 ? ((latest.withE / latest.tested) * 100).toFixed(1) : null;
  const sampled = g.years.filter((y) => y.tested > 0 && y.year <= asOfYear);

  return (
    <aside
      aria-label={`Evidence for ${country}`}
      className="h-full overflow-y-auto overscroll-contain bg-transparent px-5 pb-6 pt-0 text-fg"
    >
      <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-start justify-between gap-3 border-b border-white/[0.1] bg-[#071522]/90 px-5 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={LABEL}>Country view</span>
            <span className="fc-asof-pill tabular-nums">AS OF {asOfYear}</span>
          </div>
          <h2 className="mt-1.5 text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] text-fg">
            {country}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close country panel"
          onClick={onClose}
          className="fc-btn shrink-0 !h-8 !min-w-8 !px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-drug"
        >
          <span aria-hidden>{"✕"}</span>
        </button>
      </div>

      {resolvedFromCity && (
        <p className="mb-4 rounded-[8px] border border-white/[0.1] bg-[#050e19]/65 px-3 py-2 text-sm leading-relaxed text-muted">
          {resolvedFromCity} is in {country}. The evidence here is at country level; there is no
          city-level data for this marker.
        </p>
      )}

      <section
        className={`fc-alert-box p-3.5 ${alerts.length > 0 ? "has-alerts" : ""}`}
        aria-label="Alerts from the Alert tab"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Source>Alerts {"·"} from the Alert tab</Source>
          {alertFeed.placeholder && (
            <span className="mb-2 rounded-[5px] border border-signal bg-signal-soft px-1.5 py-0.5 text-[0.75rem] font-semibold tracking-wider text-signal">
              PLACEHOLDER
            </span>
          )}
        </div>
        {alertFeed.placeholder && (
          <p className="mb-2 text-[0.8125rem] text-muted">
            These are stand-ins for layout. The Alert tab&rsquo;s real alerts are not loaded yet.
          </p>
        )}
        {alerts.length === 0 ? (
          <p className="text-[0.8125rem] tabular-nums text-muted">No alerts for {country} as of {asOfYear}.</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="text-sm leading-snug">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-[5px] border border-signal/45 bg-signal-soft px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.1em] tabular-nums text-signal">
                    <span aria-hidden>{"\u2691"}</span> Alert {"\u00b7"} {a.year}
                  </span>
                  <span className="rounded-[5px] border border-white/[0.12] bg-[#050e19]/70 px-2 py-0.5 text-[12px] text-muted">
                    {a.rule.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="leading-relaxed tabular-nums text-fg">
                  {a.headline}
                </p>
                <div className="mt-2.5">
                  <Link href={hrefForAlert(a.id)} className="fc-alert-cta">
                    <span>Open this alert in the Alert tab</span>
                    <span aria-hidden>{"\u2192"}</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {alerts.length > 0 && (
          <p className="mt-3 border-t border-white/[0.08] pt-2 text-[0.8125rem] text-muted">
            Alert years are genome collection years. Rules and thresholds belong to the Alert tab.
          </p>
        )}
        <p className={`${alerts.length > 0 ? "mt-1.5" : "mt-2"} text-[0.8125rem]`}>
          <Link
            href={hrefForAlertTab}
            className="inline-flex items-center gap-1 font-medium text-drug underline decoration-drug/45 underline-offset-4 transition-colors hover:decoration-drug"
          >
            Watch {country} in the Alert tab {"\u2192"}
          </Link>
        </p>
      </section>

      <section className="mt-5">
        <p className={`${LABEL} mb-1.5`}>The marker</p>
        {sentence && <p className="text-sm leading-relaxed text-fg">{sentence}</p>}
        <p className="mt-1.5 text-[0.8125rem] leading-snug text-muted">
          Parasite: <i>Plasmodium falciparum</i> {"·"} Gene: <i>pfdhps</i> {"·"} Mutation: K540E {"·"}{" "}
          Drug: sulfadoxine, used with pyrimethamine as SP
        </p>
      </section>

      <section className="mt-5 border-t border-line pt-4" aria-labelledby="fc-genome">
        <Source>
          <span id="fc-genome">
            Genome data {"·"} {GENOME.source.label} {"·"} counted by sample collection year
          </span>
        </Source>
        {g.state === "not_sampled" && (
          <p className="rounded-[8px] border border-dashed border-line-strong bg-[#050e19]/60 p-3 text-sm leading-relaxed tabular-nums">
            <span aria-hidden>{"◌"} </span>
            Not sampled: no genomes from {country} collected up to {asOfYear} in this dataset. That
            is a gap in the data, not a zero.
          </p>
        )}
        {g.state === "tested_not_detected" && (
          <p className="rounded-[8px] border border-line-strong bg-[#081929]/75 p-3 text-sm leading-relaxed tabular-nums">
            <span aria-hidden>{"○"} </span>
            Tested, K540E not detected: 0 of {g.totalTested} samples collected {g.firstTestedYear}
            {"–"}
            {latest?.year} carry K540E.
          </p>
        )}
        {g.state === "detected" && (
          <p className="rounded-[8px] border border-drug/55 bg-drug-soft p-3 text-sm font-medium leading-relaxed tabular-nums text-fg shadow-[inset_0_1px_0_rgba(112,224,202,0.18)]">
            <span className="text-drug" aria-hidden>{"●"} </span>
            K540E detected in at least one sampled year up to {asOfYear}.
          </p>
        )}
        {latest && (
          <div className="fc-subcard mt-3 p-3 text-sm leading-relaxed">
            <p className="font-medium tabular-nums text-fg">
              Latest sampled year up to {asOfYear}: {latest.year} {"—"} {latest.withE} of{" "}
              {latest.tested} samples carry K540E
              {latest.mixedWithE > 0 && ` (${latest.mixedWithE} of them in mixed infections)`}
            </p>
            {latest.other * 2 > latest.tested && (
              <p className="mt-1 tabular-nums text-muted">
                Most samples tested in {latest.year} carry a different amino acid at codon 540 ({latest.other} of{" "}
                {latest.tested}); they are not K540E.
              </p>
            )}
            {share !== null && (
              <p className="mt-1 text-[0.8125rem] tabular-nums text-muted">
                <span className="font-semibold text-drug">{share}%</span> of the {latest?.tested} samples in this dataset that year (partner studies, not national prevalence)
              </p>
            )}
          </div>
        )}
        {g.firstDetectionYear != null && (
          <p className="mt-2.5 text-sm leading-relaxed tabular-nums">
            First detection in our data: <span className="font-semibold text-fg">{g.firstDetectionYear}</span> (
            {g.years.find((y) => y.year === g.firstDetectionYear)?.withE} of{" "}
            {g.years.find((y) => y.year === g.firstDetectionYear)?.tested} samples that year).
          </p>
        )}
      </section>

      <section className="mt-6 min-w-0 border-t border-line pt-4">
        <Source>Evidence over time {"\u00b7"} three clocks on one axis</Source>
        <div className="min-w-0 max-w-full overflow-x-hidden">
          <CountryTimeline iso3={iso3} asOfYear={asOfYear} alertFeed={alertFeed} />
        </div>
      </section>

      <section className="mt-3 min-w-0">
        {sampled.length > 0 && (
          <details className="fc-subcard mt-3 p-3" open={sampled.length <= 10}>
            <summary className="cursor-pointer text-sm font-medium tabular-nums text-fg hover:text-drug">
              Year-by-year genome counts ({sampled.length} sampled years)
            </summary>
            <div className="mt-2.5">
              <GenomeYears years={sampled} />
            </div>
          </details>
        )}
        {g.totalOther > 0 && (
          <p className="mt-2.5 text-[0.8125rem] leading-relaxed tabular-nums text-muted">
            Other calls at codon 540 that are not K540E (for example another amino acid):{" "}
            {g.totalOther} samples. They count as tested, not as K540E.
          </p>
        )}
        <Notes notes={GENOME.source.notes} />
        <details className="mt-2 text-[0.8125rem] text-muted">
          <summary className="cursor-pointer font-medium text-fg hover:text-drug">Source and licence</summary>
          <p className="mt-1">Licence: {GENOME.source.licence}</p>
          <p className="mt-1">{GENOME.source.citation}</p>
        </details>
      </section>

      <PapersBlock iso3={iso3} country={country} asOfYear={asOfYear} />

      <section className="mt-6 border-t border-line pt-4">
        <Source>
          Public Graph {"·"} {GRAPH.source.label} v{GRAPH.version} {"·"} findings whose study
          text names {country}
        </Source>
        <FindingList
          title="Findings on SP"
          intro={`Graph findings about sulfadoxine-pyrimethamine itself, from studies whose population text names ${country}. They are not findings about K540E.`}
          empty={`No SP finding in the Graph has study text naming ${country}.`}
          items={gf.sp}
        />
        <FindingList
          title="Findings on haplotypes that contain K540E"
          titleSuffix={" — not country-specific"}
          collapsed
          noCountry
          intro="The Graph's vetted findings on the dhfr/dhps quintuple and sextuple mutants, named combinations of mutations that include K540E. Their study text names no country, so they are shown for every country. A combination is a property of an individual parasite."
          items={haplotype}
          hideWhenEmpty
        />
        <FindingList
          title="Other Graph records that mention codon 540"
          items={gf.codon540}
          hideWhenEmpty
        />
        {gf.sp.length === 0 && gf.codon540.length === 0 && haplotype.length === 0 && (
          <p className="mt-3 text-sm leading-relaxed tabular-nums">
            No SP or codon-540 finding in the Graph has study text naming {country}. That does not mean no
            study exists: only {GRAPH.totals.spNamingCountry} of {GRAPH.totals.sp} Graph findings on SP name
            any country.
          </p>
        )}
        <p className="mt-4 text-[0.8125rem] leading-relaxed tabular-nums text-muted">
          How these were checked: {GRAPH_VERIFICATION.method} {"\u2014"} {GRAPH_VERIFICATION.checkedBy}.{" "}
          {GRAPH_VERIFICATION.checkedAt.slice(0, 10)}
        </p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed tabular-nums text-muted">
          Vetted status: checked on {GRAPH_VETTED.checkedAt.slice(0, 10)} against the associations file System
          publishes on Harvard Dataverse. In the vetted release = the record&rsquo;s id appears in that file;
          API-only = it does not.
        </p>
        <Notes notes={GRAPH.source.notes} />
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
          Vetted means the record is in the bulk release System publishes on Harvard Dataverse; API-only
          records are served by the API but left out of that release.
        </p>
      </section>

      <p className="mt-6 border-t border-line pt-3 text-[0.8125rem] leading-relaxed text-muted">
        Observed history only. No projections, no treatment advice. Each source keeps its own clock:
        genomes by collection year, papers and Graph findings by publication date.
      </p>
    </aside>
  );
}
