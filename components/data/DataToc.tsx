"use client";

import { useEffect, useState } from "react";

export type TocItem = readonly [id: string, label: string];

/**
 * Sticky architectural dossier index rail with live active-section tracking
 * on desktop and a compact horizontal jump strip on smaller screens.
 */
export function DataToc({ items }: { items: readonly TocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.[0] ?? "");

  useEffect(() => {
    const elements = items
      .map(([id]) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: 0 },
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <>
      {/* Compact mobile/tablet horizontal section bar */}
      <nav
        aria-label="On this page"
        className="mb-8 overflow-x-auto border-y border-line bg-[#06101c] py-2.5 lg:hidden"
      >
        <ol className="flex items-center gap-2 px-1">
          {items.map(([id, label], i) => {
            const active = id === activeId;
            return (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  aria-current={active ? "location" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-drug/60 bg-drug-soft/50 font-semibold text-drug"
                      : "border-transparent text-muted hover:text-fg"
                  }`}
                >
                  <span className="font-mono tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{label}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Sticky desktop dossier index */}
      <nav aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-28">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted">
            Dossier Index
          </p>
          <ol className="border-l border-line">
            {items.map(([id, label], i) => {
              const active = id === activeId;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    aria-current={active ? "location" : undefined}
                    className={`group -ml-px flex items-baseline gap-2.5 border-l-2 py-2 pl-3.5 text-xs leading-snug transition-colors ${
                      active
                        ? "border-drug font-semibold text-fg"
                        : "border-transparent text-muted hover:border-line-strong hover:text-fg"
                    }`}
                  >
                    <span
                      className={`font-mono tabular-nums ${
                        active
                          ? "text-drug"
                          : "text-muted/70 group-hover:text-drug"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{label}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}
