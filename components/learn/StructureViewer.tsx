"use client";

/**
 * Interactive 3D viewer for two published crystal structures of
 * P. falciparum HPPK-DHPS, loaded live from RCSB PDB with 3Dmol.js.
 *
 * - 3Dmol.js comes from a CDN <script> tag (no npm dependency), client-side only.
 * - Structures come from RCSB via $3Dmol.download("pdb:<id>").
 * - Everything said about a residue (its name, its number, what changed) is
 *   read from what 3Dmol reports for the loaded coordinates. Nothing is
 *   hard-coded per residue. A position is highlighted only if BOTH structures
 *   actually have coordinates there.
 * - The only structural statement made is the measured distance from the
 *   marker residue to the nearest ligand, and that at that distance the two
 *   are not in contact.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const SCRIPT_SRC = "https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.4.2/3Dmol-min.js";
const LOAD_TIMEOUT_MS = 25000;

const STRUCTURES = [
  { key: "wt", pdb: "6JWX", label: "Wild type", siteColorVar: "--amber" },
  { key: "mut", pdb: "6KCL", label: "A437G/K540E double mutant", siteColorVar: "--mint" },
] as const;

/** Positions to look for. Each is used only if both structures resolve it. */
const POSITIONS = [437, 540] as const;
const CONTEXT_COLOR_VAR = "--quiet"; // 437
const CARTOON_COLOR = "#6f8499"; // muted blue-grey
const LIGAND_COLOR = "#c9a7ff"; // distinct from the residue colours; ligands are also labelled
/** Crystallisation additives and ions: present in the entries, not drawn and
 *  not measured against. Names are the entries' own HETNAM records. */
const NOT_SHOWN: Record<string, string> = { GOL: "glycerol", ACT: "acetate", CA: "calcium", MG: "magnesium" };
/** The "not in contact" line is shown only if both measured distances exceed
 *  this. Direct contacts are a few ångströms; this is a conservative cut-off. */
const CONTACT_LIMIT_ANGSTROM = 6;
/** Checked in both entries to say what they do not carry. */
const OTHER_PFDHPS_POSITION = 581;

/** Side-chain charge at physiological pH, by residue name. Used only to word
 *  the one-line note from the names 3Dmol reports. */
const CHARGE: Record<string, "+" | "−"> = { LYS: "+", ARG: "+", ASP: "−", GLU: "−" };

function changeNote(wt: string, mut: string): string {
  if (wt === mut) return "Same residue in both structures.";
  const a = CHARGE[wt];
  const b = CHARGE[mut];
  if (a && b && a !== b) return `Charge reversal: ${wt} (${a}) in the wild type, ${mut} (${b}) in the mutant.`;
  if (!a && !b) return `No charge change: neither ${wt} nor ${mut} carries a charged side chain.`;
  if (a === b) return `No charge change: ${wt} and ${mut} carry the same charge (${a}).`;
  return `Charge change: ${wt} (${a ?? "uncharged"}) in the wild type, ${mut} (${b ?? "uncharged"}) in the mutant.`;
}

/* 3Dmol has no bundled types here; keep the surface we use explicit. */
type Atom = { resn: string; resi: number; chain: string; x: number; y: number; z: number; label?: unknown };
/** What a loaded structure reports about its ligands (non-water HETATM). */
type LigandInfo = {
  /** PDB chemical component IDs drawn, in file order. */
  ids: string[];
  /** Additives and ions present in the entry but left out (keys of NOT_SHOWN). */
  hidden: string[];
  /** Shortest atom-to-atom distance from the marker residue to any ligand atom. */
  nearest: { resn: string; angstrom: number } | null;
  /** Residue name at OTHER_PFDHPS_POSITION, if resolved. */
  otherPosition: string | null;
};
type Viewer = {
  setStyle: (sel: object, style: object) => void;
  addStyle: (sel: object, style: object) => void;
  selectedAtoms: (sel: object) => Atom[];
  setHoverable: (sel: object, on: boolean, enter: (a: Atom) => void, leave: (a: Atom) => void) => void;
  setClickable: (sel: object, on: boolean, cb: (a: Atom) => void) => void;
  addLabel: (text: string, opts: object) => unknown;
  removeLabel: (label: unknown) => void;
  zoomTo: (sel?: object, ms?: number) => void;
  render: () => void;
  resize: () => void;
  clear: () => void;
};
type ThreeDmol = {
  createViewer: (el: HTMLElement, cfg: object) => Viewer;
  download: (query: string, viewer: Viewer, opts: object, cb: () => void) => unknown;
};
declare global {
  interface Window {
    $3Dmol?: ThreeDmol;
  }
}

