"use client";

/**
 * Forecast URL state.
 *   area=<ISO3>           selected country (the shell's shared param). A legacy
 *                         `country=<ISO3>` (the Alert tab's back-link) is read
 *                         when present and replaced by `area` on first write.
 *   range=<from>-<to>     the app's shared time range; the as-of year is the
 *                         UPPER bound, clamped. Absent -> MAX_YEAR.
 * Writes start from the live params so unknown params (marker, ...) survive.
 * The as-of year lives in local state so the map responds instantly; it is
 * synced to the URL with a 250 ms debounce (one replace after the user stops).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AREA_PARAM, PARAM, parseTimeRange } from "@/lib/selection";
import { MARKER_ID, MAX_YEAR, MIN_YEAR, clampYear } from "./data";
import { COUNTRY_BY_ISO3 } from "./geo";

export const LEGACY_COUNTRY_PARAM = "country";
/** `layer=papers` shows the "Papers and the Graph" layer; absent = genome. */
export const LAYER_PARAM = "layer";
export type ForecastLayer = "genome" | "papers";
const YEAR_DEBOUNCE_MS = 250;
/** A change within this window of the previous one is part of a run (Play, held key). */
const YEAR_RUN_WINDOW_MS = 1500;
/** During a run, wait past the slowest Play step (1.2 s under reduced motion). */
const YEAR_RUN_DEBOUNCE_MS = 1300;

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

  const country = useMemo(
    () =>
      parseCountry(searchParams.get(LEGACY_COUNTRY_PARAM)) ??
      parseCountry(searchParams.get(AREA_PARAM)),
    [searchParams],
  );
  const layer: ForecastLayer = searchParams.get(LAYER_PARAM) === "papers" ? "papers" : "genome";
  const urlYear = useMemo(() => parseAsOfYear(searchParams.get(PARAM.timeRange)), [searchParams]);

  const [asOfYear, setLocalYear] = useState(urlYear);
  const pendingYearRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastYearCallRef = useRef(0);

  // Follow the URL when it changes from outside (back button, a pasted link).
  useEffect(() => {
    if (pendingYearRef.current === null) setLocalYear(urlYear);
  }, [urlYear]);

  const write = useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams(window.location.search);
      // Fold in a pending year so one action issues exactly one replace.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (pendingYearRef.current !== null && !(PARAM.timeRange in patch)) {
        p.set(PARAM.timeRange, rangeFor(pendingYearRef.current));
      }
      pendingYearRef.current = null;
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) p.delete(k);
        else p.set(k, v);
      }
      const next = p.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // A legacy ?country= link: normalise to ?area= once, so the shell carries it.
  const legacy = searchParams.get(LEGACY_COUNTRY_PARAM);
  useEffect(() => {
    if (legacy === null) return;
    const code = parseCountry(legacy);
    write({ [AREA_PARAM]: code ?? searchParams.get(AREA_PARAM), [LEGACY_COUNTRY_PARAM]: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacy]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const setCountry = useCallback(
    (iso3: string | null) =>
      write({ [AREA_PARAM]: iso3 ? iso3.toUpperCase() : null, [LEGACY_COUNTRY_PARAM]: null }),
    [write],
  );

  const setLayer = useCallback(
    (next: ForecastLayer) => write({ [LAYER_PARAM]: next === "papers" ? "papers" : null }),
    [write],
  );

  const setAsOfYear = useCallback(
    (year: number) => {
      const y = clampYear(year);
      setLocalYear(y);
      pendingYearRef.current = y;
      const now = Date.now();
      const inRun = now - lastYearCallRef.current < YEAR_RUN_WINDOW_MS;
      lastYearCallRef.current = now;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingYearRef.current;
        pendingYearRef.current = null;
        if (pending === null) return;
        const p = new URLSearchParams(window.location.search);
        p.set(PARAM.timeRange, rangeFor(pending));
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      }, inRun ? YEAR_RUN_DEBOUNCE_MS : YEAR_DEBOUNCE_MS);
    },
    [pathname, router],
  );

  const hrefForAlert = useCallback(
    (alertId: string) =>
      `/alert?${new URLSearchParams({ alert: alertId, [PARAM.markerId]: MARKER_ID }).toString()}`,
    [],
  );
  const hrefForAlertTab = useMemo(() => {
    const p = new URLSearchParams();
    if (country) p.set(AREA_PARAM, country);
    p.set(PARAM.markerId, MARKER_ID);
    return `/alert?${p.toString()}`;
  }, [country]);

  return { country, asOfYear, layer, setLayer, setCountry, setAsOfYear, hrefForAlert, hrefForAlertTab };
}
