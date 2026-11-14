/**
 * System Public Graph Precision, Fidelity & Error-Quarantine Engine.
 *
 * Implements precision-weighted evidence grading and contradicted-extraction
 * quarantine inspired by Knowledge Futures' System Hackathon precision and
 * contested-evidence demos:
 *   - https://demo-system-hackathon.kfutures.org/
 *   - https://demo-system-contested.kfutures.org/
 *
 * Pure module (safe on server and client, relative type-only imports so
 * `node --test` runs directly without Next path aliases).
 */
import type { AuditedGraphRecord, ClientPack, GraphFinding, VerificationStatus } from "./pack";

export type FidelityTier =
  | "high_precision_trial"
  | "verified_cohort"
  | "low_precision_noise"
  | "contradicted_error";

export type ScoredFinding = {
  systemId: string;
  pmid: string;
  year: number | null;
  countryIso3: string | null;
  countryName: string | null;
  layer: "molecular_k540e" | "sp_clinical" | "haplotype";
  use: string;
  studyType: string;
  pairLabel: string;
  statLabel: string;
  effect: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  logEffect: number | null;
  se: number | null;
  precision: number | null;
  fidelityScore: number;
  tier: FidelityTier;
  tierLabel: string;
  inVettedCsv: boolean;
  verificationStatus: "supported" | "partly_supported" | "contradicted" | "not_verifiable" | "unvetted_api";
  exclusionReason: string | null;
  actualPaperSays: string | null;
  pubmedUrl: string;
};

export type ErrorImpactShift = {
  headline: string;
  impactBullets: {
    domain: string;
    cleanConclusion: string;
    rawWithErrorsConclusion: string;
    culpritIds: string[];
  }[];
  robustnessVerdict: {
    status: "more_robust" | "noise_excluded" | "limited_local_evidence";
    badge: string;
    summary: string;
    highPrecisionCount: number;
    supportingCohortCount: number;
    noisyExcludedCount: number;
    contradictedCount: number;
  };
};

export type QualityLedger = {
  area: string;
  countryName: string;
  defaultMaxSe: number;
  cleanFindings: ScoredFinding[];
  noisyFindings: ScoredFinding[];
  errorFindings: ScoredFinding[];
  /** All ratio findings with valid logEffect, se, and precision (both clean, noisy, and errorFindings that have positive ratio CIs, so toggling Include Errors visually shifts points on the funnel!) */
  funnelPoints: ScoredFinding[];
  /** Country-specific subset counts for quick display */
  localCounts: {
    clean: number;
    noisy: number;
    errors: number;
  };
  impact: ErrorImpactShift;
};

const DEFAULT_MAX_SE = 0.45;
const COHORT_MAX_SE = 0.65;

const DIRECT_540_ERROR_IDS = new Set([
  "paFNq6MPX5",
  "AeI-laBxXr",
  "QIrkddNp_j",
  "iD_4aq3uIs",
]);

const DIRECT_540_PAPER_NOTES: Record<string, { reason: string; actual: string }> = {
  "AeI-laBxXr": {
    reason: "Mis-attributed dhps A581G sextuple-mutant effect to isolated codon 540",
    actual:
      "Gutman et al. 2015 (PMID 25564249, Malawi) reported aPR 3.28 (1.79–6.01) for dhps A581G sextuple-mutant placental parasitaemia on a near-fixed K540E background, not an isolated pfdhps K540E effect.",
  },
  paFNq6MPX5: {
    reason: "Mis-attributed dhps A581G sextuple-mutant effect to isolated codon 540",
    actual:
      "Gutman et al. 2015 (PMID 25564249, Malawi) reported aPR 2.76 (1.82–4.18) for dhps A581G sextuple-mutant high-density parasitaemia during IPTp with sulfadoxine-pyrimethamine (SP), not isolated pfdhps K540E.",
  },
  QIrkddNp_j: {
    reason: "Inverted mutant class: paper reports quintuple-mutant failure, not double/triple codon 540",
    actual:
      "Kyabayinze et al. 2005 (PMID 16023986, Uganda) reported OR 24.72 (2.8–558.2) for dhfr + dhps quintuple mutants associated with sulfadoxine-pyrimethamine (SP) failure, not triple-or-double mutants.",
  },
  iD_4aq3uIs: {
    reason: "Mis-extracted wild-type prevalence decline (-41.3 percentage points) as a codon 540 effect",
    actual:
      "PMID 29854394 reported a -41.3 percentage-point decline in wild-type parasites alongside K540E prevalence change, not a clinical sulfadoxine-pyrimethamine (SP) failure estimate.",
  },
};

