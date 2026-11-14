import type { GenomeYear } from "@/lib/forecast/types";

/** One row per sampled year; gaps in sampling get a divider row. Real table. */
export function GenomeYears({ years }: { years: GenomeYear[] }) {
  const rows: React.ReactNode[] = [];
  let prev: number | null = null;
  for (const y of years) {
    if (prev !== null && y.year > prev + 1) {
      const a = prev + 1;
      const b = y.year - 1;
      rows.push(
        <tr key={`gap-${a}`}>
          <td colSpan={3} className="py-1 text-center text-[0.72rem] italic text-muted">
            <span className="border-y border-dashed border-line-strong px-2">
              not sampled {a === b ? a : `${a}–${b}`}
            </span>
          </td>
        </tr>,
      );
    }
    const frac = y.tested > 0 ? Math.min(1, y.withE / y.tested) : 0;
    rows.push(
      <tr key={y.year}>
        <th scope="row" className="py-1 pr-2 text-left text-xs font-normal tabular-nums text-fg">
          {y.year}
        </th>
        <td className="w-full py-1 pr-2">
          <div
            className="h-2.5 w-full rounded-[2px] border border-line-strong"
            aria-hidden
          >
            {y.withE > 0 && (
              <div className="h-full bg-drug" style={{ width: `${Math.max(frac * 100, 2)}%` }} />
            )}
          </div>
        </td>
        <td className="whitespace-nowrap py-1 text-right text-xs tabular-nums text-fg">
          {y.withE} / {y.tested}
        </td>
      </tr>,
    );
    prev = y.year;
  }
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">
        Samples carrying K540E out of samples tested, by collection year. Years without
        samples are listed as not sampled.
      </caption>
      <thead>
        <tr className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">
          <th scope="col" className="pb-1 text-left font-normal">Year</th>
          <th scope="col" className="pb-1 text-left font-normal">Share carrying K540E</th>
          <th scope="col" className="pb-1 text-right font-normal">K540E / tested</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}
