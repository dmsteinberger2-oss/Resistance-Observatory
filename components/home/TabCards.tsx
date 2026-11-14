"use client";

import Link from "next/link";
import { useSelection } from "@/lib/selection";
import { Reveal } from "@/components/Reveal";

const MODULES = [
  {
    href: "/learn",
    code: "01 · LEARN",
    tag: "Biology & Crystal Structures",
    title: "One marker, one drug, one diagram.",
    body: "What the marker is, which drug it affects, and why that matters — in under ninety seconds.",
    cta: "Open Learn",
    schematic: "ladder",
  },
  {
    href: "/forecast",
    code: "02 · MAP",
    tag: "Spatial Observation History",
    title: "Where it has been observed.",
    body: "A map over time, drawn from a separately attributed observation source.",
    cta: "Open Map",
    schematic: "map",
  },
  {
    href: "/alert",
    code: "03 · ALERT",
    tag: "Chronological Publication Replay",
    title: "Watch a marker.",
    body: "Save a watch. When qualifying new evidence appears, get a plain explanation and a link to the paper.",
    cta: "Open Alert",
    schematic: "alert",
  },
  {
    href: "/data",
    code: "04 · DATA",
    tag: "Dossier, Audit & Glossary",
    title: "Every finding, linked to its paper.",
    body: "Every finding the evidence graph holds on this mutation, the ones excluded in review, and key numbers.",
    cta: "Open Data",
    schematic: "ledger",
  },
] as const;

export function TabCards() {
  const { hrefWithSelection } = useSelection();
  return (
    <section
      id="modules"
      aria-labelledby="cards-h"
      className="bg-[#06101c] py-24 sm:py-28"
    >
      <div className="ro-wrap">
        <Reveal>
          <div className="ro-chapter-bar">
            <span className="font-mono font-semibold text-drug">
              05 — Platform Modules
            </span>
            <span className="font-mono">
              Shared URL Selection · pfdhps K540E Carried Across Tabs
            </span>
          </div>
          <h2
            id="cards-h"
            className="mt-8 font-display text-[clamp(1.85rem,3.3vw,2.75rem)] font-semibold leading-[1.08] text-fg"
          >
            Enter the research modules
          </h2>
        </Reveal>

        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {MODULES.map((m, i) => (
            <Reveal as="li" key={m.href} delay={(i % 2) * 90}>
              <Link
                href={hrefWithSelection(m.href)}
                className="group ro-panel flex h-full flex-col justify-between p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-drug/50 sm:p-7"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                    <span className="font-mono text-xs font-semibold tracking-[0.16em] text-drug">
                      {m.code}
                    </span>
                    <span className="font-mono text-xs text-muted">{m.tag}</span>
                  </div>

                  <div className="my-5 rounded-[6px] border border-line bg-[#050d17] px-4 py-3">
                    <ModuleSchematic kind={m.schematic} />
                  </div>

                  <h3 className="font-display text-xl font-semibold leading-snug text-fg sm:text-2xl">
                    {m.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-body">
                    {m.body}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-line pt-4 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-fg group-hover:text-drug">
                  <span>{m.cta}</span>
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ModuleSchematic({
  kind,
}: {
  kind: "ladder" | "map" | "alert" | "ledger";
}) {
  return (
    <svg
      viewBox="0 0 360 64"
      aria-hidden="true"
      className="h-14 w-full overflow-visible"
    >
      {kind === "ladder" && (
        <g fill="none">
          <line x1="16" y1="52" x2="344" y2="52" stroke="var(--line)" />
          <line x1="16" y1="32" x2="344" y2="32" stroke="var(--signal)" strokeWidth="1.5" />
          <line x1="16" y1="12" x2="344" y2="12" stroke="var(--line)" />
          <rect x="44" y="45" width="76" height="14" rx="7" fill="#103238" stroke="var(--drug)" />
          <rect x="136" y="25" width="92" height="14" rx="7" fill="#362a19" stroke="var(--signal)" />
          <rect x="244" y="5" width="76" height="14" rx="7" fill="#0d2133" stroke="var(--line-strong)" />
          <circle cx="24" cy="32" r="4" fill="var(--signal)" />
        </g>
      )}
      {kind === "map" && (
        <g fill="none">
          <path d="M12 16H348M12 36H348M12 54H348" stroke="var(--line)" />
          <path
            d="M16 50 L72 44 L122 47 L174 24 L232 34 L290 14 L344 19"
            stroke="var(--drug)"
            strokeWidth="2"
          />
          <path
            d="M16 50 L72 44 L122 47 L174 24 L232 34 L290 14 L344 19 V54 H16 Z"
            fill="var(--drug)"
            fillOpacity="0.12"
          />
          <circle cx="174" cy="24" r="4" fill="var(--drug)" />
          <circle cx="290" cy="14" r="4" fill="var(--signal)" />
        </g>
      )}
      {kind === "alert" && (
        <g fill="none">
          <rect x="8" y="14" width="344" height="36" rx="6" fill="#0b1f30" stroke="var(--line-strong)" />
          <circle cx="28" cy="32" r="6" fill="var(--signal)" />
          <path d="M48 26H196M48 38H256" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="278" y="22" width="60" height="20" rx="4" fill="var(--drug-soft)" stroke="var(--drug)" />
          <path d="M298 32l5 4 8-9" stroke="var(--drug)" strokeWidth="2" />
        </g>
      )}
      {kind === "ledger" && (
        <g fill="none">
          <line x1="36" y1="8" x2="36" y2="56" stroke="var(--line-strong)" strokeWidth="1.5" />
          <circle cx="36" cy="18" r="3.5" fill="var(--drug)" />
          <circle cx="36" cy="34" r="3.5" fill="var(--drug)" />
          <rect x="32.5" y="46.5" width="7" height="7" transform="rotate(45 36 50)" fill="var(--bg)" stroke="var(--signal)" strokeWidth="1.5" />
          <path d="M54 18H230M250 18H336" stroke="var(--fg)" strokeOpacity="0.65" strokeWidth="2" />
          <path d="M54 34H205M250 34H336" stroke="var(--fg)" strokeOpacity="0.45" strokeWidth="2" />
          <path d="M54 50H180M250 50H312" stroke="var(--signal)" strokeOpacity="0.65" strokeWidth="2" strokeDasharray="4 4" />
        </g>
      )}
    </svg>
  );
}