const PE_KENYA_NOTE = {
  reason: "Comparator arm inverted: dihydroartemisinin-piperaquine vs. SP risk ratio attributed to SP alone",
  actual:
    "Desai et al. 2015 (PMID 26429700, western Kenya) reported RR 0.32 (0.18–0.56) for dihydroartemisinin-piperaquine versus sulfadoxine-pyrimethamine (SP), where K540E was already ~98% fixed and SP was the less-effective comparator arm.",
};

const RATIO_STAT_TYPES = new Set([
  "odds_ratio",
  "adjusted_odds_ratio",
  "relative_risk_ratio",
  "adjusted_relative_risk",
  "risk_ratio",
  "hazard_ratio",
  "adjusted_hazard_ratio",
  "prevalence_ratio",
  "adjusted_prevalence_ratio",
  "incident_rate_ratio",
  "incidence_rate_ratio",
  "rate_ratio",
]);

const STAT_ABBR: Record<string, string> = {
  odds_ratio: "OR",
  adjusted_odds_ratio: "aOR",
  relative_risk_ratio: "RR",
  adjusted_relative_risk: "aRR",
  risk_ratio: "RR",
  hazard_ratio: "HR",
  adjusted_hazard_ratio: "aHR",
  prevalence_ratio: "PR",
  adjusted_prevalence_ratio: "aPR",
  incident_rate_ratio: "IRR",
  incidence_rate_ratio: "IRR",
  difference: "diff",
  percentage: "%",
  mean: "mean",
};

const TIER_LABELS: Record<FidelityTier, string> = {
  high_precision_trial: "High-precision verified trial / study",
  verified_cohort: "Verified supporting cohort",
  low_precision_noise: "Low-precision / wide-CI noise",
  contradicted_error: "Quarantined extraction error",
};

const ISO3_NAMES: Record<string, string> = {
  AGO: "Angola",
  BEN: "Benin",
  BFA: "Burkina Faso",
  BGD: "Bangladesh",
  BDI: "Burundi",
  CMR: "Cameroon",
  CAF: "Central African Republic",
  CIV: "Côte d'Ivoire",
  COD: "Democratic Republic of the Congo",
  COG: "Republic of the Congo",
  COM: "Comoros",
  ETH: "Ethiopia",
  GAB: "Gabon",
  GHA: "Ghana",
  GIN: "Guinea",
  GMB: "Gambia",
  GNB: "Guinea-Bissau",
  GNQ: "Equatorial Guinea",
  IND: "India",
  IDN: "Indonesia",
  KEN: "Kenya",
  KHM: "Cambodia",
  LAO: "Laos",
  LBR: "Liberia",
  MDG: "Madagascar",
  MLI: "Mali",
  MMR: "Myanmar",
  MOZ: "Mozambique",
  MRT: "Mauritania",
  MWI: "Malawi",
  NGA: "Nigeria",
  PNG: "Papua New Guinea",
  RWA: "Rwanda",
  SDN: "Sudan",
  SEN: "Senegal",
  SLE: "Sierra Leone",
  SOM: "Somalia",
  SSD: "South Sudan",
  TCD: "Chad",
  TGO: "Togo",
  THA: "Thailand",
  TZA: "Tanzania",
  UGA: "Uganda",
  VNM: "Vietnam",
  ZAF: "South Africa",
  ZMB: "Zambia",
  ZWE: "Zimbabwe",
};

function makePubmedUrl(pmid: string): string {
  const clean = String(pmid || "").trim();
  return clean ? `https://pubmed.ncbi.nlm.nih.gov/${clean}/` : "https://pubmed.ncbi.nlm.nih.gov/";
}

function isRatioStat(statType: string | null): boolean {
  if (!statType) return false;
  const s = statType.toLowerCase();
  if (RATIO_STAT_TYPES.has(s)) return true;
  return s.includes("ratio") && !s.includes("difference");
}

function formatNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function buildStatLabel(
  statType: string | null,
  effect: number | null,
  ciLower: number | null,
  ciUpper: number | null,
): string {
  const abbr = statType ? (STAT_ABBR[statType] ?? statType.replace(/_/g, " ")) : "stat";
  if (effect === null || !Number.isFinite(effect)) return abbr;
  const base = `${abbr} ${formatNum(effect)}`;
  if (ciLower !== null && ciUpper !== null && Number.isFinite(ciLower) && Number.isFinite(ciUpper)) {
    return `${base} (95% CI ${formatNum(ciLower)}–${formatNum(ciUpper)})`;
  }
  return base;
}

