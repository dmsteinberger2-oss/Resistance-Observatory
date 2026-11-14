import type { TimelineLane } from "@/content/data";

/**
 * Horizontal timeline: drug introduced (circle) vs reduced efficacy / partial
 * resistance first reported (triangle). Shape + label, never colour alone.
 *
 * Until every year is sourced in lib/stats.ts, positions are schematic and
 * the timeline says so — it must not imply dates or order it doesn't have.
 */
export function Timeline({ lanes }: { lanes: TimelineLane[] }) {
  const years = lanes.flatMap((l) => [l.introduced.stat.value, l.reported.stat.value]);
  const sourced = years.every((y) => typeof y === "number");
  const nums = years.filter((y): y is number => typeof y === "number");
  const min = sourced ? Math.min(...nums) : 0;
  const max = sourced ? Math.max(...nums) : 1;
  const pad = sourced ? Math.max(2, (max - min) * 0.06) : 0;
  const pos = (y: number | string | null, fallback: number) =>
    sourced && typeof y === "number" ? ((y - (min - pad)) / (max + pad - (min - pad))) * 100 : fallback;

  const ordered = sourced
    ? [...lanes].sort((a, b) => (a.introduced.stat.value as number) - (b.introduced.stat.value as number))
    : lanes;

  return (
    <figure className="my-10">
      {!sourced ? (
        <p className="mb-6 rounded-lg border-2 border-dashed border-gap/60 bg-gap-soft/50 px-4 py-3 text-sm text-gap">
          <strong>Schematic until sourced.</strong> Years are unsourced placeholders, so positions are not to
          scale and lanes are alphabetical, not chronological.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <ol className="space-y-3">
            {ordered.map((lane) => {
              const a = pos(lane.introduced.stat.value, 14);
              const b = pos(lane.reported.stat.value, 66);
              return (
                <li key={lane.drug} className="grid grid-cols-[13rem_1fr] items-center gap-4 rounded-xl border border-line bg-surface px-4 py-5">
                  <span className="font-display text-lg font-semibold leading-tight">{lane.drug}</span>
                  <div className="relative h-24">
                    <div className="absolute inset-x-0 top-6 border-t border-line" />
                    <div
                      className="absolute top-6 h-0 border-t-[3px] border-dashed border-signal/60"
                      style={{ left: `${a}%`, width: `${Math.max(0, b - a)}%` }}
                    />
                    <Point left={a} shape="circle" title="introduced into wide use" stat={lane.introduced.stat} name={lane.introduced.name} />
                    <Point left={b} shape="triangle" title={lane.reported.label} stat={lane.reported.stat} name={lane.reported.name} />
                  </div>
                </li>
              );
            })}
          </ol>
          {sourced ? (
            <div className="ml-[14rem] mt-2 flex justify-between font-mono text-xs text-muted">
              <span>{Math.round(min - pad)}</span>
              <span>{Math.round(max + pad)}</span>
            </div>
          ) : null}
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-6 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="6" fill="var(--drug)" /></svg>
          Drug introduced into wide use
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" aria-hidden><path d="M7 1 13 13H1Z" fill="var(--signal)" /></svg>
          Reduced efficacy (artemisinin: partial resistance) first reported
        </span>
      </figcaption>
    </figure>
  );
}

function Point({
  left,
  shape,
  title,
  stat,
  name,
}: {
  left: number;
  shape: "circle" | "triangle";
  title: string;
  stat: { value: number | string | null };
  name: string;
}) {
  return (
    <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center text-center" style={{ left: `${left}%` }}>
      <svg width="22" height="22" viewBox="0 0 22 22" className="mt-[13px] -translate-y-1/2" aria-hidden>
        {shape === "circle" ? (
          <circle cx="11" cy="11" r="9" fill="var(--drug)" stroke="var(--bg)" strokeWidth="2" />
        ) : (
          <path d="M11 2 20 19H2Z" fill="var(--signal)" stroke="var(--bg)" strokeWidth="2" />
        )}
      </svg>
      <span className="mt-1 whitespace-nowrap text-xs text-muted">{title}</span>
      {stat.value === null ? (
        <span className="placeholder-token mt-1 !text-[0.62rem]" title={`Unsourced — fill ${name} in lib/stats.ts`}>
          year · source pending
        </span>
      ) : (
        <span className="mt-0.5 font-display text-lg font-semibold tabular-nums">{String(stat.value)}</span>
      )}
    </div>
  );
}
