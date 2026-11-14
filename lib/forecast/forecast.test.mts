// Run from the repo root: node --test lib/forecast/forecast.test.mts
// Reads the pinned JSON directly (data.ts is not imported: its "@/" imports do not resolve under plain Node).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const load = (p: string) => JSON.parse(readFileSync(new URL(p, root), "utf8"));

test("data/alerts.json: 12 K540E alerts, each on a sampled genome country-year", () => {
  const raw = load("data/alerts.json");
  const alerts = Array.isArray(raw) ? raw : raw.alerts;
  assert.equal(alerts.length, 12);
  const genome = load("data/forecast/genome-k540e.json");
  const byIso = new Map(genome.countries.map((c: { iso3: string; years: unknown[] }) => [c.iso3, c.years]));
  for (const a of alerts) {
    assert.equal(a.marker_id, "pfdhps-K540E", `${a.id}: marker_id`);
    const years = byIso.get(a.country_iso3) as { year: number; tested: number }[] | undefined;
    assert.ok(years, `${a.id}: ${a.country_iso3} is not in the genome layer`);
    const row = years.find((y) => y.year === a.year);
    assert.ok(row, `${a.id}: no genome row for ${a.country_iso3} ${a.year}`);
    assert.ok(row.tested > 0, `${a.id}: ${a.country_iso3} ${a.year} has tested = 0`);
  }
});

test("log-scale SE from the interval, on a real record (ZPGDdrkvVI)", () => {
  // Local copy of the formula in lib/forecast/data.ts ratioPrecision (assumes a 95% interval).
  const se = (lo: number, hi: number) => (Math.log(hi) - Math.log(lo)) / (2 * 1.96);
  const graph = load("data/forecast/graph-findings.json");
  const f = graph.findings.find((x: { systemId: string }) => x.systemId === "ZPGDdrkvVI");
  assert.ok(f, "ZPGDdrkvVI not in graph-findings.json");
  assert.equal(f.statisticType, "odds_ratio");
  assert.equal(f.statisticValue, 22.4);
  assert.equal(f.ciLower, 5.1);
  assert.equal(f.ciUpper, 98.1);
  const expected = (Math.log(98.1) - Math.log(5.1)) / 3.92;
  assert.ok(Math.abs(se(f.ciLower, f.ciUpper) - expected) < 1e-12);
});
