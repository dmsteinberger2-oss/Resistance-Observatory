"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelection } from "@/lib/selection";

export const NAV_ITEMS = [
  // The story is a standalone HTML page outside the app shell.
  { href: "/story.html", label: "Home" },
  { href: "/overview", label: "Overview" },
  { href: "/learn", label: "Learn" },
  { href: "/forecast", label: "Forecast" },
  { href: "/alert", label: "Alert" },
  { href: "/data", label: "Data" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const { hrefWithSelection, markerId } = useSelection();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6"
      >
        {/* Plain anchor: the story is a static file, so this is a full page load. */}
        <a
          href="/story.html"
          className="mr-auto flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
        >
          <Mark />
          <span>
            Resistance <span className="text-muted font-normal">Observatory</span>
          </span>
        </a>
        <ul className="flex items-center gap-0.5 overflow-x-auto text-sm">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const cls = [
              "relative block rounded-full px-3 py-1.5 transition-colors",
              active ? "bg-fg text-bg font-medium" : "text-muted hover:text-fg hover:bg-surface-2",
            ].join(" ");
            if (item.href.endsWith(".html")) {
              return (
                <li key={item.href}>
                  <a href={item.href} className={cls}>
                    {item.label}
                  </a>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link
                  href={hrefWithSelection(item.href)}
                  aria-current={active ? "page" : undefined}
                  className={cls}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {markerId ? (
          <span
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-xs text-muted"
            title="Current marker selection (carried across tabs via the URL)"
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-signal" />
            {markerId}
          </span>
        ) : null}
      </nav>
    </header>
  );
}

function Mark() {
  // A lens: two concentric rings and a crosshair.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-signal">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 0v5M12 19v5M0 12h5M19 12h5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
