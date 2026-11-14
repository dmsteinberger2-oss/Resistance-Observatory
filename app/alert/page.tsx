import type { Metadata } from "next";
import { loadPack, toClientPack } from "@/lib/alert/loadPack";
import { AlertTab } from "@/components/alert/AlertTab";

export const metadata: Metadata = {
  title: "Alert · Evidence Surveillance",
  description:
    "Replay real molecular surveillance, PubMed literature, and System Public Graph provenance for pfdhps K540E and sulfadoxine-pyrimethamine (SP).",
};

export default async function AlertPage() {
  const pack = await loadPack();
  if (!pack) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Evidence Surveillance
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          The K540E data pack is not installed
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          This page reads <code className="font-mono text-xs text-fg">k540e-data-pack/</code> at
          the repository root (MalariaGEN Pf8 genome counts, PubMed papers, System Public Graph
          findings, and WHO thresholds). No number here is ever invented.
        </p>
      </div>
    );
  }

  return (
    <div className="learn-top min-h-[calc(100dvh-76px)]">
      <AlertTab pack={toClientPack(pack)} />
    </div>
  );
}
