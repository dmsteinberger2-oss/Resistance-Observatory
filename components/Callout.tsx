import type { ReactNode } from "react";

type Kind = "note" | "limit" | "pending";

const STYLES: Record<Kind, { box: string; accent: string; label: string; glyph: string }> = {
  note: {
    box: "border-line border-l-drug bg-drug-soft/25",
    accent: "text-drug border-drug/50",
    label: "Note",
    glyph: "i",
  },
  limit: {
    box: "border-line border-l-signal bg-signal-soft/25",
    accent: "text-signal border-signal/50",
    label: "Boundary",
    glyph: "!",
  },
  pending: {
    box: "border-gap/50 border-l-gap bg-gap-soft/30 border-dashed",
    accent: "text-gap border-gap/50",
    label: "Pending",
    glyph: "…",
  },
};

export function Callout({
  kind = "note",
  title,
  children,
  className = "",
}: {
  kind?: Kind;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const s = STYLES[kind];
  return (
    <aside
      role="note"
      className={`flex gap-3.5 rounded-[var(--radius)] border border-l-2 px-5 py-4 ${s.box} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-xs font-bold ${s.accent}`}
      >
        {s.glyph}
      </span>
      <div className="min-w-0 text-sm leading-relaxed">
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.15em] text-fg">
          <span className="sr-only">{s.label}: </span>
          {title ?? s.label}
        </p>
        <div className="text-body">{children}</div>
      </div>
    </aside>
  );
}