function inferUse(
  layer: ScoredFinding["layer"],
  explicitUse: string | null | undefined,
  spLooksLikeUptake: boolean | undefined,
  v1: string,
  v2: string,
): string {
  if (explicitUse && explicitUse.trim()) return explicitUse.trim();
  if (layer === "haplotype") return "Haplotype (dhfr + dhps)";
  if (layer === "molecular_k540e") return "Molecular pfdhps K540E paper";
  if (spLooksLikeUptake) return "IPTp-SP uptake / delivery";
  const text = `${v1} ${v2}`.toLowerCase();
  if (text.includes("seasonal malaria chemoprevention") || /\bsmc\b/.test(text)) return "SMC";
  if (
    text.includes("pregnancy") ||
    text.includes("pregnant") ||
    text.includes("placental") ||
    text.includes("birth weight") ||
    text.includes("birthweight") ||
    text.includes("iptp")
  ) {
    return "IPTp";
  }
  if (text.includes("school") || text.includes("iptsc")) return "IPTsc";
  if (text.includes("infant") || text.includes("ipti")) return "IPTi";
  return "SP clinical";
}

function resolveCountryName(iso3: string | null, pack: ClientPack, fallbackMap?: Record<string, string>): string | null {
  if (!iso3) return null;
  const fromGenomes = pack.genomes?.countries?.[iso3]?.country;
  if (fromGenomes) return fromGenomes;
  if (ISO3_NAMES[iso3]) return ISO3_NAMES[iso3];
  if (fallbackMap?.[iso3]) return fallbackMap[iso3];
  return iso3;
}

type MergedCandidate = {
  systemId: string;
  pmid: string;
  year: number | null;
  countriesIso3: string[];
  checkedCountryIso3: string | null;
  countryNames?: Record<string, string>;
  layer: ScoredFinding["layer"];
  use: string;
  studyType: string;
  variable1: string;
  variable2: string;
  statisticType: string | null;
  effect: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  inVettedCsv: boolean;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
};

