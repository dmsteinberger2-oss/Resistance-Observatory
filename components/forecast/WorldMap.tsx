"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { WORLD, COUNTRY_BY_ISO3, type GeoCountry } from "@/lib/forecast/geo";
import { GENOME, allGenomeSnapshots, genomeSnapshot, graphCountsByCountry } from "@/lib/forecast/data";
import type { GenomeSnapshot } from "@/lib/forecast/types";
import {
  DETECTED_DOT,
  HATCH_BG,
  HATCH_LINE,
  HATCH_PATTERN_ID,
  LAND_NOT_SAMPLED,
  STATE_LABEL,
  fillFor,
  stateOf,
} from "@/lib/forecast/encoding";

/** View in projected units: centre and width; height follows the container aspect. */
type View = { cx: number; cy: number; w: number };
type Size = { cw: number; ch: number };

const MAX_ZOOM = 40;
const MIN_FLY_WIDTH = 45;
const FLY_MS = 1100;

const GENOME_ISO3 = new Set(GENOME.countries.map((c) => c.iso3));
const INTERACTIVE_ISO3 = (() => {
  const s = new Set(GENOME_ISO3);
  const g = graphCountsByCountry();
  for (const [iso3, c] of Object.entries(g)) if (c && (c.sp > 0 || c.codon540 > 0)) s.add(iso3);
  return s;
})();

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function worldWidth({ cw, ch }: Size): number {
  return Math.max(WORLD.width, (WORLD.height * cw) / ch) * 1.02;
}

function clampView(v: View, size: Size, loose = false): View {
  const ww = worldWidth(size);
  const w = Math.min(ww, Math.max(WORLD.width / MAX_ZOOM, v.w));
  const h = (w * size.ch) / size.cw;
  const slackX = loose ? w * 0.45 : 0;
  const slackY = loose ? h * 0.45 : 0;
  const clampAxis = (c: number, span: number, total: number, slack: number) => {
    if (span >= total) return total / 2 + Math.max(-slack, Math.min(slack, c - total / 2));
    return Math.min(total - span / 2 + slack, Math.max(span / 2 - slack, c));
  };
  return {
    w,
    cx: clampAxis(v.cx, w, WORLD.width, slackX),
    cy: clampAxis(v.cy, h, WORLD.height, slackY),
  };
}

function worldView(size: Size): View {
  return { cx: WORLD.width / 2, cy: WORLD.height / 2, w: worldWidth(size) };
}

