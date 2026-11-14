"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { deriveAlerts, type AlertData, type Watch } from "@/lib/alert/derive";
import { composeAlert, composeEmail } from "@/lib/alert/compose";
import { pmidStr, type ClientPack, type MarkerDef, type Paper } from "@/lib/alert/pack";
import { GRAPH_RELEASE, pubmedUrl, type EmailExtras } from "@/lib/alert/receipt";
import { buildPermalinkPath } from "@/lib/alert/quality";
import type { LiveCoverage, LiveFinding, LivePaper, LiveStudies } from "./useSystem";

export const TEST_ALERT = { area: "COD", trig: "rise", level: 25 } as const;
const QUARANTINE_EXAMPLE = {
  pmid: "25564249",
  label: "Gutman et al. 2015, Malawi",
  ids: ["paFNq6MPX5", "AeI-laBxXr"],
} as const;

export const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";

type State =
  | { s: "idle" }
  | { s: "working"; step: string }
  | { s: "sent"; id: string; to: string }
  | { s: "error"; message: string };

async function ask<T>(query: string, tries = 3): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const j = (await (await fetch(`/api/alert/system?${query}`)).json()) as { live?: boolean };
      if (j.live) return j as T;
    } catch {
      /* retry transient upstream spell */
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

export function SendTestAlert({
  pack,
  marker,
  data,
  papers,
  asOfLine,
  configured,
  onJump,
}: {
  pack: ClientPack;
  marker: MarkerDef;
  data: AlertData;
  papers: Map<string, Paper>;
  asOfLine: string;
  configured: boolean | null;
  onJump: (qs: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(DEMO_EMAIL);
  const [state, setState] = useState<State>({ s: "idle" });
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawerId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const area = TEST_ALERT.area;
  const info = pack.genomes.countries[area];
  const watch: Watch = useMemo(
    () => ({
      marker: marker.key,
      area,
      trigger: "rise",
      level: TEST_ALERT.level,
      points: pack.thresholds.presets?.change_points ?? 20,
      minN: pack.thresholds.presets?.min_samples ?? 20,
    }),
    [marker.key, area, pack.thresholds.presets],
  );
  const event = useMemo(
    () =>
      deriveAlerts(watch, data)
        .filter((ev) => ev.source === "genomes" && ev.fired)
        .at(-1),
    [watch, data],
  );
  if (!info || !event?.cell) return null;
  const chosen = event;
  const cell = chosen.cell!;
  const country = info.country;
  const qs = { area, trig: TEST_ALERT.trig, level: String(TEST_ALERT.level), finding: chosen.id };

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    if (!configured) return;
    onJump(qs);
    try {
      setState({ s: "working", step: "Checking System API & quarantine ledger…" });
      const composed = composeAlert({
        e: chosen,
        watch,
        marker,
        country,
        basis: info.who_basis,
        pack,
        cells: data.cells,
        papers,
      });

      const unread = pack.literature.papers
        .filter((p) => !p.in_graph && (p.countries_iso3 ?? []).includes(area) && p.pub_year >= cell.year)
        .sort((a, b) => b.pub_year - a.pub_year);
      const unreadIds = unread.map((p) => pmidStr(p.pmid)).filter((id) => /^\d+$/.test(id));
      const coverage = await ask<LiveCoverage>("op=coverage", 4);
      const example = await ask<LivePaper>(`op=paper&pmid=${QUARANTINE_EXAMPLE.pmid}`);
      const held = unreadIds.length
        ? await ask<LiveStudies>(`op=studies&pmids=${unreadIds.slice(0, 45).join(",")}`)
        : null;
      const checks: (LiveFinding | null)[] = [];
      for (const id of [...QUARANTINE_EXAMPLE.ids, ...composed.stakes.lead.map((f) => f.system_id)]) {
        checks.push(await ask<LiveFinding>(`op=finding&id=${encodeURIComponent(id)}`));
      }
      const exampleChecks = checks.slice(0, QUARANTINE_EXAMPLE.ids.length);
      const leadChecks = checks.slice(QUARANTINE_EXAMPLE.ids.length);
      const live = Boolean(coverage);

      const liveChecked: Record<string, string> = {};
      composed.stakes.lead.forEach((f, i) => {
        const c = leadChecks[i];
        if (!c) return;
        const v = c.finding?.statistic_value;
        liveChecked[f.system_id] =
          c.vetted === false
            ? "API check: id not in the vetted set"
            : c.finding
              ? `API check: ${v === f.statistic_value ? "matches snapshot" : "differs from snapshot"}`
              : "API check: id not returned";
      });

      const graphLive: string[] = [];
      if (coverage) {
        graphLive.push(
          `System API connected, checked just now: ${coverage.total} associations returned across the ${coverage.papers.length} ${marker.mutation} papers the graph has read (${coverage.confirmed} confirmed live): ${coverage.shown} vetted, ${coverage.quarantined} unvetted and quarantined. Quarantined associations are counted, never shown.`,
        );
      } else {
        graphLive.push(
          `System API not connected just now; the graph details in this email are from the data pack (${GRAPH_RELEASE}).`,
        );
      }
      const quarantinedIds = QUARANTINE_EXAMPLE.ids.filter(
        (_, i) => exampleChecks[i]?.found && exampleChecks[i]?.vetted === false,
      );
      if (example?.inGraph && quarantinedIds.length) {
        graphLive.push(
          `Quarantine example, ${QUARANTINE_EXAMPLE.label} (PMID ${QUARANTINE_EXAMPLE.pmid}): the System API returns ${example.total} association${example.total === 1 ? "" : "s"} for this paper, ${example.quarantined} outside the vetted set, including ${quarantinedIds.join(" and ")}. The extractor attached risks reported for the A581G-bearing sextuple haplotype to ${marker.mutation}; they are not shown as evidence about ${marker.mutation}.`,
        );
      }

      const figures = pack.literature.abstract_prevalence
        .filter((f) => f.iso3 === area && f.pub_year >= cell.year)
        .sort((a, b) => b.pub_year - a.pub_year);
      const nowHeld = held ? new Set(held.held.map((h) => h.pmid)) : null;

      const extras: EmailExtras & { permalinkUrl?: string } = {
        subjectTag: live ? "System API connected" : "System graph v2.1 snapshot",
        permalinkUrl: `${window.location.origin}${buildPermalinkPath({
          markerUrlId: marker.urlId,
          area,
          trig: watch.trigger,
          level: watch.level,
          findingId: chosen.id,
        })}`,
        liveChecked,
        graphLive,
        recent: {
          title: `Papers published since the ${cell.year} collection that state a ${marker.mutation} figure for ${country}:`,
          items: figures.map((f) => {
            const id = pmidStr(f.pmid);
            const windowStr = f.year_start
              ? `samples from ${f.year_start}${f.year_end && f.year_end !== f.year_start ? ` to ${f.year_end}` : ""}`
              : "collection years not stated";
            return {
              text: `Published ${f.pub_year}: “${f.quote}” · ${f.site ? `site: ${f.site}` : "no single site stated"} · ${windowStr}${f.population ? ` · population: ${f.population}` : ""} · ${papers.get(id)?.title ?? "title not recorded"}`,
              link: { label: `PMID ${id}`, url: papers.get(id)?.url ?? pubmedUrl(id) },
            };
          }),
          note: `Published Molecular / Clinical Papers: machine-read abstracts, quoted word for word, not checked by hand. They sit beside the ${composed.ctx?.geo?.site ? `single-site ${composed.ctx.geo.site} ` : ""}genome count and are never pooled with it: different designs, places and years.`,
        },
        queue: {
          title: `${marker.mutation} papers naming ${country}, published since ${cell.year}, that the graph has not read (snapshot)${nowHeld ? `; per the API the graph now holds ${unreadIds.filter((id) => nowHeld.has(id)).length} of ${unreadIds.length}` : ""}:`,
          items: unread.slice(0, 6).map((p) => {
            const id = pmidStr(p.pmid);
            return {
              text: `Published ${p.pub_year}: ${p.title}${nowHeld?.has(id) ? " (now in the graph, per the API)" : ""}`,
              link: { label: `PMID ${id}`, url: p.url ?? pubmedUrl(id) },
            };
          }),
        },
        links: [
          {
            label: "See this country on the Map",
            url: `${window.location.origin}/forecast?country=${area}&marker=${encodeURIComponent(marker.urlId)}&range=1966-${cell.year}`,
          },
        ],
      };

      const q = new URLSearchParams({ marker: marker.urlId, ...qs });
      const email = composeEmail(composed, {
        e: chosen,
        watch,
        marker,
        country,
        link: `${window.location.origin}/alert?${q.toString()}`,
        asOf: asOfLine,
        extras,
      });

      setState({ s: "working", step: "Dispatching via Resend…" });
      const res = await fetch("/api/alert/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: email.subject, text: email.text, html: email.html }),
      });
      const json = (await res.json()) as { ok?: boolean; id?: string; error?: string; to?: string };
      if (json.ok && json.id) setState({ s: "sent", id: json.id, to: json.to ?? to });
      else setState({ s: "error", message: json.error ?? `HTTP ${res.status}` });
    } catch (err) {
      setState({ s: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const busy = state.s === "working";

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0"
      onKeyDown={(ev) => {
        if (ev.key === "Escape" && open) {
          ev.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
          open
            ? "border-signal bg-signal text-bg"
            : "border-signal/60 bg-signal-soft/70 text-signal hover:border-signal hover:bg-signal-soft"
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 3.5h12v9H2v-9zm0 1l6 4 6-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Send Demo Dispatch</span>
        <span aria-hidden className="text-xs opacity-80">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          id={drawerId}
          role="dialog"
          aria-label="Send Demo Dispatch"
          className="absolute right-0 top-full z-40 mt-2 w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-signal/50 bg-[#0d2233] p-4 shadow-[0_24px_64px_#02060be6]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-signal">
                Live Demo Dispatch · Resend + Permalink
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#c4cdd6] tabular-nums">
                Newest genome signal: <strong className="text-fg">{country}</strong> ({cell.year}),{" "}
                <span className="font-semibold text-fg">{cell.pct.toFixed(1)}%</span> ({cell.x}/{cell.n}) carrying{" "}
                {marker.label} — associated with {marker.drug} susceptibility (≥{TEST_ALERT.level}% watch).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onJump(qs);
                setOpen(false);
              }}
              className="shrink-0 rounded-md border border-drug/50 bg-drug-soft/60 px-2.5 py-1 text-xs font-medium text-drug hover:border-drug"
            >
              Inspect →
            </button>
          </div>

          <form onSubmit={send} className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="test-alert-to">
              Recipient email address
            </label>
            <input
              id="test-alert-to"
              type="email"
              required
              value={to}
              onChange={(x) => setTo(x.target.value)}
              placeholder="you@institute.org"
              disabled={!configured}
              className="h-9 min-w-[12rem] flex-1 rounded-lg border border-[#ffffff2e] bg-[#050d17] px-3 text-xs text-fg placeholder:text-muted focus:border-signal focus:outline-none disabled:opacity-50 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!configured || busy}
              className="h-9 rounded-lg bg-signal px-4 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40 sm:text-sm"
            >
              {configured === null
                ? "Checking…"
                : !configured
                  ? "Preview only"
                  : busy
                    ? "Sending…"
                    : "Send Dispatch"}
            </button>
          </form>

          <p className="mt-2 text-xs leading-relaxed text-muted" aria-live="polite">
            {state.s === "sent" ? (
              <span className="text-drug">
                ✓ Sent · Resend ID <span className="font-mono">{state.id}</span> · to {state.to}
              </span>
            ) : state.s === "error" ? (
              <span className="text-signal">Not sent: “{state.message}”</span>
            ) : state.s === "working" ? (
              <span className="text-fg">{state.step}</span>
            ) : configured === false ? (
              "No Resend API key configured on this server; open Tab 3 (Email & Permalink) to preview the exact HTML dispatch."
            ) : (
              "Includes observed vs cutoff, study provenance, live System API quarantine check, permalink, and full citation receipt."
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