function mergePackAndAudited(pack: ClientPack): MergedCandidate[] {
  const yearByPmid = new Map<string, number>();
  for (const p of pack.literature?.papers ?? []) {
    if (p.pmid && typeof p.pub_year === "number") yearByPmid.set(String(p.pmid), p.pub_year);
  }

  const byId = new Map<string, MergedCandidate>();

  for (const r of pack.auditedGraph ?? []) {
    if (!r?.systemId) continue;
    const layer: ScoredFinding["layer"] =
      r.kind === "haplotype" ? "haplotype" : r.kind === "codon540" ? "molecular_k540e" : "sp_clinical";
    const pmid = String(r.pmid || "").trim();
    byId.set(r.systemId, {
      systemId: r.systemId,
      pmid,
      year: r.year ?? yearByPmid.get(pmid) ?? null,
      countriesIso3: [...(r.countriesIso3 ?? [])],
      checkedCountryIso3: null,
      countryNames: r.countryNames,
      layer,
      use: inferUse(layer, r.use, r.spLooksLikeUptake, r.variable1, r.variable2),
      studyType: r.studyType?.trim() || "Observational / Cohort",
      variable1: r.variable1 || "",
      variable2: r.variable2 || "",
      statisticType: r.statisticType ?? null,
      effect: typeof r.statisticValue === "number" ? r.statisticValue : null,
      ciLower: typeof r.ciLower === "number" ? r.ciLower : null,
      ciUpper: typeof r.ciUpper === "number" ? r.ciUpper : null,
      inVettedCsv: Boolean(r.inVettedCsv),
      verificationStatus: r.verificationStatus,
      verificationNote: r.verificationNote ?? null,
    });
  }

  const applyPackList = (
    list: GraphFinding[] | undefined,
    layer: ScoredFinding["layer"],
    defaultStatusWhenUnchecked: VerificationStatus,
  ) => {
    for (const f of list ?? []) {
      if (!f?.system_id) continue;
      const pmid = String(f.pubmed_id || "").trim();
      const checkedIso3 = (f.checked?.country_iso3 as string | null | undefined) ?? f.country_iso3 ?? null;
      const packCountries = [
        ...(checkedIso3 ? [checkedIso3] : []),
        ...(Array.isArray(f.countries_iso3) ? f.countries_iso3.filter(Boolean) : []),
      ];
      const existing = byId.get(f.system_id);
      if (existing) {
        existing.layer = layer;
        if (f.use) existing.use = f.use;
        if (f.study_type) existing.studyType = f.study_type;
        if (checkedIso3) {
          existing.checkedCountryIso3 = checkedIso3;
          if (!existing.countriesIso3.includes(checkedIso3)) {
            existing.countriesIso3.unshift(checkedIso3);
          }
        }
        for (const iso of packCountries) {
          if (iso && !existing.countriesIso3.includes(iso)) existing.countriesIso3.push(iso);
        }
        if (f.source_checked && existing.verificationStatus === "not_verifiable") {
          existing.verificationStatus = "supported";
        }
        if (!existing.year) {
          existing.year = (typeof f.pub_year === "number" ? f.pub_year : null) ?? yearByPmid.get(pmid) ?? null;
        }
        const checkedNote =
          (typeof f.checked?.review_notes === "string" ? f.checked.review_notes : null) ??
          (typeof f.checked?.note === "string" ? f.checked.note : null);
        if (checkedNote && !existing.verificationNote) {
          existing.verificationNote = checkedNote;
        }
        continue;
      }

      const status: VerificationStatus = f.source_checked ? "supported" : defaultStatusWhenUnchecked;
      const checkedNote =
        (typeof f.checked?.review_notes === "string" ? f.checked.review_notes : null) ??
        (typeof f.checked?.note === "string" ? f.checked.note : null);
      byId.set(f.system_id, {
        systemId: f.system_id,
        pmid,
        year: (typeof f.pub_year === "number" ? f.pub_year : null) ?? yearByPmid.get(pmid) ?? null,
        countriesIso3: [...new Set(packCountries)],
        checkedCountryIso3: checkedIso3,
        layer,
        use: inferUse(layer, f.use, false, f.variable_1 ?? "", f.variable_2 ?? ""),
        studyType: f.study_type?.trim() || "Observational / Cohort",
        variable1: f.variable_1 ?? "",
        variable2: f.variable_2 ?? "",
        statisticType: f.statistic_type ?? null,
        effect: typeof f.statistic_value === "number" ? f.statistic_value : null,
        ciLower: typeof f.ci_lower === "number" ? f.ci_lower : null,
        ciUpper: typeof f.ci_upper === "number" ? f.ci_upper : null,
        inVettedCsv: f.in_vetted_csv !== false,
        verificationStatus: status,
        verificationNote: checkedNote,
      });
    }
  };

  applyPackList(pack.graph?.haplotype_findings, "haplotype", "partly_supported");
  applyPackList(pack.graph?.stakes_sp, "sp_clinical", "partly_supported");
  applyPackList(pack.graph?.findings_from_k540e_papers, "molecular_k540e", "not_verifiable");

  type ExcludedMetaEntry = { system_id?: string; pubmed_id?: string | number; reason?: string };
  const rawExcluded = pack.graph?._meta?.excluded_after_source_check;
  const excludedList: ExcludedMetaEntry[] = Array.isArray(rawExcluded)
    ? (rawExcluded as ExcludedMetaEntry[])
    : [{ system_id: "PEyo2A8Ol0", pubmed_id: "26429700", reason: PE_KENYA_NOTE.actual }];
  if (!excludedList.some((x) => x?.system_id === "PEyo2A8Ol0")) {
    excludedList.push({ system_id: "PEyo2A8Ol0", pubmed_id: "26429700", reason: PE_KENYA_NOTE.actual });
  }

  for (const ex of excludedList) {
    if (!ex?.system_id) continue;
    const existing = byId.get(ex.system_id);
    const pmid = String(ex.pubmed_id || "").trim();
    if (existing) {
      existing.verificationStatus = "contradicted";
      if (!existing.verificationNote && ex.reason) existing.verificationNote = ex.reason;
      continue;
    }
    const isPeKenya = ex.system_id === "PEyo2A8Ol0";
    byId.set(ex.system_id, {
      systemId: ex.system_id,
      pmid,
      year: yearByPmid.get(pmid) ?? (isPeKenya ? 2015 : null),
      countriesIso3: isPeKenya ? ["KEN"] : [],
      checkedCountryIso3: isPeKenya ? "KEN" : null,
      layer: "sp_clinical",
      use: isPeKenya ? "IPTp" : "SP clinical",
      studyType: isPeKenya ? "Experimental Trial" : "Observational / Cohort",
      variable1: isPeKenya
        ? "intermittent preventive treatment with sulfadoxine-pyrimethamine or dihydroartemisinin-piperaquine"
        : "sulfadoxine-pyrimethamine (SP) extracted exposure",
      variable2: isPeKenya
        ? "fetal malaria infection during pregnancy"
        : "clinical malaria outcome (excluded after source check)",
      statisticType: isPeKenya ? "relative_risk_ratio" : null,
      effect: isPeKenya ? 0.32 : null,
      ciLower: isPeKenya ? 0.18 : null,
      ciUpper: isPeKenya ? 0.56 : null,
      inVettedCsv: true,
      verificationStatus: "contradicted",
      verificationNote: ex.reason ?? PE_KENYA_NOTE.actual,
    });
  }

  return [...byId.values()];
}

