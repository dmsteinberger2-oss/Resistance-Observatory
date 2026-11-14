// Invariant checks and spot checks for the pinned Forecast data. Run: node scripts/forecast/check-data.mjs
import { readFileSync } from "node:fs";

const load = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));
const genome = load("data/forecast/genome-k540e.json");
const graph = load("data/forecast/graph-findings.json");
const alerts = load("data/forecast/alerts.placeholder.json");

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error("FAIL", msg);
};
const ISO = /^[A-Z]{3}$/;

for (const c of genome.countries) {
  if (!ISO.test(c.iso3)) fail(`bad iso3 ${c.iso3}`);
  let prev = -Infinity;
  for (const y of c.years) {
    if (y.year <= prev) fail(`${c.iso3} years not ascending/unique at ${y.year}`);
    prev = y.year;
    if (y.tested !== y.kOnly + y.eOnly + y.mixedWithE + y.other) fail(`${c.iso3} ${y.year} tested sum`);
    if (y.withE !== y.eOnly + y.mixedWithE) fail(`${c.iso3} ${y.year} withE sum`);
    if (y.tested + y.missing === 0) fail(`${c.iso3} ${y.year} empty year row`);
  }
}
const allYears = genome.countries.flatMap((c) => c.years.map((y) => y.year));
if (Math.min(...allYears) !== genome.minYear || Math.max(...allYears) !== genome.maxYear) fail("min/max year");

for (const f of graph.findings) {
  if (!f.systemId) fail("finding without systemId");
  if (!f.pubmedId && !f.doi) fail(`${f.systemId} has neither pubmedId nor doi`);
  if (!f.countries?.length) fail(`${f.systemId} has no countries`);
  for (const c of f.countries ?? []) if (!ISO.test(c.iso3)) fail(`${f.systemId} bad iso3 ${c.iso3}`);
  if (f.kind !== "sp" && f.kind !== "codon540") fail(`${f.systemId} bad kind`);
}
if (!Array.isArray(alerts) || alerts.length !== 2) fail("placeholder alerts must be an array of 2");

const row = (iso, year) => {
  const y = genome.countries.find((c) => c.iso3 === iso)?.years.find((r) => r.year === year);
  return y ? `${y.withE}/${y.tested}` : "not sampled";
};
console.log("Spot checks (withE/tested):");
console.log("  NGA 2020", row("NGA", 2020), "(expected 3/204)");
console.log(
  "  NGA 2008-2019",
  [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019].map((y) => `${y}:${row("NGA", y)}`).join(" "),
  "(expected withE 0; tested 10,1,4,24,96,20,29 in sampled years)",
);
console.log("  GMB 2014", row("GMB", 2014), "(expected 3/302); GMB 2013", row("GMB", 2013), "(expected 0/49)");
console.log("  KEN 1994", row("KEN", 1994), "(expected 16/53); KEN 2019", row("KEN", 2019), "(expected 236/243)");
console.log("  countries", genome.countries.length, "years", genome.minYear, "-", genome.maxYear);
const sum = genome.countries.reduce((s, c) => s + c.years.reduce((t, y) => t + y.tested + y.missing, 0), 0);
console.log("  sum(tested+missing)", sum, "(expected 24409)");
if (sum !== 24409) fail("tested+missing sum");
console.log("Graph totals", JSON.stringify(graph.totals));
console.log(
  "  findings",
  graph.findings.length,
  "| sp",
  graph.findings.filter((f) => f.kind === "sp").length,
  "| codon540",
  graph.findings.filter((f) => f.kind === "codon540").length,
  "| with OpenAlex date",
  graph.findings.filter((f) => f.paper.publishedDate).length,
);
// Paper spot-check join
const STATUSES = ["supported", "partly_supported", "contradicted", "not_verifiable"];
const verification = load("data/forecast/graph-verification.json");
const recon = load("data/forecast/raw/graph/sp_findings.json");
const reconIds = new Set(recon.map((r) => r.system_id));
const pinnedIds = new Set(graph.findings.map((f) => f.systemId));
const byId = new Map();
for (const r of verification.records ?? []) {
  if (!STATUSES.includes(r.status)) fail(`verification ${r.systemId} bad status ${r.status}`);
  if (!reconIds.has(r.systemId) && !pinnedIds.has(r.systemId)) fail(`verification ${r.systemId} matches no recon record or finding`);
  if (byId.has(r.systemId)) fail(`verification ${r.systemId} duplicated`);
  byId.set(r.systemId, r);
}
const notDisplayed = (verification.records ?? []).filter((r) => !pinnedIds.has(r.systemId)).map((r) => r.systemId);
const vc = { supported: 0, partly_supported: 0, contradicted: 0, not_verifiable: 0, unchecked: 0 };
for (const f of graph.findings) vc[byId.get(f.systemId)?.status ?? "unchecked"] += 1;
console.log("Verification records", (verification.records ?? []).length, "| not among displayed findings:", notDisplayed.length ? notDisplayed.join(", ") : "none");
console.log("Verification over displayed findings", JSON.stringify(vc));

console.log(failures ? `${failures} FAILURE(S)` : "All invariants hold.");
process.exit(failures ? 1 : 0);
