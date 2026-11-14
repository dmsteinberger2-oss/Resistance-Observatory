import { StatFigure } from "@/components/StatFigure";
import { Reveal } from "@/components/Reveal";
import {
  PLACEHOLDER_ANNUAL_CASES,
  PLACEHOLDER_ANNUAL_DEATHS,
  PLACEHOLDER_SHARE_AFRICA,
  PLACEHOLDER_SHARE_UNDER_5,
} from "@/lib/stats";

/** Scale. Every figure comes from lib/stats.ts; unsourced ones show a token. */
export function Scale() {
  return (
    <section id="scale" aria-labelledby="scale-h" className="border-y border-line bg-surface py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">The scale</p>
          <h2 id="scale-h" className="max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
            Malaria, every year.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-x-12 gap-y-16 md:grid-cols-2">
          <Reveal>
            <StatFigure stat={PLACEHOLDER_ANNUAL_DEATHS} name="PLACEHOLDER_ANNUAL_DEATHS" />
          </Reveal>
          <Reveal delay={120}>
            <StatFigure stat={PLACEHOLDER_ANNUAL_CASES} name="PLACEHOLDER_ANNUAL_CASES" />
          </Reveal>
        </div>
        <Reveal className="mt-20">
          <h3 className="font-display text-2xl font-semibold">Who dies, and where</h3>
        </Reveal>
        <div className="mt-8 grid gap-x-12 gap-y-16 md:grid-cols-2">
          <Reveal>
            <StatFigure stat={PLACEHOLDER_SHARE_UNDER_5} name="PLACEHOLDER_SHARE_UNDER_5" />
          </Reveal>
          <Reveal delay={120}>
            <StatFigure stat={PLACEHOLDER_SHARE_AFRICA} name="PLACEHOLDER_SHARE_AFRICA" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