function scoreCandidate(
  c: MergedCandidate,
  area: string,
  areaCountryName: string,
  pack: ClientPack,
): ScoredFinding {
  const isRatio =
    isRatioStat(c.statisticType) &&
    c.effect !== null &&
    c.effect > 0 &&
    c.ciLower !== null &&
    c.ciLower > 0 &&
    c.ciUpper !== null &&
    c.ciUpper > c.ciLower;

  let logEffect: number | null = null;
  let se: number | null = null;
  let precision: number | null = null;
  if (isRatio && c.effect !== null && c.ciLower !== null && c.ciUpper !== null) {
    const le = Math.log(c.effect);
    const computedSe = (Math.log(c.ciUpper) - Math.log(c.ciLower)) / (2 * 1.96);
    if (Number.isFinite(le) && Number.isFinite(computedSe) && computedSe > 0) {
      logEffect = le;
      se = computedSe;
      precision = 1 / computedSe;
    }
  }

  const isDirect540Error = DIRECT_540_ERROR_IDS.has(c.systemId);
  const isPeKenya = c.systemId === "PEyo2A8Ol0";
  const isError = c.verificationStatus === "contradicted" || isPeKenya || isDirect540Error;

  let countryIso3: string | null = null;
  if (c.countriesIso3.includes(area)) {
    countryIso3 = area;
  } else if (c.checkedCountryIso3) {
    countryIso3 = c.checkedCountryIso3;
  } else if (c.countriesIso3.length > 0) {
    countryIso3 = c.countriesIso3[0];
  }
  const resolvedCountryName =
    countryIso3 === area
      ? areaCountryName || resolveCountryName(area, pack, c.countryNames)
      : resolveCountryName(countryIso3, pack, c.countryNames);

  let fidelityScore = 0;
  let tier: FidelityTier;
  let exclusionReason: string | null = null;
  let actualPaperSays: string | null = null;

  if (isError) {
    fidelityScore = 0;
    tier = "contradicted_error";
    if (DIRECT_540_PAPER_NOTES[c.systemId]) {
      exclusionReason = DIRECT_540_PAPER_NOTES[c.systemId].reason;
      actualPaperSays = c.verificationNote
        ? `${DIRECT_540_PAPER_NOTES[c.systemId].actual} (${c.verificationNote})`
        : DIRECT_540_PAPER_NOTES[c.systemId].actual;
    } else if (isPeKenya) {
      exclusionReason = PE_KENYA_NOTE.reason;
      actualPaperSays = PE_KENYA_NOTE.actual;
    } else {
      exclusionReason = "Contradicted on source-paper spot-check against extracted variables or direction";
      actualPaperSays =
        c.verificationNote ??
        "Source paper check found that the extracted drug arm, comparator, or statistical contrast does not match sulfadoxine-pyrimethamine (SP) efficacy.";
    }
  } else {
    if (c.inVettedCsv) fidelityScore += 30;
    if (c.verificationStatus === "supported") fidelityScore += 25;
    else if (c.verificationStatus === "partly_supported") fidelityScore += 12;
    if (c.studyType === "Experimental Trial") fidelityScore += 20;

    if (se !== null) {
      if (se <= 0.25) fidelityScore += 25;
      else if (se <= DEFAULT_MAX_SE) fidelityScore += 15;
      else if (se <= 0.75) fidelityScore += 6;
    }
    fidelityScore = Math.min(100, fidelityScore);

    if (
      se !== null &&
      se <= DEFAULT_MAX_SE &&
      (c.studyType === "Experimental Trial" || fidelityScore >= 72)
    ) {
      tier = "high_precision_trial";
    } else if (fidelityScore >= 50 && se !== null && se <= COHORT_MAX_SE) {
      tier = "verified_cohort";
    } else {
      tier = "low_precision_noise";
      if (se === null) {
        exclusionReason = "Non-ratio statistic or missing 95% confidence interval (cannot precision-weight on funnel)";
      } else if (se > COHORT_MAX_SE) {
        exclusionReason = `Wide confidence interval (SE ${se.toFixed(2)} > ${COHORT_MAX_SE}) — underpowered noise`;
      } else {
        exclusionReason = `Fidelity score ${fidelityScore}/100 below verified threshold (50)`;
      }
    }
  }

  const pairLabel =
    c.variable1 && c.variable2 ? `${c.variable1} → ${c.variable2}` : c.variable1 || c.variable2 || c.systemId;

  return {
    systemId: c.systemId,
    pmid: c.pmid,
    year: c.year,
    countryIso3,
    countryName: resolvedCountryName,
    layer: c.layer,
    use: c.use,
    studyType: c.studyType,
    pairLabel,
    statLabel: buildStatLabel(c.statisticType, c.effect, c.ciLower, c.ciUpper),
    effect: c.effect,
    ciLower: c.ciLower,
    ciUpper: c.ciUpper,
    logEffect,
    se,
    precision,
    fidelityScore,
    tier,
    tierLabel: TIER_LABELS[tier],
    inVettedCsv: c.inVettedCsv,
    verificationStatus: isError && c.verificationStatus !== "contradicted" ? "contradicted" : c.verificationStatus,
    exclusionReason,
    actualPaperSays,
    pubmedUrl: makePubmedUrl(c.pmid),
  };
}

