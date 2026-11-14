// Run: npx tsx --test lib/alert/*.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeAlert, composeEmail } from "./compose.ts";
import { deriveAlerts, type Watch } from "./derive.ts";
import { loadPack, toClientPack } from "./loadPack.ts";
import { MARKERS, pmidStr, toAlertData } from "./pack.ts";
import { buildPermalinkPath, buildQualityLedger } from "./quality.ts";

test("loadPack joins auditedGraph (153 forecast findings) and buildQualityLedger scores tiers & funnel math", async () => {
  const raw = await loadPack();
  assert.ok(raw, "k540e-data-pack must load");
  const pack = toClientPack(raw);
  assert.ok(Array.isArray(pack.auditedGraph));
  assert.ok(pack.auditedGraph.length >= 153, `expected >=153 audited records, got ${pack.auditedGraph.length}`);

  const ken = buildQualityLedger(pack, "KEN", "Kenya");
  assert.equal(ken.area, "KEN");
  assert.equal(ken.countryName, "Kenya");
  assert.equal(ken.defaultMaxSe, 0.45);
  assert.ok(ken.cleanFindings.length >= 50);
  assert.ok(ken.noisyFindings.length >= 20);
  assert.equal(ken.errorFindings.length, 26);

  // PEyo2A8Ol0 (Kenya DP vs SP reversed arm) & direct-540 mis-extractions must be quarantined at score 0
  for (const badId of ["PEyo2A8Ol0", "AeI-laBxXr", "paFNq6MPX5", "QIrkddNp_j", "iD_4aq3uIs"]) {
    const err = ken.errorFindings.find((f) => f.systemId === badId);
    assert.ok(err, `missing quarantined error ${badId}`);
    assert.equal(err.tier, "contradicted_error");
    assert.equal(err.fidelityScore, 0);
    assert.match(err.pubmedUrl, /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
  }

  // Gutman 2015 Malawi records carry verified repo PMID 25564249
  const gutman = ken.errorFindings.find((f) => f.systemId === "AeI-laBxXr")!;
  assert.equal(gutman.pmid, "25564249");
  assert.equal(gutman.pubmedUrl, "https://pubmed.ncbi.nlm.nih.gov/25564249/");

  // Funnel math verification on PEyo2A8Ol0 (RR 0.32, 95% CI 0.18 to 0.56)
  const pe = ken.funnelPoints.find((f) => f.systemId === "PEyo2A8Ol0");
  assert.ok(pe, "PEyo2A8Ol0 has positive ratio CI and must appear in funnelPoints so Include Errors shifts funnel");
  const expectedLog = Math.log(0.32);
  const expectedSe = (Math.log(0.56) - Math.log(0.18)) / (2 * 1.96);
  assert.ok(Math.abs((pe.logEffect ?? 0) - expectedLog) < 1e-9);
  assert.ok(Math.abs((pe.se ?? 0) - expectedSe) < 1e-9);
  assert.ok(Math.abs((pe.precision ?? 0) - 1 / expectedSe) < 1e-9);

  // Non-ratio birth-weight difference (-267g, gD0V6goixf) must NOT have log-ratio funnel coordinates
  const bwDiff = [...ken.cleanFindings, ...ken.noisyFindings].find((f) => f.systemId === "gD0V6goixf");
  assert.ok(bwDiff);
  assert.equal(bwDiff.logEffect, null);
  assert.equal(bwDiff.se, null);

  // Impact bullets & robustness verdict checks
  assert.equal(ken.impact.impactBullets.length, 2);
  assert.match(ken.impact.impactBullets[0].domain, /K540E.*sulfadoxine-pyrimethamine \(SP\)/);
  assert.match(ken.impact.impactBullets[0].rawWithErrorsConclusion, /25564249/);
  assert.equal(ken.impact.robustnessVerdict.status, "more_robust");
  assert.ok(ken.localCounts.errors >= 1, "Kenya has local contradicted findings including PEyo2A8Ol0");

  // DRC (COD) has 2 local clean findings -> more_robust; Vietnam (VNM) has 0 local clean clinical SP studies -> limited_local_evidence
  const cod = buildQualityLedger(pack, "COD", "Democratic Republic of the Congo");
  assert.equal(cod.localCounts.clean, 2);
  assert.equal(cod.impact.robustnessVerdict.status, "more_robust");

  const vnm = buildQualityLedger(pack, "VNM", "Vietnam");
  assert.equal(vnm.localCounts.clean, 0);
  assert.equal(vnm.impact.robustnessVerdict.status, "limited_local_evidence");

  // Science wording guardrail: never say "cause" or "causes", always PubMed links
  const serialized = JSON.stringify([ken.impact, cod.impact, vnm.impact]);
  assert.doesNotMatch(serialized, /\bcauses?\b/i);
});

test("buildQualityLedger remains backwards-compatible when pack.auditedGraph is omitted", async () => {
  const raw = await loadPack();
  assert.ok(raw);
  const mockPack = { ...toClientPack(raw), auditedGraph: undefined };
  const tza = buildQualityLedger(mockPack, "TZA", "Tanzania");
  assert.ok(tza.cleanFindings.length > 0);
  assert.ok(tza.errorFindings.some((f) => f.systemId === "PEyo2A8Ol0"));
});

test("buildPermalinkPath formats canonical alert IDs and watch query parameters cleanly", () => {
  assert.equal(
    buildPermalinkPath({
      alertId: "k540e-KEN-2003-band_change",
      markerUrlId: "pfdhps-K540E",
      area: "KEN",
    }),
    "/alert/dispatch?alert=k540e-KEN-2003-band_change",
  );

  assert.equal(
    buildPermalinkPath({
      markerUrlId: "pfdhps-K540E",
      area: "COD",
      trig: "rise",
      level: 25,
      findingId: "g:COD:2022:level_crossed",
    }),
    "/alert/dispatch?marker=pfdhps-K540E&area=COD&trig=rise&level=25&finding=g%3ACOD%3A2022%3Alevel_crossed",
  );

  assert.equal(
    buildPermalinkPath({
      markerUrlId: "pfdhps-K540E",
      area: "GMB",
      trig: "first_detection",
      findingId: "g:GMB:2014:first_detection",
    }),
    "/alert/dispatch?marker=pfdhps-K540E&area=GMB&trig=first&finding=g%3AGMB%3A2014%3Afirst_detection",
  );
});

test("composeEmail embeds System Public Graph dispatch masthead, permalink button, and range-scoped Map link", async () => {
  const raw = await loadPack();
  assert.ok(raw);
  const pack = toClientPack(raw);
  const marker = MARKERS.dhps_K540E;
  const data = toAlertData(marker, pack);
  const papers = new Map(pack.literature.papers.map((p) => [pmidStr(p.pmid), p]));

  const watch: Watch = {
    marker: marker.key,
    area: "COD",
    trigger: "rise",
    level: 25,
    points: 20,
    minN: 20,
  };
  const chosen = deriveAlerts(watch, data).find((e) => e.id === "g:COD:2022:level_crossed")!;
  assert.ok(chosen);

  const country = pack.genomes.countries.COD.country;
  const composed = composeAlert({
    e: chosen,
    watch,
    marker,
    country,
    basis: pack.genomes.countries.COD.who_basis,
    pack,
    cells: data.cells,
    papers,
  });

  const email = composeEmail(composed, {
    e: chosen,
    watch,
    marker,
    country,
    link: "https://observatory.example.org/alert?marker=pfdhps-K540E&area=COD&trig=rise&level=25",
    asOf: "Snapshot check",
    extras: {
      links: [
        {
          label: "See this country on the Forecast map",
          url: "https://observatory.example.org/forecast?country=COD&marker=pfdhps-K540E",
        },
      ],
    },
  });

  // Masthead, permalink button, and normalized Map range link
  assert.match(email.html, /RESISTANCE OBSERVATORY · SYSTEM PUBLIC GRAPH SURVEILLANCE DISPATCH/);
  assert.match(email.html, /System graph v2\.1, 1 July 2026/);
  assert.match(email.html, /Open Permanent Web Dispatch ↗/);
  assert.match(
    email.html,
    /https:\/\/observatory\.example\.org\/alert\/dispatch\?marker=pfdhps-K540E&amp;area=COD&amp;trig=rise&amp;level=25/,
  );
  assert.match(email.html, /See this country on the Map/);
  assert.match(
    email.html,
    /https:\/\/observatory\.example\.org\/forecast\?country=COD&amp;marker=pfdhps-K540E&amp;range=1966-2022/,
  );

  // Core provenance DOIs, Knowledge Futures Hackathon credit, quarantined IDs, and science wording
  assert.match(email.html, /10\.5281\/zenodo\.18681980/);
  assert.match(email.html, /10\.7910\/DVN\/7V6JDO/);
  assert.match(email.html, /demo-system-hackathon\.kfutures\.org/);
  assert.match(email.html, /PEyo2A8Ol0/);
  assert.match(email.html, /AeI-laBxXr/);
  assert.doesNotMatch(email.text, /\bcauses?\b/i);
  assert.doesNotMatch(email.html, /\bcauses?\b/i);
});
