import Link from "next/link";

const CHAPTER_LINKS = [
  { href: "#scale", code: "01", label: "Global Scale" },
  { href: "#works", code: "02", label: "Drug Action" },
  { href: "#mutation", code: "03", label: "Resistance Mutation" },
  { href: "#gap", code: "04", label: "Surveillance Gap" },
  { href: "#modules", code: "05", label: "Platform Modules" },
] as const;

/** Hero: the problem in one sentence (wording from docs/SCIENCE.md). */
export function Hero({ learnHref }: { learnHref: string }) {
  return (
    <section
      aria-labelledby="hero-h"
      className="overview-top relative isolate flex min-h-[calc(100dvh-20px)] flex-col justify-between overflow-hidden border-b border-line"
    >
      <Backdrop />

      <div className="ro-wrap flex flex-1 items-center py-20 sm:py-28">
        <div className="max-w-4xl">
          <p className="ro-eyebrow mb-6">
            Overview — Malaria · Drug-Resistance Markers · Evidence
          </p>

          <h1
            id="hero-h"
            className="font-display-hero text-[clamp(2.35rem,5.3vw,4.85rem)] font-semibold leading-[1.03] text-fg text-balance"
          >
            A researcher tracking a resistance marker has no simple way to know
            when the evidence has{" "}
            <em className="not-italic text-drug">shifted enough to matter.</em>
          </h1>

          <p className="mt-7 max-w-[60ch] text-lg leading-relaxed text-body sm:text-xl text-pretty">
            Resistance Observatory watches the published evidence on one
            mutation that is linked to a malaria drug working less well, and
            shows when a new finding changes the picture.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Link
              href={learnHref}
              className="inline-flex items-center gap-3 rounded-[5px] bg-drug px-5 py-3 text-sm font-bold text-[#061c24] transition-all hover:-translate-y-0.5 hover:bg-[#9cf4e3]"
            >
              <span>Inspect pfdhps K540E</span>
              <span aria-hidden="true">→</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
              System Public Graph v2.1 · Pinned Snapshot
            </span>
          </div>
        </div>
      </div>

      {/* Architectural chapter index rail */}
      <div className="border-t border-line bg-[#040b14]/80 backdrop-blur-md">
        <div className="ro-wrap">
          <nav aria-label="Overview chapters">
            <ol className="grid grid-cols-2 divide-x divide-line sm:grid-cols-5">
              {CHAPTER_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="group flex items-center gap-2.5 px-3 py-3.5 text-xs transition-colors hover:bg-surface/60 sm:px-4"
                  >
                    <span className="font-mono font-semibold tabular-nums text-drug">
                      {item.code}
                    </span>
                    <span className="truncate font-medium text-muted group-hover:text-fg">
                      {item.label}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  );
}

/** Observatory reticle backdrop: precision concentric rings and slow sweep. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <svg
        viewBox="0 0 1200 1200"
        preserveAspectRatio="xMidYMid slice"
        className="absolute -right-[28%] top-1/2 h-[142%] w-[125%] -translate-y-1/2 opacity-75 md:-right-[18%]"
      >
        <defs>
          <radialGradient id="ro-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--drug)" stopOpacity="0.13" />
            <stop offset="68%" stopColor="var(--drug)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ro-sweep-g" x1="0" x2="1">
            <stop offset="0" stopColor="var(--drug)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--drug)" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        <circle cx="600" cy="600" r="560" fill="url(#ro-glow)" />
        <g className="ro-spin">
          <circle
            cx="600"
            cy="600"
            r="510"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1"
            strokeDasharray="2 14"
          />
          <circle
            cx="600"
            cy="600"
            r="380"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
          />
        </g>
        <g className="ro-spin-rev">
          <circle
            cx="600"
            cy="600"
            r="445"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="36 18 4 18"
          />
          <circle
            cx="600"
            cy="600"
            r="245"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1"
            strokeDasharray="1 10"
          />
        </g>
        <path
          className="ro-sweep"
          d="M600 600 L1110 600 A510 510 0 0 0 1042 345 Z"
          fill="url(#ro-sweep-g)"
        />
        <path
          d="M600 70v110M600 1020v110M70 600h110M1020 600h110"
          stroke="var(--line-strong)"
          strokeWidth="1"
        />
        <circle cx="600" cy="600" r="18" fill="none" stroke="var(--drug)" strokeOpacity="0.35" />
        <circle cx="600" cy="600" r="4.5" fill="var(--drug)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-transparent" />
    </div>
  );
}
