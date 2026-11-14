import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Two published crystal structures of P. falciparum DHPS, as ChimeraX renders
 * in public/structures/. Captions are fixed text: nothing here describes what
 * the structures show beyond them.
 *
 * Server component. If either image file is missing the whole figure is left
 * out, so the page never ships a broken image.
 */
const PANELS = [
  {
    file: "dhps-wt.png",
    label: "Wild type, sulfadoxine bound",
    pdb: "6JWX",
  },
  {
    file: "dhps-mutant.png",
    label: "A437G/K540E double mutant",
    pdb: "6KCL",
  },
] as const;

const CAPTION =
  "Published crystal structures of the enzyme this marker sits in. Highlighted residues mark the positions that differ between them. Rendered in UCSF ChimeraX.";

export function StructureFigure() {
  const dir = join(process.cwd(), "public", "structures");
  if (!PANELS.every((p) => existsSync(join(dir, p.file)))) return null;

  return (
    <section
      aria-label="Published crystal structures"
      className="ro-panel mt-6 overflow-hidden p-5 sm:p-7"
    >
      <div className="mb-4 border-b border-line pb-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
          Static Reference Renders · UCSF ChimeraX
        </span>
      </div>
      <figure>
        <div className="grid gap-5 md:grid-cols-2">
          {PANELS.map((p) => (
            <div key={p.pdb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/structures/${p.file}`}
                alt={`${p.label} — PDB ${p.pdb}. ChimeraX render.`}
                loading="lazy"
                className="h-auto w-full rounded-[6px] border border-line bg-[#050d17]"
              />
              <p className="mt-2.5 text-sm font-semibold text-fg">
                {p.label} &mdash;{" "}
                <a
                  href={`https://www.rcsb.org/structure/${p.pdb}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-drug underline decoration-drug/40 underline-offset-4 hover:decoration-drug"
                >
                  PDB {p.pdb}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </div>
          ))}
        </div>
        <figcaption className="mt-4 max-w-3xl text-xs leading-relaxed text-muted sm:text-sm">
          {CAPTION}
        </figcaption>
      </figure>
    </section>
  );
}
