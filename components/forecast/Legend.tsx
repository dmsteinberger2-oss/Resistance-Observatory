import {
  HATCH_BG,
  HATCH_LINE,
  LAND_NOT_SAMPLED,
  DETECTED_DOT,
  STATE_LEGEND_TEXT,
  rampColor,
  rampGradientCss,
} from "@/lib/forecast/encoding";

function Swatch({ kind }: { kind: "not_sampled" | "tested_not_detected" | "detected" }) {
  const id = `fc-leg-hatch-${kind}`;
  return (
    <svg width="40" height="22" viewBox="0 0 40 22" aria-hidden className="shrink-0">
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill={HATCH_BG} />
          <line x1="0" y1="0" x2="0" y2="5" stroke={HATCH_LINE} strokeWidth="1.4" />
        </pattern>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="26"
        height="21"
        rx="3"
        fill={
          kind === "not_sampled"
            ? LAND_NOT_SAMPLED
            : kind === "tested_not_detected"
              ? `url(#${id})`
              : rampColor(0.6)
        }
        stroke="#2f607f"
        strokeWidth="1"
      />
      {kind === "tested_not_detected" ? (
        <circle cx="33" cy="11" r="4.5" fill="#050d17" stroke="#f5f4ef" strokeWidth="1.6" />
      ) : null}
      {kind === "detected" ? (
        <circle cx="33" cy="11" r="5" fill={DETECTED_DOT} stroke="#050d17" strokeWidth="1.75" />
      ) : null}
    </svg>
  );
}

export function Legend({ asOfYear, className }: { asOfYear: number; className?: string }) {
  return (
    <section
      aria-label={`Legend: K540E in genome data as of ${asOfYear}`}
      className={`fc-card w-[320px] p-3.5 text-[12px] leading-snug ${className ?? ""}`}
    >
      <h2 className="fc-label mb-2.5">K540E in genome data · as of {asOfYear}</h2>
      <ul className="space-y-2">
        <li className="flex items-center gap-2.5">
          <Swatch kind="not_sampled" />
          <span>{STATE_LEGEND_TEXT.not_sampled}</span>
        </li>
        <li className="flex items-center gap-2.5">
          <Swatch kind="tested_not_detected" />
          <span>{STATE_LEGEND_TEXT.tested_not_detected}</span>
        </li>
        <li>
          <div className="flex items-center gap-2.5">
            <Swatch kind="detected" />
            <span>{STATE_LEGEND_TEXT.detected}</span>
          </div>
          <div className="mt-2 pl-0.5">
            <div
              className="h-2.5 w-full rounded-[3px] border border-line"
              style={{ background: rampGradientCss() }}
              aria-hidden
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted tabular-nums">
              <span>0%</span>
              <span>100%</span>
            </div>
            <p className="text-[11px] text-muted">
              share of samples carrying K540E in the latest sampled year
            </p>
          </div>
        </li>
      </ul>
      <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-[11px] text-muted">
        <p>Observed history only. No projections or future scenarios.</p>
        <p>
          Colours: genome data, MalariaGEN Pf8 (CC BY 4.0), by sample collection year. Country
          shapes: Natural Earth.
        </p>
      </div>
    </section>
  );
}
