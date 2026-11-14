"use client";

import { MIN_YEAR, genomeChangesInYear } from "@/lib/forecast/data";
import { countryName } from "@/lib/forecast/geo";
import type { AlertFeed, GenomeChange } from "@/lib/forecast/types";

const ROW =
  "block w-full rounded-[5px] px-2 py-1.5 text-left text-[0.8rem] leading-snug hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-drug";

interface Row {
  key: string;
  iso3: string;
  text: string;
}

/** One row per country: first-detection wording wins if both kinds fall in the year. */
function genomeRows(year: number): Row[] {
  const byIso = new Map<string, GenomeChange[]>();
  for (const c of genomeChangesInYear(year)) {
    byIso.set(c.iso3, [...(byIso.get(c.iso3) ?? []), c]);
  }
  const rows: Row[] = [];
  for (const [iso3, list] of byIso) {
    const det = list.find((c) => c.kind === "first_detection");
    const tst = list.find((c) => c.kind === "first_tested");
    const name = countryName(iso3);
    let text: string;
    if (det) {
      const n = det.counts;
      text = `${name}: first detection in our data — ${n.withE} of ${n.tested} samples carry K540E`;
      if (tst) text += " (first genomes sampled this year)";
    } else if (tst) {
      const n = tst.counts;
      text =
        n.withE === 0
          ? `${name}: first genomes sampled — K540E not detected in ${n.tested} samples`
          : `${name}: first genomes sampled — ${n.withE} of ${n.tested} carry K540E`;
    } else continue;
    rows.push({ key: `${iso3}-${year}`, iso3, text });
  }
  return rows;
}

export function WhatMoved(props: {
  year: number;
  alertFeed: AlertFeed;
  onSelectCountry: (iso3: string) => void;
  className?: string;
}): React.JSX.Element {
  const { year, alertFeed, onSelectCountry, className } = props;
  const now = genomeRows(year);
  const alerts = alertFeed.alerts.filter((a) => a.year === year);

  const before: (Row & { year: number })[] = [];
  for (let y = year - 1; y >= MIN_YEAR && before.length < 5; y--) {
    for (const r of genomeRows(y)) {
      if (before.length < 5) before.push({ ...r, year: y });
    }
  }

  const empty = now.length === 0 && alerts.length === 0;
  const total = now.length + alerts.length;

  return (
    <section aria-label="What moved" className={`fc-card w-full max-w-[320px] p-3 ${className ?? ""}`}>
      <h2 className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">What moved</h2>

      <h3 className="mt-2 text-[0.75rem] font-semibold tabular-nums text-fg">In {year}</h3>
      <div className={total > 6 ? "max-h-[150px] overflow-y-auto" : ""}>
        {empty ? (
          <p className="px-2 py-1 text-[0.8rem] text-muted">Nothing changed in {year} in the genome data.</p>
        ) : (
          <ul className="space-y-0.5">
            {now.map((r) => (
              <li key={r.key}>
                <button type="button" className={ROW} aria-label={`${r.text}, open country`} onClick={() => onSelectCountry(r.iso3)}>
                  <span className="text-fg tabular-nums">{r.text}</span>
                  <span className="mt-0.5 block text-[0.7rem] text-muted">genome data · collection year</span>
                </button>
              </li>
            ))}
            {alerts.map((a) => {
              const text = `${countryName(a.country_iso3)}: ${a.headline}`;
              return (
                <li key={a.id}>
                  <button type="button" className={ROW} aria-label={`${text}, open country`} onClick={() => onSelectCountry(a.country_iso3)}>
                    <span className="text-fg">{text}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1.5 text-[0.7rem]">
                      <span className="rounded-[5px] bg-signal-soft px-1.5 text-signal">
                        <span aria-hidden>⚑ </span>alert
                      </span>
                      {alertFeed.placeholder ? (
                        <span className="rounded-[5px] border border-line-strong px-1.5 uppercase tracking-[0.12em] text-muted">PLACEHOLDER</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {before.length > 0 ? (
        <>
          <h3 className="mt-2 text-[0.75rem] font-semibold tabular-nums text-muted">Before {year}</h3>
          <ul className="space-y-0.5">
            {before.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  className={`${ROW} text-muted`}
                  aria-label={`${r.year}: ${r.text}, open country`}
                  onClick={() => onSelectCountry(r.iso3)}
                >
                  <span className="tabular-nums">{r.year}: {r.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-2 border-t border-line pt-2 text-[0.7rem] leading-snug text-muted">
        Changes are steps in the data, not movement on the ground: a first detection is the first year a sampled genome carried K540E.
      </p>
    </section>
  );
}
