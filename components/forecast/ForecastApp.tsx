"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AlertFeed } from "@/lib/forecast/types";
import { useForecastUrl } from "@/lib/forecast/url";
import { WorldMap } from "./WorldMap";
import { Legend } from "./Legend";
import { SearchBox } from "./SearchBox";
import { CountryPanel } from "./CountryPanel";
import type { SearchResult } from "@/lib/forecast/search";

const PANEL_PX = 420;

export function ForecastApp({ alertFeed }: { alertFeed: AlertFeed }) {
  const { country, asOfYear, setCountry, hrefFor } = useForecastUrl();
  const rootRef = useRef<HTMLDivElement>(null);
  const [navPx, setNavPx] = useState(58);
  const [stageW, setStageW] = useState(1440);
  const [flyKey, setFlyKey] = useState(0);
  // City name from a city search: UI state only, valid while that country stays selected.
  const [city, setCity] = useState<{ iso3: string; name: string } | null>(null);

  useLayoutEffect(() => {
    const header = document.querySelector("header");
    const measure = () => {
      if (header) setNavPx(Math.round(header.getBoundingClientRect().height));
      if (rootRef.current) setStageW(rootRef.current.getBoundingClientRect().width);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const onSearch = useCallback(
    (r: SearchResult) => {
      setCity(r.kind === "city" && r.cityName ? { iso3: r.iso3, name: r.cityName } : null);
      setFlyKey((k) => k + 1);
      if (r.iso3 !== country) setCountry(r.iso3);
    },
    [country, setCountry],
  );

  const onMapSelect = useCallback(
    (iso3: string) => {
      setCity(null);
      if (iso3 !== country) setCountry(iso3);
    },
    [country, setCountry],
  );

  const onClose = useCallback(() => {
    setCity(null);
    setCountry(null);
  }, [setCountry]);

  useEffect(() => {
    if (!country) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("input,[role=combobox]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [country, onClose]);

  const panelPx = country ? Math.min(PANEL_PX, stageW) : 0;
  const resolvedFromCity = city && city.iso3 === country ? city.name : null;

  return (
    <div
      ref={rootRef}
      className="fc-root"
      style={{ ["--fc-nav" as string]: `${navPx}px` }}
    >
      <div className="fc-stage">
        <h1 className="sr-only">
          Forecast: K540E (pfdhps, sulfadoxine-pyrimethamine) in genome data by country, as of {asOfYear}
        </h1>
        <WorldMap
          asOfYear={asOfYear}
          selected={country}
          flyKey={flyKey}
          panelPx={panelPx}
          onSelect={onMapSelect}
        />

        <div className="fc-card absolute left-4 top-4 z-20 w-[360px] max-w-[calc(100%-2rem)] p-3.5">
          <p className="fc-label">Forecast · Observed history</p>
          <p className="mt-1.5 text-[13px] leading-snug">
            <span className="font-semibold text-drug">K540E</span> · parasite gene{" "}
            <i>pfdhps</i> · drug: sulfadoxine-pyrimethamine (SP)
          </p>
          <SearchBox onSelect={onSearch} className="mt-3" />
        </div>

        <div
          data-slot="time-control"
          className="absolute top-4 z-20 -translate-x-1/2"
          style={{ left: `calc((100% - ${panelPx}px) / 2)` }}
        >
          <div className="fc-card px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] tabular-nums">
            <span className="text-muted">As of</span> <span className="text-fg">{asOfYear}</span>
          </div>
        </div>

        <Legend asOfYear={asOfYear} className="absolute bottom-4 left-4 z-20" />

        {country ? (
          <aside className="fc-panel" aria-label="Country evidence">
            <CountryPanel
              key={country}
              iso3={country}
              asOfYear={asOfYear}
              alertFeed={alertFeed}
              resolvedFromCity={resolvedFromCity}
              hrefForAlert={(id) => hrefFor("/alert", { alert: id })}
              hrefForAlertTab={hrefFor("/alert")}
              onClose={onClose}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