function buildErrorImpact(
  area: string,
  countryName: string,
  cleanFindings: ScoredFinding[],
  noisyFindings: ScoredFinding[],
  errorFindings: ScoredFinding[],
  localCounts: QualityLedger["localCounts"],
): ErrorImpactShift {
  const highPrecisionCount = cleanFindings.filter((f) => f.tier === "high_precision_trial").length;
  const supportingCohortCount = cleanFindings.filter((f) => f.tier === "verified_cohort").length;
  const noisyExcludedCount = noisyFindings.length;
  const contradictedCount = errorFindings.length;

  const directErrorIds = ["AeI-laBxXr", "paFNq6MPX5", "QIrkddNp_j", "iD_4aq3uIs"].filter((id) =>
    errorFindings.some((f) => f.systemId === id),
  );
  const directCulprits = directErrorIds.length > 0 ? directErrorIds : ["AeI-laBxXr", "paFNq6MPX5", "QIrkddNp_j", "iD_4aq3uIs"];

  const gutmanPmid = errorFindings.find((f) => f.systemId === "AeI-laBxXr")?.pmid || "25564249";
  const ugandaPmid = errorFindings.find((f) => f.systemId === "QIrkddNp_j")?.pmid || "16023986";
  const wtDropPmid = errorFindings.find((f) => f.systemId === "iD_4aq3uIs")?.pmid || "29854394";

  const bulletDirect = {
    domain: "Direct pfdhps K540E molecular associations with sulfadoxine-pyrimethamine (SP)",
    cleanConclusion:
      "0 direct single-marker pfdhps K540E clinical-failure findings survive source verification; in the verified System Public Graph, sulfadoxine-pyrimethamine (SP) treatment failure and birth-weight loss are associated with multi-locus dhfr + dhps quintuple or sextuple haplotypes (o23pQ-icgn, gD0V6goixf, 489sn1mPQa), not isolated codon 540 calls.",
    rawWithErrorsConclusion: `Unfiltered Graph records falsely link isolated pfdhps K540E to sulfadoxine-pyrimethamine (SP) failure — injecting Malawi IPTp-SP placental parasitaemia aPR 3.28 (AeI-laBxXr) and high-density parasitaemia aPR 2.76 (paFNq6MPX5, PMID ${gutmanPmid}, which actually tested dhps A581G sextuple haplotypes), Uganda OR 24.72 (QIrkddNp_j, PMID ${ugandaPmid}, actually quintuple-mutant risk), and -41.3 (iD_4aq3uIs, PMID ${wtDropPmid}, wild-type prevalence drop misread as codon 540).`,
    culpritIds: directCulprits,
  };

  const localErrors = errorFindings.filter((f) => f.countryIso3 === area);
  const globalExemplarIds = ["PEyo2A8Ol0", "6MNSCw6DyE", "Ou4VegsPqi", "7PQthtqs1C"].filter((id) =>
    errorFindings.some((f) => f.systemId === id),
  );
  const regionalCulprits = [
    ...new Set([
      ...localErrors.slice(0, 4).map((f) => f.systemId),
      ...(globalExemplarIds.length > 0 ? globalExemplarIds : ["PEyo2A8Ol0"]),
    ]),
  ];

  let bulletRegional: ErrorImpactShift["impactBullets"][number];
  if (localErrors.length > 0) {
    const lead = localErrors[0];
    const leadNote = lead.actualPaperSays || lead.exclusionReason || "contradicted on source check";
    bulletRegional = {
      domain: `${countryName} & regional sulfadoxine-pyrimethamine (SP) clinical efficacy`,
      cleanConclusion: `${localCounts.clean} verified high-precision or cohort finding${localCounts.clean === 1 ? "" : "s"} in ${countryName} (${cleanFindings.length} across the System Public Graph) show consistent sulfadoxine-pyrimethamine (SP) preventive protection where resistance haplotypes have not eroded efficacy, with ${localErrors.length} contradicted ${countryName} extraction${localErrors.length === 1 ? "" : "s"} quarantined.`,
      rawWithErrorsConclusion: `Including ${countryName}'s ${localErrors.length} contradicted Graph record${localErrors.length === 1 ? "" : "s"} — led by ${lead.systemId} (${lead.statLabel}, PMID ${lead.pmid}: ${leadNote}) — alongside ${contradictedCount} total contradicted Graph records mixes dihydroartemisinin-piperaquine (PEyo2A8Ol0), mefloquine (6MNSCw6DyE), folic acid (Ou4VegsPqi), and single-arm DHP incidence (7PQthtqs1C) into sulfadoxine-pyrimethamine (SP) estimates.`,
      culpritIds: regionalCulprits,
    };
  } else {
    bulletRegional = {
      domain: `${countryName} & regional sulfadoxine-pyrimethamine (SP) clinical efficacy`,
      cleanConclusion: `${countryName} has 0 contradicted local extractions (${localCounts.clean} local verified finding${localCounts.clean === 1 ? "" : "s"}), and across the regional System Public Graph ${cleanFindings.length} verified high-precision trials and cohorts preserve a coherent sulfadoxine-pyrimethamine (SP) efficacy benchmark.`,
      rawWithErrorsConclusion: `Without source-check quarantine across the regional System Public Graph, ${contradictedCount} contradicted records corrupt the sulfadoxine-pyrimethamine (SP) benchmark — including western Kenya PEyo2A8Ol0 (PMID 26429700, flipping dihydroartemisinin-piperaquine vs. SP RR 0.32 backwards as an SP effect), mefloquine (6MNSCw6DyE), folic acid (Ou4VegsPqi), and single-arm DHP incidence (7PQthtqs1C).`,
      culpritIds: regionalCulprits,
    };
  }

  let status: ErrorImpactShift["robustnessVerdict"]["status"];
  let badge: string;
  let summary: string;

  if (localCounts.clean >= 2) {
    status = "more_robust";
    badge = `Signal more robust across ${cleanFindings.length} verified studies (${localCounts.clean} in ${countryName})`;
    summary = `Combining ${highPrecisionCount} high-precision verified trials/studies (SE <= ${DEFAULT_MAX_SE}) with ${supportingCohortCount} verified cohorts (${localCounts.clean} local to ${countryName}) makes the sulfadoxine-pyrimethamine (SP) preventive and dhfr + dhps haplotype signal more robust, while ${noisyExcludedCount} wide-CI / low-precision studies (${localCounts.noisy} local) are excluded as noise and ${contradictedCount} contradicted extractions (${localCounts.errors} local) are quarantined so underpowered or misread estimates do not dilute the conclusion.`;
  } else if (localCounts.clean === 1) {
    status = "noise_excluded";
    badge = `Precision filter active · ${noisyExcludedCount} noisy & ${contradictedCount} contradicted records excluded`;
    summary = `${countryName} has 1 verified local finding alongside ${localCounts.noisy} noisy and ${localCounts.errors} contradicted local records; across the System Public Graph, retaining ${highPrecisionCount} high-precision trials/studies (SE <= ${DEFAULT_MAX_SE}) and ${supportingCohortCount} verified cohorts strengthens the sulfadoxine-pyrimethamine (SP) benchmark while excluding ${noisyExcludedCount} wide-CI studies as noise so underpowered estimates do not dilute precision.`;
  } else {
    status = "limited_local_evidence";
    badge = `Limited local clinical Graph studies in ${countryName} · anchored by ${cleanFindings.length} verified regional studies`;
    summary = `${countryName} has 0 high-precision local clinical sulfadoxine-pyrimethamine (SP) studies in the audited System Public Graph (${localCounts.noisy} local wide-CI noise, ${localCounts.errors} local contradicted); regional context therefore relies on ${highPrecisionCount} high-precision verified trials/studies (SE <= ${DEFAULT_MAX_SE}) and ${supportingCohortCount} verified cohorts across endemic settings, with ${noisyExcludedCount} wide-CI studies excluded as noise and ${contradictedCount} contradicted extractions quarantined.`;
  }

  const headline =
    localErrors.length > 0
      ? `Quarantining ${contradictedCount} contradicted System Public Graph extractions (${localErrors.length} in ${countryName}) prevents inverted drug arms and sextuple-haplotype mis-attributions from distorting sulfadoxine-pyrimethamine (SP) context.`
      : `Quarantining ${contradictedCount} contradicted System Public Graph extractions and ${noisyExcludedCount} wide-CI noisy records keeps ${cleanFindings.length} verified sulfadoxine-pyrimethamine (SP) and haplotype findings intact.`;

  return {
    headline,
    impactBullets: [bulletDirect, bulletRegional],
    robustnessVerdict: {
      status,
      badge,
      summary,
      highPrecisionCount,
      supportingCohortCount,
      noisyExcludedCount,
      contradictedCount,
    },
  };
}

