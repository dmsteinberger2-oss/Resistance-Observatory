"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSelection } from "@/lib/selection";
import { DEMO_MARKER_ID, getMarker } from "@/content/markers";

export const NAV_ITEMS = [
  // Standalone scrollytelling introduction outside the Next.js shell
  { href: "/story.html", label: "Home" },
  { href: "/overview", label: "Overview" },
  { href: "/learn", label: "Learn" },
  { href: "/forecast", label: "Map" },
  { href: "/alert", label: "Alert" },
  { href: "/data", label: "Data" },
] as const;

/**
 * Architectural top navigation shared across Overview, Learn, Map, Alert, and Data.
 * Matches public/story.html's frosted-glass hairline bar while preserving shared
 * URL selection parameters across every tab transition.
 */
export function SiteNav() {
  const pathname = usePathname();
  const { hrefWithSelection, markerId } = useSelection();
  const [on, setOn] = useState(false);

  useEffect(() => {
    const read = () => setOn(window.scrollY > 24);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  const activeMarker = getMarker(markerId ?? DEMO_MARKER_ID);
  const chipLabel =
    activeMarker.id === DEMO_MARKER_ID
      ? `${activeMarker.gene} ${activeMarker.alteration} · SP`
      : `${activeMarker.gene} ${activeMarker.alteration} · ${activeMarker.drug}`;

  return (
    <header>
      <nav aria-label="Primary" className="ro-nav" data-on={on ? "true" : "false"}>
        <a href="/story.html" className="ro-nav-brand">
          <span className="ro-nav-symbol" aria-hidden="true">
            ⌁
          </span>
          <span className="ro-nav-word">
            Resistance <i>Observatory</i>
          </span>
        </a>

        <div className="ro-nav-links">
          {NAV_ITEMS.map((item) => {
            const active = !item.href.endsWith(".html") && pathname.startsWith(item.href);
            if (item.href.endsWith(".html")) {
              return (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              );
            }
            return (
              <Link
                key={item.href}
                href={hrefWithSelection(item.href)}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            href={hrefWithSelection("/learn", { markerId: markerId ?? DEMO_MARKER_ID })}
            className="ro-nav-end"
            title={`Active specimen: ${activeMarker.gene} ${activeMarker.alteration} (${activeMarker.drug}) — carried across tabs via URL`}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-signal"
            />
            <span>{chipLabel}</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
