"use client";

import Link from "next/link";
import { useSelection } from "@/lib/selection";
import type { Marker } from "@/content/markers";

/**
 * Primary module handoff actions (docs/LEARN.md). Exactly two crisp links:
 * Map (/forecast) and Alert (/alert), carrying markerId in the URL selection.
 */
export function ActionButtons({ marker }: { marker: Marker }) {
  const { hrefWithSelection } = useSelection();
  const withMarker = { markerId: marker.id };
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={hrefWithSelection("/forecast", withMarker)}
        className="group flex items-center justify-between gap-4 rounded-[6px] bg-drug px-5 py-4 text-[#061821] transition-all hover:-translate-y-0.5 hover:bg-[#9cf4e3]"
      >
        <span>
          <span className="block font-display text-base font-bold sm:text-lg">
            Explore Historical Map
          </span>
          <span className="block font-mono text-xs opacity-80">
            Map · {marker.gene} {marker.alteration} observed over time
          </span>
        </span>
        <span
          aria-hidden="true"
          className="font-mono text-lg font-bold transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      </Link>

      <Link
        href={hrefWithSelection("/alert", withMarker)}
        className="group flex items-center justify-between gap-4 rounded-[6px] border border-line-strong bg-[#081523] px-5 py-4 text-fg transition-all hover:-translate-y-0.5 hover:border-drug"
      >
        <span>
          <span className="block font-display text-base font-semibold sm:text-lg">
            Inspect Evidence Alerts
          </span>
          <span className="block font-mono text-xs text-muted">
            Alert · {marker.gene} {marker.alteration} ({marker.drug}) pre-filled
          </span>
        </span>
        <span
          aria-hidden="true"
          className="font-mono text-lg text-drug transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      </Link>
    </div>
  );
}