export function buildQualityLedger(pack: ClientPack, area: string, countryName: string): QualityLedger {
  const candidates = mergePackAndAudited(pack);
  const resolvedAreaName = countryName || resolveCountryName(area, pack) || area;

  const scored = candidates.map((c) => scoreCandidate(c, area, resolvedAreaName, pack));

  const byRelevance = (a: ScoredFinding, b: ScoredFinding) => {
    const aLocal = a.countryIso3 === area ? 1 : 0;
    const bLocal = b.countryIso3 === area ? 1 : 0;
    if (aLocal !== bLocal) return bLocal - aLocal;
    if (a.fidelityScore !== b.fidelityScore) return b.fidelityScore - a.fidelityScore;
    const aPrec = a.precision ?? -1;
    const bPrec = b.precision ?? -1;
    if (aPrec !== bPrec) return bPrec - aPrec;
    return (b.year ?? 0) - (a.year ?? 0);
  };

  const byErrorPriority = (a: ScoredFinding, b: ScoredFinding) => {
    const aLocal = a.countryIso3 === area ? 1 : 0;
    const bLocal = b.countryIso3 === area ? 1 : 0;
    if (aLocal !== bLocal) return bLocal - aLocal;
    const aDirect = DIRECT_540_ERROR_IDS.has(a.systemId) || a.systemId === "PEyo2A8Ol0" ? 1 : 0;
    const bDirect = DIRECT_540_ERROR_IDS.has(b.systemId) || b.systemId === "PEyo2A8Ol0" ? 1 : 0;
    if (aDirect !== bDirect) return bDirect - aDirect;
    return (b.year ?? 0) - (a.year ?? 0);
  };

  const cleanFindings = scored
    .filter((f) => f.tier === "high_precision_trial" || f.tier === "verified_cohort")
    .sort(byRelevance);
  const noisyFindings = scored.filter((f) => f.tier === "low_precision_noise").sort(byRelevance);
  const errorFindings = scored.filter((f) => f.tier === "contradicted_error").sort(byErrorPriority);

  const funnelPoints = [...cleanFindings, ...noisyFindings, ...errorFindings].filter(
    (f) => f.logEffect !== null && f.se !== null && f.precision !== null,
  );

  const localCounts = {
    clean: cleanFindings.filter((f) => f.countryIso3 === area).length,
    noisy: noisyFindings.filter((f) => f.countryIso3 === area).length,
    errors: errorFindings.filter((f) => f.countryIso3 === area).length,
  };

  const impact = buildErrorImpact(
    area,
    resolvedAreaName,
    cleanFindings,
    noisyFindings,
    errorFindings,
    localCounts,
  );

  return {
    area,
    countryName: resolvedAreaName,
    defaultMaxSe: DEFAULT_MAX_SE,
    cleanFindings,
    noisyFindings,
    errorFindings,
    funnelPoints,
    localCounts,
    impact,
  };
}

const TRIG_TO_URL_CODE: Record<string, string> = {
  who_band: "band",
  band: "band",
  rise: "rise",
  fall: "fall",
  change: "change",
  first_detection: "first",
  first: "first",
  very_high_combo: "combo",
  combo: "combo",
};

export function buildPermalinkPath(args: {
  alertId?: string | null;
  markerUrlId: string;
  area: string;
  trig?: string;
  level?: number;
  findingId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (args.alertId && args.alertId.trim()) {
    params.set("alert", args.alertId.trim());
    return `/alert/dispatch?${params.toString()}`;
  }
  params.set("marker", args.markerUrlId);
  params.set("area", args.area);
  if (args.trig) {
    params.set("trig", TRIG_TO_URL_CODE[args.trig] ?? args.trig);
  }
  if (typeof args.level === "number" && Number.isFinite(args.level)) {
    params.set("level", String(args.level));
  }
  if (args.findingId && args.findingId.trim()) {
    params.set("finding", args.findingId.trim());
  }
  return `/alert/dispatch?${params.toString()}`;
}
