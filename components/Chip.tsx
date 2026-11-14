import type { ReactNode } from "react";

type ChipProps = {
  children: ReactNode;
  tone?: "neutral" | "drug" | "signal" | "gap";
  /** Optional leading glyph so colour is never the only encoding. */
  glyph?: "dot" | "square" | "triangle" | "none";
  title?: string;
  className?: string;
};

const TONES = {
  neutral: "border-line bg-surface/80 text-muted",
  drug: "border-drug/40 bg-drug-soft/45 text-drug",
  signal: "border-signal/40 bg-signal-soft/45 text-signal",
  gap: "border-gap/45 bg-gap-soft/45 text-gap",
} as const;

export function Chip({
  children,
  tone = "neutral",
  glyph = "none",
  title,
  className = "",
}: ChipProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium tracking-tight ${TONES[tone]} ${className}`}
    >
      {glyph !== "none" ? <Glyph kind={glyph} /> : null}
      {children}
    </span>
  );
}

function Glyph({ kind }: { kind: "dot" | "square" | "triangle" }) {
  return (
    <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true" className="shrink-0">
      {kind === "dot" && <circle cx="4" cy="4" r="3.5" fill="currentColor" />}
      {kind === "square" && <rect x="0.5" y="0.5" width="7" height="7" fill="currentColor" />}
      {kind === "triangle" && <path d="M4 0.5 7.5 7.5H0.5Z" fill="currentColor" />}
    </svg>
  );
}
