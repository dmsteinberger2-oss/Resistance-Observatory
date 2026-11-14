"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { WhoBasis } from "@/lib/alert/derive";

export type CountryRow = {
  iso3: string;
  name: string;
  basis: WhoBasis;
  /** Sampled years (cells with any data). */
  cells: number;
  /** Cells meeting the minimum sample size. */
  qualifying: number;
  /** PubMed papers on the marker that name this country. */
  papers: number;
};

const GROUPS: { basis: WhoBasis; title: string; sub: string }[] = [
  { basis: "east_southern_africa", title: "East & Southern Africa", sub: "WHO K540E bands" },
  { basis: "central_west_africa", title: "Central & West Africa", sub: "emergence presets" },
  { basis: "outside_africa", title: "Outside Africa", sub: "regional presets" },
];

const FEATURED_ISOS = ["KEN", "NGA", "COD", "TZA", "MWI", "VNM"] as const;

export function CountryPicker({
  rows,
  value,
  minN,
  onChange,
}: {
  rows: CountryRow[];
  value: string;
  minN: number;
  onChange: (iso3: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const current = rows.find((r) => r.iso3 === value);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const match = (r: CountryRow) =>
    !needle || r.name.toLowerCase().includes(needle) || r.iso3.toLowerCase().includes(needle);
  const flat = GROUPS.flatMap((g) => rows.filter((r) => r.basis === g.basis && match(r)));

  const pick = (iso3: string) => {
    onChange(iso3);
    setOpen(false);
    setQ("");
  };

  return (
    <div
      ref={wrap}
      className="relative inline-flex"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#ffffff29] bg-[#16344a]/80 px-3 py-1.5 text-sm font-semibold text-fg transition-colors hover:border-drug hover:bg-[#16344a]"
      >
        <span>{current?.name ?? value}</span>
        <span className="font-mono text-xs font-normal text-muted">{value}</span>
        <span className="text-xs text-drug" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label="Choose a country"
          className="absolute left-0 top-full z-40 mt-2 w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-[#ffffff2e] bg-[#0d2233] p-3.5 text-sm shadow-[0_24px_64px_#02060bd9]"
        >
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && flat[0]) pick(flat[0].iso3);
            }}
            placeholder="Search country or ISO3…"
            aria-label="Filter countries"
            className="h-9 w-full rounded-lg border border-[#ffffff29] bg-[#050d17] px-3 text-sm text-fg placeholder:text-muted focus:border-drug focus:outline-none"
          />

          {!needle ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-b border-[#ffffff18] pb-2.5">
              <span className="mr-1 font-mono text-xs text-muted">Quick jump:</span>
              {FEATURED_ISOS.filter((iso) => rows.some((r) => r.iso3 === iso)).map((iso) => {
                const r = rows.find((x) => x.iso3 === iso)!;
                const active = iso === value;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => pick(iso)}
                    className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-drug bg-drug-soft text-drug"
                        : "border-[#ffffff1f] bg-[#050d17]/60 text-[#c4cdd6] hover:border-drug/60 hover:text-fg"
                    }`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="mt-2 max-h-[21rem] overflow-y-auto pr-1">
            {GROUPS.map((g) => {
              const list = rows.filter((r) => r.basis === g.basis && match(r));
              if (list.length === 0) return null;
              return (
                <div key={g.basis} className="mb-3 last:mb-0">
                  <p className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-[#0d2233] py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    <span>
                      <span className="font-semibold text-fg">{g.title}</span> · {g.sub}
                    </span>
                    <span className="normal-case tracking-normal tabular-nums">n≥{minN} yrs · papers</span>
                  </p>
                  <ul className="space-y-0.5">
                    {list.map((r) => (
                      <li key={r.iso3}>
                        <button
                          type="button"
                          onClick={() => pick(r.iso3)}
                          aria-current={r.iso3 === value}
                          className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#16344a] sm:text-sm ${
                            r.iso3 === value ? "bg-[#16344a] font-semibold text-fg" : "text-[#c4cdd6]"
                          }`}
                        >
                          <span className="truncate">
                            {r.name}{" "}
                            <span className="font-mono text-xs font-normal text-muted">{r.iso3}</span>
                          </span>
                          <span
                            className="font-mono text-xs tabular-nums text-muted"
                            title={`${r.qualifying} of ${r.cells} sampled years have at least ${minN} samples`}
                          >
                            <span className={r.qualifying > 0 ? "text-fg" : ""}>{r.qualifying}</span>/{r.cells} yrs
                          </span>
                          <span
                            className="w-20 text-right font-mono text-xs tabular-nums text-muted"
                            title={`${r.papers} PubMed papers on the marker name ${r.name}`}
                          >
                            <span className={r.papers > 0 ? "text-drug" : ""}>{r.papers}</span> paper
                            {r.papers === 1 ? "" : "s"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {flat.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted">
                No country with genome counts matches “{q}”. Countries without data are omitted: unsampled is not zero.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
