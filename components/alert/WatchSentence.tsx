"use client";

import type { Trigger, Watch, WhoBasis } from "@/lib/alert/derive";
import { thresholdBasis } from "@/lib/alert/copy";
import type { MarkerDef } from "@/lib/alert/pack";
import { CountryPicker, type CountryRow } from "./CountryPicker";
import css from "./alert.module.css";

const WATCH_TRIGGER_LABELS: Record<Trigger, string> = {
  who_band: "crosses a WHO resistance band (40% / 60%)",
  rise: "crosses at or above",
  fall: "crosses below",
  first_detection: "is first detected",
  very_high_combo: "reaches WHO “very high” combo (+A581G ≥5%)",
  change: "shifts by ≥20 percentage points",
};

export function WatchSentence({
  marker,
  watch,
  basis,
  pickerRows,
  firedTotal,
  onAreaChange,
  onTriggerChange,
  onLevelChange,
}: {
  marker: MarkerDef;
  watch: Watch;
  basis: WhoBasis;
  pickerRows: CountryRow[];
  firedTotal: number;
  onAreaChange: (iso3: string) => void;
  onTriggerChange: (t: Trigger) => void;
  onLevelChange: (level: string | null) => void;
}) {
  const isCrosses = watch.trigger === "rise" || watch.trigger === "fall";
  const tb = thresholdBasis(watch, basis);

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-2 text-sm text-[#c4cdd6]">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Watch</span>
      <CountryPicker rows={pickerRows} value={watch.area} minN={watch.minN} onChange={onAreaChange} />
      <span className="text-muted">when</span>
      <span className="font-medium text-fg">{marker.mutation}</span>
      <span className={css.watchSelectWrap}>
        <span aria-hidden className="truncate text-sm">
          {WATCH_TRIGGER_LABELS[watch.trigger]}
        </span>
        <span className="text-xs text-drug" aria-hidden>
          ▾
        </span>
        <select
          aria-label="Watch trigger rule"
          className={css.watchSelect}
          value={watch.trigger}
          onChange={(e) => onTriggerChange(e.target.value as Trigger)}
        >
          {(Object.keys(WATCH_TRIGGER_LABELS) as Trigger[]).map((t) => (
            <option key={t} value={t}>
              {WATCH_TRIGGER_LABELS[t]}
            </option>
          ))}
        </select>
      </span>

      {isCrosses ? (
        <span className="inline-flex items-center gap-1">
          <input
            aria-label="Prevalence cutoff, percent"
            type="number"
            min={0}
            max={100}
            className={css.watchNumber}
            value={watch.level}
            onChange={(e) => onLevelChange(e.target.value === "" ? null : e.target.value)}
          />
          <span className="font-mono text-sm font-semibold text-signal">%</span>
        </span>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2 lg:ml-1">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs ${
            tb.published
              ? "border-drug/50 bg-drug-soft/70 text-drug"
              : "border-[#ffffff24] bg-[#050d17]/70 text-muted"
          }`}
          title={tb.text}
        >
          {tb.published ? "WHO cutoff" : "Preset rule"} ·{" "}
          <span className="ml-1 tabular-nums">n≥{watch.minN}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${
            firedTotal > 0
              ? "border-signal/60 bg-signal-soft/70 text-signal"
              : "border-[#ffffff24] bg-[#050d17]/70 text-muted"
          }`}
          aria-live="polite"
        >
          <span>{firedTotal}</span> fired
        </span>
      </div>
    </div>
  );
}
