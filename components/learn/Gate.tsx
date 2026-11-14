import type { ReactNode } from "react";

/** Rendered in place of content the science lead has not reviewed. */
export function Held({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border-2 border-dashed border-gap/60 bg-gap-soft/40 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-gap">Held · awaiting science-lead review</p>
      <p className="mt-2 font-semibold">{what}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

/** Loud tag on unreviewed content shown in preview mode. */
export function DraftTag() {
  return (
    <span className="ml-2 inline-flex items-center rounded border border-dashed border-gap px-1.5 py-0.5 align-middle font-mono text-[0.65rem] font-bold uppercase tracking-widest text-gap">
      Draft · not reviewed
    </span>
  );
}
