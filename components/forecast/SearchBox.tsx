"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { WORLD, loadPlaces, type GeoPlace } from "@/lib/forecast/geo";
import { searchAll, type SearchResult } from "@/lib/forecast/search";

export function SearchBox(props: {
  onSelect: (result: SearchResult) => void;
  className?: string;
}) {
  const { onSelect, className = "" } = props;
  const uid = useId();
  const listId = `${uid}-list`;
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [places, setPlaces] = useState<GeoPlace[]>([]);
  const requested = useRef(false);

  useEffect(() => {
    // nothing to clean up; places load once
  }, []);

  const results = useMemo(
    () => searchAll(value, WORLD.countries, places, 8),
    [value, places],
  );
  const showList = open && value.trim() !== "";

  function ensurePlaces() {
    if (requested.current) return;
    requested.current = true;
    loadPlaces()
      .then(setPlaces)
      .catch(() => {
        requested.current = false;
      });
  }

  function choose(r: SearchResult) {
    setValue(r.label);
    setOpen(false);
    setActive(-1);
    onSelect(r);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (showList && results.length) {
        e.preventDefault();
        choose(results[active >= 0 ? active : 0]);
      }
    } else if (e.key === "Escape") {
      if (!showList) setValue("");
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <label
        htmlFor={`${uid}-input`}
        className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-[0.15em] text-muted"
      >
        Search a country or city
      </label>
      <div className="relative">
        <svg
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        >
          <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          id={`${uid}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${uid}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder="For example Nigeria or Lagos"
          onFocus={(e) => {
            e.currentTarget.select();
            ensurePlaces();
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className="fc-input w-full py-2 pl-9 pr-3 text-sm text-fg placeholder:text-muted/75 focus:outline-none"
        />
      </div>
      <div role="status" aria-live="polite">
        {showList && results.length === 0 && (
          <p className="fc-dropdown absolute left-0 right-0 z-20 mt-1.5 px-3.5 py-2.5 text-sm text-muted">
            No country or city matches. Try a country name.
          </p>
        )}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Search results"
        hidden={!showList || results.length === 0}
        className="fc-dropdown absolute left-0 right-0 z-20 mt-1.5 max-h-72 overflow-y-auto"
      >
        {showList &&
          results.map((r, i) => (
            <li
              key={`${r.kind}-${r.iso3}-${r.label}-${i}`}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer border-b border-white/[0.08] px-3.5 py-2 transition-colors last:border-b-0 ${
                i === active ? "bg-drug-soft" : "hover:bg-white/[0.04]"
              }`}
            >
              <span className="block text-sm font-medium text-fg">{r.label}</span>
              <span className="block text-[0.8125rem] tabular-nums text-muted">{r.sublabel}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
