"use client";

/**
 * Forecast URL state.
 *   country=<ISO3>        selected country (unknown codes are ignored)
 *   range=<from>-<to>     the app's shared time range; the as-of year is the
 *                         UPPER bound, clamped. Absent -> MAX_YEAR.
 * Writes always start from the current params so unknown params survive, and
 * one user action issues exactly one router.replace.
 */
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PARAM, parseTimeRange } from "@/lib/selection";
import { MAX_YEAR, MIN_YEAR, clampYear } from "./data";
import { COUNTRY_BY_ISO3 } from "./geo";

export const COUNTRY_PARAM = "country";

export function parseCountry(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return COUNTRY_BY_ISO3[code] ? code : null;
}

export function parseAsOfYear(raw: string | null): number {
  const r = parseTimeRange(raw);
  return clampYear(r ? r[1] : MAX_YEAR);
}

export function rangeFor(year: number): string {
  return `${MIN_YEAR}-${clampYear(year)}`;
}

export function useForecastUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const country = useMemo(() => parseCountry(searchParams.get(COUNTRY_PARAM)), [searchParams]);
  const asOfYear = useMemo(
    () => parseAsOfYear(searchParams.get(PARAM.timeRange)),
    [searchParams],
  );

  const write = useCallback(
    (patch: Record<string, string | null>) => {
      // Read the live URL so two quick actions do not clobber each other.
      const live =
        typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : qs;
      const p = new URLSearchParams(live);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) p.delete(k);
        else p.set(k, v);
      }
      const next = p.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, qs, router],
  );

  const setCountry = useCallback(
    (iso3: string | null) => write({ [COUNTRY_PARAM]: iso3 ? iso3.toUpperCase() : null }),
    [write],
  );
  const setAsOfYear = useCallback(
    (year: number) => write({ [PARAM.timeRange]: rangeFor(year) }),
    [write],
  );

  const hrefFor = useCallback(
    (target: string, extra: Record<string, string> = {}) => {
      const p = new URLSearchParams();
      if (country) p.set(COUNTRY_PARAM, country);
      p.set(PARAM.timeRange, rangeFor(asOfYear));
      const marker = searchParams.get(PARAM.markerId);
      if (marker) p.set(PARAM.markerId, marker);
      for (const [k, v] of Object.entries(extra)) p.set(k, v);
      return `${target}?${p.toString()}`;
    },
    [asOfYear, country, searchParams],
  );

  return { country, asOfYear, setCountry, setAsOfYear, hrefFor };
}