/** The pulled-back view: one whole copy of the enzyme (the entries hold two),
 *  so residue 540 and the ligands are large enough to find. */
const FULL_VIEW = (v: Viewer): object => (v.selectedAtoms({ chain: "A" }).length ? { chain: "A" } : {});

/** Loads the CDN script once; resolves with the global, rejects on failure. */
function load3Dmol(): Promise<ThreeDmol> {
  return new Promise((resolve, reject) => {
    if (window.$3Dmol) return resolve(window.$3Dmol);
    const done = () => (window.$3Dmol ? resolve(window.$3Dmol) : reject(new Error("3Dmol.js did not initialise")));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("3Dmol.js failed to load")));
      return;
    }
    const tag = document.createElement("script");
    tag.src = SCRIPT_SRC;
    tag.async = true;
    tag.addEventListener("load", done);
    tag.addEventListener("error", () => reject(new Error("3Dmol.js failed to load")));
    document.head.appendChild(tag);
  });
}

type Status = "loading" | "ready" | "failed";
type Site = { resi: number; wt: string; mut: string };

export function StructureViewer({
  onPick,
  pulseResi = null,
}: {
  /** Called when a residue is chosen in either viewer (click or button). */
  onPick?: (resi: number) => void;
  /** Residue to emphasise in both viewers, e.g. while a finding is hovered. */
  pulseResi?: number | null;
} = {}) {
  const boxes = useRef<(HTMLDivElement | null)[]>([null, null]);
  const viewers = useRef<(Viewer | null)[]>([null, null]);
  const [status, setStatus] = useState<Status[]>(["loading", "loading"]);
  /** Positions resolved in both structures, with the names 3Dmol reports. */
  const [sites, setSites] = useState<Site[]>([]);
  const [unresolved, setUnresolved] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [ligands, setLigands] = useState<(LigandInfo | null)[]>([null, null]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  /** Site colours per viewer, kept so residues can be re-styled later. */
  const siteColors = useRef<Record<number, string>[]>([{}, {}]);

  const animMs = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;

  /** Zoom BOTH viewers to the same residue; rotation is left alone. */
  const compare = useCallback((resi: number, chain?: string) => {
    for (const v of viewers.current) {
      if (!v) continue;
      const around = Array.from({ length: 9 }, (_, k) => resi - 4 + k);
      const c = chain && v.selectedAtoms({ resi, chain }).length ? chain : v.selectedAtoms({ resi })[0]?.chain;
      v.zoomTo(c ? { resi: around, chain: c } : { resi: around }, animMs());
    }
    setPicked(resi);
    onPickRef.current?.(resi);
  }, []);

  const reset = useCallback(() => {
    for (const v of viewers.current) v?.zoomTo(FULL_VIEW(v), animMs());
    setPicked(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const setOne = (i: number, s: Status) =>
      setStatus((prev) => {
        const next = [...prev];
        next[i] = s;
        return next;
      });
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || "#b0bdcb";

    load3Dmol()
      .then(async ($3Dmol) => {
        const loaded = await Promise.all(
          STRUCTURES.map(
            (s, i) =>
              new Promise<Viewer | null>((resolve) => {
                const el = boxes.current[i];
                if (!el) return resolve(null);
                let settled = false;
                const finish = (v: Viewer | null) => {
                  if (settled) return;
                  settled = true;
                  resolve(v);
                };
                try {
                  const v = $3Dmol.createViewer(el, { backgroundColor: "#050d17" });
                  const timer = window.setTimeout(() => finish(null), LOAD_TIMEOUT_MS);
                  const r = $3Dmol.download(`pdb:${s.pdb}`, v, {}, () => {
                    window.clearTimeout(timer);
                    finish(v.selectedAtoms({}).length ? v : null);
                  });
                  if (r && typeof (r as Promise<unknown>).catch === "function") {
                    (r as Promise<unknown>).catch(() => {
                      window.clearTimeout(timer);
                      finish(null);
                    });
                  }
                } catch {
                  finish(null);
                }
              }),
          ),
        );
        if (cancelled) return;
        loaded.forEach((v, i) => {
          viewers.current[i] = v;
          setOne(i, v ? "ready" : "failed");
        });

        // Base style: protein as cartoon; every non-water ligand as sticks, in
        // one distinct colour, labelled with its PDB chemical component ID.
        const ligandInfo: (LigandInfo | null)[] = loaded.map((v) => {
          if (!v) return null;
          v.setStyle({}, {});
          v.setStyle({ hetflag: false }, { cartoon: { color: CARTOON_COLOR } });
          const allHet = v.selectedAtoms({ hetflag: true }).filter((a) => a.resn !== "HOH" && a.resn !== "DOD");
          // Only the ligands that are drawn are labelled and measured against.
          const het = allHet.filter((a) => !(a.resn in NOT_SHOWN));
          const hidden = [...new Set(allHet.filter((a) => a.resn in NOT_SHOWN).map((a) => a.resn))];
          const ids = [...new Set(het.map((a) => a.resn))];
          if (ids.length) {
            v.setStyle(
              { hetflag: true, resn: ids },
              { stick: { color: LIGAND_COLOR, radius: 0.24 }, sphere: { color: LIGAND_COLOR, scale: 0.28 } },
            );
            const seen = new Set<string>();
            for (const a of het) {
              const key = `${a.resn}|${a.chain}|${a.resi}`;
              if (seen.has(key)) continue;
              seen.add(key);
              v.addLabel(a.resn, {
                position: { x: a.x, y: a.y, z: a.z },
                backgroundColor: "#06101b",
                backgroundOpacity: 0.8,
                fontColor: LIGAND_COLOR,
                fontSize: 12,
              });
            }
          }
          const markerResi = POSITIONS[POSITIONS.length - 1];
          let nearest: LigandInfo["nearest"] = null;
          for (const r of v.selectedAtoms({ resi: markerResi, hetflag: false })) {
            for (const h of het) {
              const d = Math.hypot(r.x - h.x, r.y - h.y, r.z - h.z);
              if (!nearest || d < nearest.angstrom) nearest = { resn: h.resn, angstrom: d };
            }
          }
          const other = v.selectedAtoms({ resi: OTHER_PFDHPS_POSITION, hetflag: false })[0];
          return { ids, hidden, nearest, otherPosition: other ? other.resn : null };
        });
        setLigands(ligandInfo);

        // A position is a site only if both structures have coordinates there.
        const [wt, mut] = loaded;
        const found: Site[] = [];
        const missing: number[] = [];
        if (wt && mut) {
          for (const resi of POSITIONS) {
            const a = wt.selectedAtoms({ resi })[0];
            const b = mut.selectedAtoms({ resi })[0];
            if (a && b) found.push({ resi, wt: a.resn, mut: b.resn });
            else missing.push(resi);
          }
        }

        loaded.forEach((v, i) => {
          if (!v) return;
          for (const site of found) {
            const isMarker = site.wt !== site.mut && Boolean(CHARGE[site.wt] || CHARGE[site.mut]);
            const c = isMarker ? color(STRUCTURES[i].siteColorVar) : color(CONTEXT_COLOR_VAR);
            siteColors.current[i][site.resi] = c;
            v.addStyle({ resi: site.resi }, { stick: { color: c, radius: 0.32 } });
          }
          const sel = { resi: found.map((s) => s.resi) };
          if (found.length) {
            v.setHoverable(
              sel,
              true,
              (atom) => {
                if (atom.label) return;
                atom.label = v.addLabel(`${atom.resn} ${atom.resi}`, {
                  position: atom,
                  backgroundColor: "#06101b",
                  backgroundOpacity: 0.9,
                  fontColor: "#f5f4ef",
                  fontSize: 13,
                });
              },
              (atom) => {
                if (!atom.label) return;
                v.removeLabel(atom.label);
                delete atom.label;
              },
            );
            v.setClickable(sel, true, (atom) => compare(atom.resi, atom.chain));
          }
          v.zoomTo(FULL_VIEW(v));
          v.render();
        });
        setSites(found);
        setUnresolved(wt && mut ? missing : []);
      })
      .catch(() => {
        if (!cancelled) setStatus(["failed", "failed"]);
      });

    const onResize = () => viewers.current.forEach((v) => v?.resize());
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      viewers.current.forEach((v) => v?.clear());
      viewers.current = [null, null];
    };
  }, [compare]);

  /* Pulse: emphasise one residue in BOTH viewers (thicker sticks plus a
   * translucent sphere). One blink when motion is allowed; a steady emphasis
   * under reduced motion. Restores the normal style when cleared. */
  useEffect(() => {
    const styleAll = (emphasis: number | null) => {
      viewers.current.forEach((v, i) => {
        if (!v) return;
        for (const [resiStr, c] of Object.entries(siteColors.current[i])) {
          const resi = Number(resiStr);
          const on = resi === emphasis;
          v.setStyle(
            { resi, hetflag: false },
            on
              ? { cartoon: { color: CARTOON_COLOR }, stick: { color: c, radius: 0.55 }, sphere: { color: c, radius: 1.5, opacity: 0.45 } }
              : { cartoon: { color: CARTOON_COLOR }, stick: { color: c, radius: 0.32 } },
          );
        }
        v.render();
      });
    };
    if (pulseResi === null) {
      styleAll(null);
      return;
    }
    styleAll(pulseResi);
    if (animMs() === 0) return () => styleAll(null);
    const off = window.setTimeout(() => styleAll(null), 260);
    const on = window.setTimeout(() => styleAll(pulseResi), 520);
    return () => {
      window.clearTimeout(off);
      window.clearTimeout(on);
      styleAll(null);
    };
  }, [pulseResi, sites]);

  const pickedSite = sites.find((s) => s.resi === picked) ?? null;
  const anyReady = status.some((s) => s === "ready");

  return (
    <section
      aria-label="Interactive crystal structures"
      className="ro-panel overflow-hidden p-5 sm:p-7"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-drug">
            Plate 02 · Interactive 3D Crystal Structures (3Dmol.js)
          </p>
          <p className="mt-1 text-sm text-muted">
            P. falciparum HPPK-DHPS coordinates streamed live from RCSB PDB · Chain A view
          </p>
        </div>

        {/* Keyboard-operable residue comparison controls */}
        {anyReady ? (
          <div className="flex flex-wrap items-center gap-2">
            {sites.map((s) => (
              <button
                key={s.resi}
                type="button"
                onClick={() => compare(s.resi, "A")}
                aria-pressed={picked === s.resi}
                className="rounded-[5px] border border-line-strong bg-[#081523] px-3.5 py-2 font-mono text-xs font-semibold text-fg transition-colors hover:border-drug hover:text-drug aria-pressed:border-drug aria-pressed:bg-drug-soft/50 aria-pressed:text-drug"
              >
                Compare residue {s.resi}
              </button>
            ))}
            <button
              type="button"
              onClick={reset}
              className="rounded-[5px] border border-line bg-transparent px-3.5 py-2 font-mono text-xs font-semibold text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              Reset view
            </button>
          </div>
        ) : null}
      </div>

      <figure>
        <div className="grid gap-5 md:grid-cols-2">
          {STRUCTURES.map((s, i) => (
            <div
              key={s.pdb}
              className="min-w-0 overflow-hidden rounded-[6px] border border-line bg-[#050d17]"
            >
              <div className="flex items-center justify-between border-b border-line bg-[#071320] px-4 py-2.5">
                <span className="text-sm font-semibold text-fg">{s.label}</span>
                <a
                  href={`https://www.rcsb.org/structure/${s.pdb}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-semibold text-drug underline decoration-drug/40 underline-offset-4 hover:decoration-drug"
                >
                  PDB {s.pdb}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>

              <div className="relative h-[300px] sm:h-[370px]">
                <div
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  className="absolute inset-0"
                  role="img"
                  aria-label={`Interactive 3D view of ${s.label}, PDB ${s.pdb}`}
                />
                {status[i] === "loading" ? (
                  <p className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-xs text-muted">
                    Loading PDB {s.pdb} from RCSB…
                  </p>
                ) : null}
                {status[i] === "failed" ? (
                  <p className="absolute inset-0 grid place-items-center bg-[#050d17] p-6 text-center text-sm text-body">
                    <span>
                      Couldn&rsquo;t load this structure.{" "}
                      <a
                        href={`https://www.rcsb.org/structure/${s.pdb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-drug underline underline-offset-4"
                      >
                        View PDB {s.pdb} at RCSB ↗
                      </a>
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Compare panel: every word about the residues comes from 3Dmol's report. */}
        <div aria-live="polite">
          {pickedSite ? (
            <div className="mt-5 rounded-[6px] border border-drug/40 border-l-2 border-l-drug bg-[#071422] px-5 py-4">
              <dl className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    Wild type (PDB {STRUCTURES[0].pdb})
                  </dt>
                  <dd className="mt-1 font-mono text-xl font-semibold text-signal">
                    {pickedSite.wt} {pickedSite.resi}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    Mutant (PDB {STRUCTURES[1].pdb})
                  </dt>
                  <dd className="mt-1 font-mono text-xl font-semibold text-drug">
                    {pickedSite.mut} {pickedSite.resi}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm font-medium text-fg sm:text-base">
                {changeNote(pickedSite.wt, pickedSite.mut)}
              </p>
              {pickedSite.resi === POSITIONS[POSITIONS.length - 1] ? (
                <div className="mt-4 border-t border-line pt-3.5">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    Shortest distance from residue {pickedSite.resi} to nearest bound ligand
                  </p>
                  <dl className="mt-2 grid gap-x-10 gap-y-2 sm:grid-cols-2">
                    {STRUCTURES.map((st, i) => {
                      const n = ligands[i]?.nearest;
                      return (
                        <div key={st.pdb}>
                          <dt className="sr-only">
                            {st.label} (PDB {st.pdb})
                          </dt>
                          <dd className="font-mono text-lg font-semibold tabular-nums text-fg">
                            {n ? `${n.angstrom.toFixed(1)} \u00c5` : "not measurable"}
                            {n ? (
                              <span className="ml-2 text-xs font-normal text-muted">
                                to {n.resn} ({st.pdb})
                              </span>
                            ) : null}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Atom to atom, measured from the deposited coordinates across both copies in each entry. Reported
                    as measured, without interpretation.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Figcaption + collapsible structural notes */}
        <figcaption className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
          Published crystal structures, loaded live from RCSB PDB. Drag to rotate, click a highlighted residue to
          compare. Rendered with 3Dmol.js.
          {ligands[0]?.nearest &&
          ligands[1]?.nearest &&
          Math.min(ligands[0].nearest.angstrom, ligands[1].nearest.angstrom) > CONTACT_LIMIT_ANGSTROM ? (
            <span className="mt-2 block text-body">
              At this distance ({ligands[0].nearest.angstrom.toFixed(1)} {"\u00c5"} and{" "}
              {ligands[1].nearest.angstrom.toFixed(1)} {"\u00c5"}), residue {POSITIONS[POSITIONS.length - 1]} is not
              in contact with the bound ligand in either structure.
            </span>
          ) : null}
        </figcaption>

        <details className="mt-4 max-w-3xl rounded-[var(--radius)] border border-line bg-[#06101c]/70">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-fg transition-colors hover:text-drug">
            Notes on these structures
          </summary>
          <div className="space-y-3 border-t border-line px-4 py-3.5 text-xs leading-relaxed text-muted sm:text-sm">
            {unresolved.length ? (
              <p>
                {unresolved.map((r) => `Position ${r}`).join(" and ")}{" "}
                {unresolved.length > 1 ? "have" : "has"} no coordinates in at least one of these structures, so{" "}
                {unresolved.length > 1 ? "they are" : "it is"} not highlighted.
              </p>
            ) : null}

            {ligands.some((l) => l?.ids.length) ? (
              <p>
                Bound molecules are drawn as sticks and labelled with their PDB chemical component IDs.{" "}
                {STRUCTURES.map((st, i) =>
                  ligands[i]?.ids.length ? `PDB ${st.pdb}: ${ligands[i]!.ids.join(", ")}.` : "",
                )
                  .filter(Boolean)
                  .join(" ")}
                {(() => {
                  const present = new Set(ligands.flatMap((l) => l?.hidden ?? []));
                  const hidden = Object.keys(NOT_SHOWN).filter((id) => present.has(id));
                  return hidden.length
                    ? ` Crystallisation additives and ions present in the entries (${hidden
                        .map((id) => NOT_SHOWN[id])
                        .join(", ")}) are not shown.`
                    : "";
                })()}
              </p>
            ) : null}

            <p>
              What these structures do not show: residues 436&ndash;444 are unmodelled in both, so A437G cannot be
              displayed.{" "}
              {ligands[0]?.otherPosition && ligands[1]?.otherPosition
                ? `Neither entry carries A581G: position ${OTHER_PFDHPS_POSITION} is ${ligands[0].otherPosition} in the wild type and ${ligands[1].otherPosition} in the mutant. `
                : ""}
              The dhfr positions are not part of these entries at all.
            </p>
          </div>
        </details>
      </figure>
    </section>
  );
}