/** Fit a country's bbox into the part of the map not covered by the panel. */
function targetView(c: GeoCountry, size: Size, panelPx: number): View {
  const [x0, y0, x1, y1] = c.bbox;
  const usable = Math.max(0.35, (size.cw - panelPx) / size.cw);
  const pad = 2.4;
  const bw = Math.max(1, x1 - x0) * pad;
  const bh = Math.max(1, y1 - y0) * pad;
  let w = Math.max(bw / usable, (bh * size.cw) / size.ch, MIN_FLY_WIDTH);
  w = Math.min(w, worldWidth(size));
  const bcx = (x0 + x1) / 2;
  const bcy = (y0 + y1) / 2;
  const visibleCentrePx = (size.cw - panelPx) / 2;
  const left = bcx - visibleCentrePx * (w / size.cw);
  return clampView({ cx: left + w / 2, cy: bcy, w }, size, true);
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------------------

const CountryPaths = memo(function CountryPaths({
  snapshots,
  selected,
}: {
  snapshots: Record<string, GenomeSnapshot>;
  selected: string | null;
}) {
  return (
    <g>
      {WORLD.countries.map((c) => {
        const s = snapshots[c.iso3];
        const focusable = INTERACTIVE_ISO3.has(c.iso3);
        return (
          <path
            key={c.iso3}
            d={c.d}
            data-iso3={c.iso3}
            fill={fillFor(s)}
            className={`fc-country is-interactive${selected === c.iso3 ? " is-selected" : ""}`}
            tabIndex={focusable ? 0 : undefined}
            role={focusable ? "button" : undefined}
            aria-label={focusable ? `${c.name}: ${STATE_LABEL[stateOf(s)]}` : undefined}
            aria-pressed={focusable ? selected === c.iso3 : undefined}
          />
        );
      })}
    </g>
  );
});

export function WorldMap({
  asOfYear,
  selected,
  flyKey,
  panelPx,
  onSelect,
}: {
  asOfYear: number;
  selected: string | null;
  /** Bump to re-fly to the same country (e.g. a repeated search). */
  flyKey: number;
  /** Width in px of the panel covering the right side of the map (0 when closed). */
  panelPx: number;
  onSelect: (iso3: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  viewRef.current = view;
  const sizeRef = useRef<Size | null>(null);
  sizeRef.current = size;
  const animRef = useRef<number | null>(null);
  const positionedRef = useRef(false);
  const lastFlyRef = useRef<string>("");

  const [hover, setHover] = useState<{ iso3: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; view: View; moved: boolean; id: number } | null>(null);
  const suppressClickRef = useRef(false);

  const snapshots = useMemo(() => allGenomeSnapshots(asOfYear), [asOfYear]);

  // Measure the container.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ cw: r.width, ch: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stopAnim = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  };

  const flyTo = useCallback((target: View, ms = FLY_MS) => {
    stopAnim();
    const from = viewRef.current;
    if (!from || reducedMotion() || ms <= 0) {
      setView(target);
      return;
    }
    const lw0 = Math.log(from.w);
    const lw1 = Math.log(target.w);
    const dist = Math.hypot(target.cx - from.cx, target.cy - from.cy);
    const span = Math.max(from.w, target.w);
    // Zoom out a little mid-flight when the hop is long relative to the view.
    const bump = dist > span * 0.6 ? Math.log(1 + Math.min(1.2, dist / span) * 0.6) : 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = ease(t);
      setView({
        cx: from.cx + (target.cx - from.cx) * e,
        cy: from.cy + (target.cy - from.cy) * e,
        w: Math.exp(lw0 + (lw1 - lw0) * e + bump * Math.sin(Math.PI * t)),
      });
      animRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  // First positioning and fly-to on selection change.
  useEffect(() => {
    if (!size) return;
    const c = selected ? COUNTRY_BY_ISO3[selected] : undefined;
    if (!positionedRef.current || !viewRef.current) {
      positionedRef.current = true;
      lastFlyRef.current = `${selected}|${flyKey}`;
      setView(c ? targetView(c, size, panelPx) : worldView(size));
      return;
    }
    const key = `${selected}|${flyKey}`;
    if (key === lastFlyRef.current) return;
    lastFlyRef.current = key;
    if (c) flyTo(targetView(c, size, panelPx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, flyKey, size !== null]);

  // Keep the view valid when the container resizes.
  useEffect(() => {
    if (!size || !viewRef.current || animRef.current !== null) return;
    setView((v) => (v ? clampView(v, size, true) : v));
  }, [size]);

  useEffect(() => () => stopAnim(), []);

  // Wheel zoom about the cursor (non-passive so the page does not scroll).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      const s = sizeRef.current;
      if (!v || !s) return;
      e.preventDefault();
      stopAnim();
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const h = (v.w * s.ch) / s.cw;
      const ptx = v.cx - v.w / 2 + (px / s.cw) * v.w;
      const pty = v.cy - h / 2 + (py / s.ch) * h;
      const factor = Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.0022)));
      const nw = Math.min(worldWidth(s), Math.max(WORLD.width / MAX_ZOOM, v.w * factor));
      const nh = (nw * s.ch) / s.cw;
      const left = ptx - (px / s.cw) * nw;
      const top = pty - (py / s.ch) * nh;
      setView(clampView({ cx: left + nw / 2, cy: top + nh / 2, w: nw }, s, true));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [view !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !viewRef.current) return;
    dragRef.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const s = sizeRef.current;
    if (d && s) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 4) {
        d.moved = true;
        stopAnim();
        setDragging(true);
        setHover(null);
        try {
          svgRef.current?.setPointerCapture(d.id);
        } catch {}
      }
      if (d.moved) {
        const k = d.view.w / s.cw;
        setView(clampView({ cx: d.view.cx - dx * k, cy: d.view.cy - dy * k, w: d.view.w }, s, true));
        return;
      }
    }
    const target = (e.target as Element).closest?.("[data-iso3]") as Element | null;
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (target && wrap) {
      setHover({ iso3: target.getAttribute("data-iso3")!, x: e.clientX - wrap.left, y: e.clientY - wrap.top });
    } else if (hover) setHover(null);
  };
  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved) {
      suppressClickRef.current = true;
      setDragging(false);
      setTimeout(() => (suppressClickRef.current = false), 0);
    }
  };
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (suppressClickRef.current) return;
    const target = (e.target as Element).closest?.("[data-iso3]");
    const iso3 = target?.getAttribute("data-iso3");
    if (iso3) onSelect(iso3);
  };
  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const iso3 = (e.target as Element).getAttribute?.("data-iso3");
    if (iso3) {
      e.preventDefault();
      onSelect(iso3);
    }
  };
  const projToPx = (x: number, y: number) => {
    const v = viewRef.current;
    const s = sizeRef.current;
    if (!v || !s) return { x: 0, y: 0 };
    const h = (v.w * s.ch) / s.cw;
    return { x: ((x - (v.cx - v.w / 2)) / v.w) * s.cw, y: ((y - (v.cy - h / 2)) / h) * s.ch };
  };
  const onFocus = (e: React.FocusEvent<SVGSVGElement>) => {
    const iso3 = (e.target as Element).getAttribute?.("data-iso3");
    const c = iso3 ? COUNTRY_BY_ISO3[iso3] : undefined;
    if (c) setHover({ iso3: c.iso3, ...projToPx(c.center[0], c.center[1]) });
  };

  const zoomBy = (factor: number) => {
    const v = viewRef.current;
    const s = sizeRef.current;
    if (!v || !s) return;
    flyTo(clampView({ ...v, w: v.w / factor }, s, true), 350);
  };
  const resetWorld = () => {
    const s = sizeRef.current;
    if (s) flyTo(worldView(s), 700);
  };

  const zoom = view && size ? worldWidth(size) / view.w : 1;
  const unit = view && size ? view.w / size.cw : 1; // projected units per screen px
  const vb =
    view && size
      ? `${view.cx - view.w / 2} ${view.cy - (view.w * size.ch) / size.cw / 2} ${view.w} ${(view.w * size.ch) / size.cw}`
      : `0 0 ${WORLD.width} ${WORLD.height}`;
  const sel = selected ? COUNTRY_BY_ISO3[selected] : undefined;

  // Markers (constant on-screen size) for sampled states and tiny countries.
  const markers = WORLD.countries.map((c) => {
    const s = snapshots[c.iso3];
    const st = stateOf(s);
    const [x, y] = c.center;
    if (st === "detected") {
      return (
        <circle
          key={c.iso3}
          data-iso3={c.iso3}
          className="fc-marker is-interactive"
          cx={x}
          cy={y}
          r={5 * unit}
          fill={DETECTED_DOT}
          stroke="#050d17"
          strokeWidth={1.75}
        />
      );
    }
    if (st === "tested_not_detected") {
      return (
        <circle
          key={c.iso3}
          data-iso3={c.iso3}
          className="fc-marker is-interactive"
          cx={x}
          cy={y}
          r={4.5 * unit}
          fill="#050d17"
          stroke="#f5f4ef"
          strokeWidth={1.6}
        />
      );
    }
    if (c.tiny) {
      return (
        <circle
          key={c.iso3}
          data-iso3={c.iso3}
          className="fc-marker is-interactive"
          cx={x}
          cy={y}
          r={2.2 * unit}
          fill={LAND_NOT_SAMPLED}
          stroke="#1d3f58"
          strokeWidth={1}
        />
      );
    }
    return null;
  });

  const labels = WORLD.countries
    .filter((c) => c.iso3 === selected || (zoom > 2.5 && GENOME_ISO3.has(c.iso3)))
    .map((c) => (
      <text
        key={c.iso3}
        className="fc-label-text"
        x={c.center[0]}
        y={c.center[1] - 10 * unit}
        textAnchor="middle"
        fontSize={(c.iso3 === selected ? 14 : 12) * unit}
        strokeWidth={3.5 * unit}
      >
        {c.name}
      </text>
    ));

  const hoverSnap = hover ? genomeSnapshot(hover.iso3, asOfYear) : null;
  const hoverGeo = hover ? COUNTRY_BY_ISO3[hover.iso3] : undefined;

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        className={`fc-map${dragging ? " is-dragging" : ""}${selected ? " fc-dim" : ""}`}
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`World map of K540E (pfdhps, sulfadoxine-pyrimethamine) in genome data as of ${asOfYear}. Countries with data are focusable.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={() => setHover(null)}
      >
        <defs>
          <pattern
            id={HATCH_PATTERN_ID}
            width={5 * unit}
            height={5 * unit}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={5 * unit} height={5 * unit} fill={HATCH_BG} />
            <line x1="0" y1="0" x2="0" y2={5 * unit} stroke={HATCH_LINE} strokeWidth={1.4 * unit} />
          </pattern>
        </defs>
        <CountryPaths snapshots={snapshots} selected={selected} />
        {sel ? (
          <g>
            <path d={sel.d} className="fc-sel-halo" />
            <path d={sel.d} className="fc-sel-outline" />
          </g>
        ) : null}
        <g>{markers}</g>
        <g aria-hidden>{labels}</g>
      </svg>

      {hover && hoverGeo && hoverSnap ? (
        <div
          className="fc-card fc-tooltip"
          style={{
            left: Math.min(hover.x + 14, (size?.cw ?? 1000) - 300 - panelPx),
            top: Math.max(8, hover.y + 14),
          }}
          role="status"
        >
          <div className="font-semibold text-[13px]">{hoverGeo.name}</div>
          <div>{STATE_LABEL[hoverSnap.state]}</div>
          {hoverSnap.latest ? (
            <div className="tabular-nums">
              {hoverSnap.latest.year}: {hoverSnap.latest.withE} of {hoverSnap.latest.tested} samples carry
              K540E
            </div>
          ) : null}
          {hoverSnap.firstDetectionYear !== null ? (
            <div>First detection in our data: {hoverSnap.firstDetectionYear}</div>
          ) : null}
          <div className="mt-1 text-[11px] text-muted">Genome data · MalariaGEN Pf8 · by collection year</div>
        </div>
      ) : null}

      <div
        className="absolute bottom-4 z-20 flex flex-col gap-1.5"
        style={{ right: panelPx + 16, transition: "right 300ms ease" }}
      >
        <button type="button" className="fc-btn" aria-label="Zoom in" onClick={() => zoomBy(1.8)}>
          +
        </button>
        <button type="button" className="fc-btn" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.8)}>
          −
        </button>
        <button type="button" className="fc-btn text-[11px] uppercase tracking-[0.1em]" aria-label="Reset to world view" onClick={resetWorld}>
          World
        </button>
      </div>
    </div>
  );
}
