import type { ReactNode } from "react";

export function PullQuote({ children, cite }: { children: ReactNode; cite?: string }) {
  return (
    <figure className="my-10 rounded-r-[var(--radius)] border-y border-r border-line border-l-2 border-l-drug bg-[#081624]/85 px-6 py-6 sm:px-8">
      {cite ? (
        <figcaption className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-drug">
          {cite}
        </figcaption>
      ) : null}
      <blockquote className="font-display text-[clamp(1.25rem,2.1vw,1.7rem)] font-medium leading-[1.3] text-fg text-balance">
        <span aria-hidden="true" className="mr-1 text-drug">
          &ldquo;
        </span>
        {children}
        <span aria-hidden="true" className="ml-0.5 text-drug">
          &rdquo;
        </span>
      </blockquote>
    </figure>
  );
}
