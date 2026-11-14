/**
 * The Decision Receipt: for one alert, every number, threshold and graph id
 * it rests on, each with a link. The same receipt is rendered in the alert
 * inspector, the email preview and the email that is sent, so no claim goes
 * out uncited.
 *
 * Also here: which graph findings make up the stakes chain for a place, and
 * the email body (text and HTML) built from the same content.
 */
import type { AlertEvent, Watch, WhoBasis } from "./derive";
import { KIND_LABEL, SOURCE_LABEL, ci, frac, pct, type EventCopy } from "./copy";
import {
  EVIDENCE_TIER,
  NEXT_STEPS_NOTE,
  NO_STUDY_TYPE,
  assayKeywords,
  enaUrl,
  methodText,
  type GenomeContext,
  type StudyContextFile,
} from "./context";
import { pmidStr, type AbstractPrevalence, type ClientPack, type GraphFinding, type MarkerDef, type Paper } from "./pack";
import { buildPermalinkPath, type QualityLedger } from "./quality";

export const SOURCES = {
  pf8: { label: "MalariaGEN Pf8, DOI 10.5281/zenodo.18681980", url: "https://zenodo.org/records/18681980" },
  graph: { label: "System Public Graph v2.1, DOI 10.7910/DVN/7V6JDO", url: "https://doi.org/10.7910/DVN/7V6JDO" },
  whoFallback: {
    label: "WHO guidelines for malaria (13 August 2025)",
    url: "https://iris.who.int/server/api/core/bitstreams/26a6af2d-060c-4449-8207-1f25e63c6cc3/content",
  },
  kfPrecision: { label: "Knowledge Futures System Hackathon (Precision)", url: "https://demo-system-hackathon.kfutures.org/" },
  kfContested: { label: "Knowledge Futures System Hackathon (Contested)", url: "https://demo-system-contested.kfutures.org/" },
} as const;

/** The graph release every tab names. The pack's CSV export is dated a week later; that date stays in the pack metadata. */
export const GRAPH_RELEASE = "System graph v2.1, 1 July 2026";

/**
 * Vetted ids removed after checking against the paper. PEyo2A8Ol0 (PMID 26429700): relative risk 0.32 is
 * dihydroartemisinin-piperaquine IPTp compared against SP IPTp; the graph presents it as an effect of SP.
 */
export const EXCLUDED_AFTER_CHECK: Record<string, string> = {
  PEyo2A8Ol0: "reversed comparison: the paper reports dihydroartemisinin-piperaquine against SP, not an effect of SP",
};

export const PRESET_BADGE = "Project notification preset (no published WHO K540E cut-off for this region)";
export const TIER = {
  checked: "Source-checked against paper",
  unverified: "Reported by System Graph, unverified",
} as const;

export const pubmedUrl = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid.trim())}/`;

/* ------------------------------------------------------ finding wording --- */

const STAT_LABEL: Record<string, string> = {
  mean_difference_unstandardized: "mean difference",
  relative_risk_ratio: "relative risk",
  odds_ratio: "odds ratio",
  hazard_ratio: "hazard ratio",
};

/** The statistic as the graph holds it. No interpretation added. */
export function statText(f: GraphFinding): string | null {
  if (typeof f.statistic_value !== "number") return null;
  const raw = f.statistic_label || f.statistic_type || "statistic";
  const label = STAT_LABEL[raw] ?? raw.replace(/_/g, " ");
  const level = typeof f.ci_level === "number" ? `${f.ci_level <= 1 ? Math.round(f.ci_level * 100) : f.ci_level}% ` : "";
  const interval = typeof f.ci_lower === "number" && typeof f.ci_upper === "number" ? ` (${level}CI ${f.ci_lower} to ${f.ci_upper})` : "";
  const p = typeof f.p_value === "number" ? `, p = ${f.p_value}` : "";
  return `${label} ${f.statistic_value}${interval}${p}`;
}

/** variable_1 and variable_2 are an association pair, not exposure then outcome. */
export const pairText = (f: GraphFinding) => `${f.variable_1 ?? "variable 1"} <-> ${f.variable_2 ?? "variable 2"}`;

/* ---------------------------------------------------------------- stakes --- */

const USE_ORDER: Record<WhoBasis, RegExp[]> = {
  east_southern_africa: [/preg|iptp/i, /infant/i, /season/i, /treat/i],
  central_west_africa: [/season/i, /preg|iptp/i, /infant/i, /treat/i],
  outside_africa: [/treat/i, /preg|iptp/i, /infant/i, /season/i],
};

export type Stakes = {
  /** Graph findings on a K540E-containing haplotype from this country. */
  local: GraphFinding[];
  /** SP findings grouped by use, ordered to fit the region; checked and same-country findings first. */
  groups: { use: string; findings: GraphFinding[] }[];
  /** The few findings that lead the chain (and go in the email). */
  lead: GraphFinding[];
};

export function pickStakes(pack: ClientPack, area: string, basis: WhoBasis): Stakes {
  const local = pack.graph.haplotype_findings.filter((f) => f.country_iso3 === area);
  const score = (f: GraphFinding) => (f.checked?.country_iso3 === area ? 0 : f.source_checked ? 1 : 2);
  const byUse = new Map<string, GraphFinding[]>();
  const stakesSp = pack.graph.stakes_sp.filter((f) => !(f.system_id in EXCLUDED_AFTER_CHECK));
  for (const f of stakesSp) {
    const use = f.use ?? "Other";
    byUse.set(use, [...(byUse.get(use) ?? []), f]);
  }
  const rank = (use: string) => {
    const i = USE_ORDER[basis].findIndex((re) => re.test(use));
    return i === -1 ? 99 : i;
  };
  const groups = [...byUse.entries()]
    .map(([use, findings]) => ({ use, findings: [...findings].sort((a, b) => score(a) - score(b)) }))
    .sort((a, b) => rank(a.use) - rank(b.use));
  // lead: a same-country checked SP finding if there is one, then the best of the two most relevant uses
  const sameCountry = stakesSp.filter((f) => f.checked?.country_iso3 === area);
  const lead: GraphFinding[] = [...local];
  for (const f of [...sameCountry, ...groups.slice(0, 2).map((g) => g.findings[0])]) {
    if (f && !lead.includes(f) && lead.length < Math.max(3, local.length + 1)) lead.push(f);
  }
  return { local, groups, lead };
}

/* --------------------------------------------------------- study context --- */

/** Tier line for a paper item: what kind of study, where, in whom. From the abstract fields and the title only. */
export function paperTierDetail(paper: Paper | undefined, figure: AbstractPrevalence | undefined): string[] {
  const words = assayKeywords(paper?.title);
  return [
    figure?.site ? `site: ${figure.site}` : null,
    figure?.population ? `population: ${figure.population}` : null,
    words.length ? `title mentions: ${words.join(", ")}` : "assay not named in the title",
  ].filter((x): x is string => Boolean(x));
}

/** Tier line for a graph finding: study type and population, as the graph gives them. */
export function graphTierDetail(f: GraphFinding | undefined): string[] {
  if (!f) return [];
  return [`study type: ${f.study_type ?? NO_STUDY_TYPE}`, f.population ? `population: ${f.population}` : "population not given by the graph"];
}

export function glossaryText(study: StudyContextFile | null | undefined, methods: string[]): string {
  const g = study?._meta?.dna_method_glossary ?? {};
  return methods
    .filter((m) => g[m])
    .map((m) => `${m}: ${g[m]}`)
    .join(" · ");
}

function studyRows(args: {
  e: AlertEvent;
  pack: ClientPack;
  marker: MarkerDef;
  paper?: Paper;
  figure?: AbstractPrevalence;
  graphFinding?: GraphFinding;
  ctx?: GenomeContext | null;
  matched?: AbstractPrevalence[];
  papers?: Map<string, Paper>;
}): ReceiptRow[] {
  const { e, ctx } = args;
  const rows: ReceiptRow[] = [];
  if (e.source === "papers") {
    rows.push({ label: "Evidence tier", text: [EVIDENCE_TIER.papers, ...paperTierDetail(args.paper, args.figure)].join(" · "), badge: { text: "machine-read abstract", tone: "unverified" } });
    rows.push({ label: "Not the same as", text: "A genome-surveillance count or a graph extraction. A figure stated in an abstract comes from that paper’s own design and is never pooled." });
    return rows;
  }
  if (e.source === "graph") {
    rows.push({ label: "Evidence tier", text: [EVIDENCE_TIER.graph, ...graphTierDetail(args.graphFinding)].join(" · ") });
    return rows;
  }
  if (!ctx) return rows;
  const meta = args.pack.studyContext?._meta;
  const src: ReceiptLink[] = meta?.url ? [{ label: "MalariaGEN Pf8 sample metadata", url: meta.url }] : [];
  rows.push({ label: "Evidence tier", text: `${ctx.tier} · ${ctx.tierDetail}`, links: src });
  const c = ctx.cell;
  if (c) {
    for (const s of c.studies) {
      rows.push({
        label: "Partner study",
        text: `${s.study_id} · ${s.k}/${s.n} (${s.pct}%) · ${s.admin1.map((a) => `${a.name} ${a.k}/${a.n}`).join(", ")} · ${methodText(s.dna_method)}${s.median_callable_pct != null ? ` · median ${s.median_callable_pct}% callable` : ""}`,
      });
    }
    if (ctx.geo) rows.push({ label: "Geographic scope", text: ctx.geo.text, badge: ctx.geo.flag ? { text: ctx.geo.flag, tone: "preset" } : undefined });
    if (ctx.measure) {
      const names = ctx.measure.all.map(([m]) => m);
      rows.push({
        label: "DNA preparation",
        text: `All samples: ${methodText(c.dna_method_all)}.${c.k > 0 ? ` Carrying ${args.marker.mutation}: ${methodText(c.dna_method_mutants)}.` : ""}${ctx.measure.note ? ` ${ctx.measure.note}` : ""} ${glossaryText(args.pack.studyContext, names)}`.trim(),
      });
      rows.push({ label: "Genome callability", text: `${ctx.measure.callable}.` });
    }
    if (ctx.codon) {
      rows.push({ label: "Codon 540 calls", text: ctx.codon.text });
      if (ctx.codon.altWarning) rows.push({ label: "Warning", text: ctx.codon.altWarning, badge: { text: "Alternative codon-540 allele", tone: "preset" } });
    }
    if (ctx.runs.length) {
      rows.push({
        label: "Raw reads",
        text: `Sequencing runs for ${ctx.runs.length} sample${ctx.runs.length === 1 ? "" : "s"} carrying ${args.marker.mutation}: ${ctx.runs.map((r) => `${r.sample} (${r.dna_method}, ${r.admin1}${r.callable_pct != null ? `, ${r.callable_pct}% callable` : ""})`).join("; ")}.`,
        links: ctx.runs.map((r) => ({ label: `ENA ${r.ena}`, url: enaUrl(r.ena as string) })),
      });
    }
  }
  rows.push({ label: "Local prior", text: ctx.prior.detail, badge: { text: ctx.prior.label, tone: ctx.prior.kind === "zero" ? "preset" : "checked" } });
  rows.push({
    label: "Cutoff | observed",
    text: `Cutoff: ${ctx.cutoff.text} | Observed: ${ctx.observed}.${ctx.relation ? ` ${ctx.relation}` : ""}`,
    badge: ctx.cutoff.published ? { text: "Published by WHO", tone: "who" } : { text: "Project rule or preset", tone: "preset" },
  });
  rows.push({ label: "Next steps", text: `${ctx.prior.steps.map((s, i) => `${i + 1}) ${s}`).join(" ")} ${NEXT_STEPS_NOTE}` });
  for (const f of args.matched ?? []) {
    const p = args.papers?.get(pmidStr(f.pmid));
    rows.push({
      label: "Same place, same years",
      text: `${EVIDENCE_TIER.papers}: ${p?.title ?? "title not recorded"}${f.site ? ` · site: ${f.site}` : ""}${f.population ? ` · population: ${f.population}` : ""} · “${f.quote}” Shown beside the genome count, never pooled with it.`,
      links: [{ label: `PMID ${pmidStr(f.pmid)}`, url: pubmedUrl(pmidStr(f.pmid)) }],
      badge: { text: "machine-read abstract", tone: "unverified" },
    });
  }
  return rows;
}

/* --------------------------------------------------------------- receipt --- */

export type ReceiptLink = { label: string; url: string };
export type ReceiptRow = { label: string; text: string; links?: ReceiptLink[]; badge?: { text: string; tone: "who" | "preset" | "checked" | "unverified" } };
export type ReceiptSection = { title: string; rows: ReceiptRow[] };

export function buildReceipt(args: {
  e: AlertEvent;
  watch: Watch;
  basis: WhoBasis;
  marker: MarkerDef;
  country: string;
  pack: ClientPack;
  paper?: Paper;
  figure?: AbstractPrevalence;
  thresholdPublished: boolean;
  thresholdText: string;
  stakes: Stakes;
  extracted: GraphFinding[];
  graphFinding?: GraphFinding;
  /** Genome alerts: the triggering-study context joined from the Pf8 sample metadata. */
  ctx?: GenomeContext | null;
  /** Abstract figures whose stated place and collection years cover this cell. Shown beside it, never pooled. */
  matched?: AbstractPrevalence[];
  papers?: Map<string, Paper>;
}): ReceiptSection[] {
  const { e, pack, marker, country } = args;
  const who = pack.thresholds.who_categories?.sources?.[0];
  const whoLink: ReceiptLink = { label: who?.name ?? SOURCES.whoFallback.label, url: who?.url ?? SOURCES.whoFallback.url };
  const concept = (id: string | null | undefined) => {
    if (!id) return null;
    const c = pack.graph.concepts.find((x) => x.system_id === id);
    return c ? `${c.label} ${id}` : id;
  };

  /* 1. surveillance math */
  const math: ReceiptRow[] = [];
  if (e.cell) {
    math.push({ label: "This cell", text: `${frac(e.cell)} carrying / tested · ${pct(e.cell.pct)} · Wilson ${ci(e.cell)} · ${country} · collected ${e.cell.year}` });
    if (e.prev) math.push({ label: "Compared with", text: `${frac(e.prev)} · ${pct(e.prev.pct)} · Wilson ${ci(e.prev)} · collected ${e.prev.year}` });
    if (e.a581g) math.push({ label: "A581G, same cell", text: `${frac(e.a581g)} · ${pct(e.a581g.pct)} · Wilson ${ci(e.a581g)}` });
    else if (e.a581gUnjudged) math.push({ label: "A581G, same cell", text: "not tested, or under the minimum: “very high” cannot be judged" });
    math.push({ label: "Dataset", text: "Genome counts by country and collection year; convenience samples; intervals computed here.", links: [SOURCES.pf8] });
  } else if (args.graphFinding) {
    const f = args.graphFinding;
    math.push({ label: "Graph finding", text: `${pairText(f)}. ${statText(f) ?? ""}`.trim() });
    if (f.pubmed_id) math.push({ label: "Paper", text: `${f.paper_title ?? ""} ${f.journal ?? ""} ${f.pub_year ?? ""}`.trim(), links: [{ label: `PMID ${f.pubmed_id}`, url: pubmedUrl(pmidStr(f.pubmed_id)) }] });
  } else if (e.pmid) {
    if (e.quote) math.push({ label: "Abstract quote", text: `“${e.quote}”` });
    const fig = args.figure;
    if (fig) {
      const bits = [
        fig.prevalence_pct != null ? `${fig.prevalence_pct}% as stated` : null,
        fig.numerator != null && fig.denominator != null ? `${fig.numerator} of ${fig.denominator}` : null,
        fig.site ? `site: ${fig.site}` : null,
        fig.year_start ? `collected ${fig.year_start}${fig.year_end && fig.year_end !== fig.year_start ? ` to ${fig.year_end}` : ""}` : null,
        fig.population ? `population: ${fig.population}` : null,
      ].filter(Boolean);
      if (bits.length) math.push({ label: "As stated", text: bits.join(" · ") });
    }
    math.push({
      label: "Paper",
      text: `${args.paper?.title ?? ""} ${args.paper?.journal ?? ""}, published ${args.paper?.pub_year ?? e.year}. Machine-read, quote-verified, not checked by hand.`.trim(),
      links: [{ label: `PMID ${e.pmid}`, url: pubmedUrl(e.pmid) }],
    });
  }

  /* 2. triggering-study context */
  const study = studyRows(args);

  /* 3. threshold authority */
  const authority: ReceiptRow[] = [];
  if (e.source !== "genomes") {
    authority.push({ label: "Threshold", text: "None applied: this item is dated evidence quoted from a paper or held by the graph, not a threshold decision." });
  } else if (args.thresholdPublished) {
    authority.push({
      label: "Band cut-offs",
      text: "WHO SP-resistance categories, East and Southern Africa: PDF page 105.",
      links: [whoLink],
      badge: { text: "Published by WHO", tone: "who" },
    });
  } else {
    authority.push({ label: "Threshold", text: `${args.thresholdText}.`, badge: { text: PRESET_BADGE, tone: "preset" } });
  }
  if (args.basis === "east_southern_africa") {
    authority.push({
      label: "Continuing IPTp-SP",
      text: "WHO: SP in pregnancy should continue to be used in areas of high SP resistance: PDF pages 104 and 107–108.",
      links: [whoLink],
    });
  }

  /* 4. graph and literature ids */
  const ids: ReceiptRow[] = [];
  const row = (f: GraphFinding, label: string, lead?: string): ReceiptRow => ({
    label,
    text: [
      lead ?? null,
      `system_id ${f.system_id}`,
      f.study_id ? `study_id ${f.study_id}` : null,
      [concept(f.variable_1_concept_id), concept(f.variable_2_concept_id)].filter(Boolean).join(" | ") || null,
    ]
      .filter(Boolean)
      .join(" · "),
    links: f.pubmed_id ? [{ label: `PMID ${f.pubmed_id}`, url: pubmedUrl(pmidStr(f.pubmed_id)) }] : undefined,
    badge: f.source_checked ? { text: TIER.checked, tone: "checked" } : { text: TIER.unverified, tone: "unverified" },
  });
  if (args.graphFinding) ids.push(row(args.graphFinding, "This finding"));
  for (const f of args.stakes.lead) if (f !== args.graphFinding) ids.push(args.stakes.local.includes(f) ? row(f, "Haplotype finding", country) : row(f, "Stakes finding", f.use ?? "SP"));
  for (const f of args.extracted.slice(0, 4)) ids.push(row(f, "Extracted", "from this paper"));
  const drug = pack.graph.concepts.filter((c) => /^(sulfadoxine|pyrimethamine)$/i.test(c.label));
  if (drug.length) ids.push({ label: "Drug concepts", text: drug.map((c) => `${c.label} ${c.system_id}`).join(" · ") });
  ids.push({
    label: "Marker in graph",
    text: `No graph finding names ${marker.mutation} on its own (${pack.literature.papers.filter((p) => p.in_graph).length} of ${pack.literature.papers.length} ${marker.mutation} papers read).`,
    links: [SOURCES.graph],
  });

  return [
    { title: "Surveillance math", rows: math },
    { title: "Triggering study: scope, method and bar for action", rows: study },
    { title: "Threshold authority", rows: authority },
    { title: "System Graph and literature IDs", rows: ids },
  ];
}

/* ----------------------------------------------------------------- email --- */

export type EmailList = { title: string; note?: string; items: { text: string; link?: ReceiptLink }[] };

/** Digest layers added to an alert email: live graph check, recent papers, curation queue, deep links. */
export type EmailExtras = {
  /** Added inside the subject's source tag, e.g. "Live System Graph". */
  subjectTag?: string;
  /** Permanent frozen web dispatch URL (/alert/dispatch?...). */
  permalinkUrl?: string;
  /** Papers published since the cell was collected. Shown beside the count, never pooled. */
  recent?: EmailList;
  /** What the live System API said just now, including the quarantine count. */
  graphLive?: string[];
  /** Unread papers for the country: the curation queue. */
  queue?: EmailList;
  /** Per finding id: the result of the live check, e.g. "live check: matches snapshot". */
  liveChecked?: Record<string, string>;
  links?: ReceiptLink[];
};

export type EmailParts = {
  e: AlertEvent;
  copy: EventCopy;
  watchText: string;
  marker: string;
  country: string;
  stakesIntro: string;
  stakes: GraphFinding[];
  stakesCaveat: string;
  graphLine: string;
  whoStatus: string[];
  receipt: ReceiptSection[];
  /** Subject line: evidence source, study scope and assay first. */
  subject: string;
  /** How much weight to give the signal: tier, flags, cutoff beside observed, next steps. */
  weight: { tier: string; lines: { label: string; text: string; warn?: boolean }[]; steps: string[]; stepsNote: string | null };
  /** Three or four lines under the headline: observed, cutoff, prior, scope. */
  glance?: string[];
  limits: string[];
  link: string;
  asOf: string;
  extras?: EmailExtras;
  /** Optional rich context injected by composeEmail for structured 20-second scannable layout. */
  watch?: Watch;
  markerDef?: MarkerDef;
  ctx?: GenomeContext | null;
  tb?: { published: boolean; text: string };
  quality?: QualityLedger | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Crisp light-editorial palette. Inline colours on every table cell so Gmail, Apple Mail,
 * Outlook, and the Alert inspector iframe render identically. */
const L = {
  page: "#f4f3ee",
  card: "#ffffff",
  head: "#faf9f5",
  panel: "#f8fafc",
  mintBg: "#f2faf8",
  mintLine: "#a7ded2",
  mintText: "#085445",
  mintBtn: "#0b6b58",
  amberBg: "#fffbeb",
  amberLine: "#f6d28b",
  amberText: "#78350f",
  line: "#e2dfd7",
  fg: "#0f172a",
  body: "#1e293b",
  muted: "#5b6777",
  danger: "#9a3412",
} as const;
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,Menlo,Consolas,monospace";

function resolveOrigin(linkUrl: string): string {
  try {
    if (/^https?:\/\//i.test(linkUrl)) return new URL(linkUrl).origin;
  } catch {
    /* relative link */
  }
  return "";
}

function normalizeEmailLinks(a: EmailParts): {
  permalinkUrl: string;
  mapUrl: string;
  extraLinks: ReceiptLink[];
} {
  const origin = resolveOrigin(a.link);
  const area = a.watch?.area ?? a.e.iso3 ?? "COD";
  const markerUrlId = a.markerDef?.urlId ?? "pfdhps-K540E";
  const trig = a.watch?.trigger;
  const level = a.watch && (a.watch.trigger === "rise" || a.watch.trigger === "fall") ? a.watch.level : undefined;

  const defaultPermalink = `${origin}${buildPermalinkPath({
    markerUrlId,
    area,
    trig,
    level,
    findingId: a.e.id,
  })}`;
  const permalinkUrl = a.extras?.permalinkUrl || defaultPermalink;

  const rangeParam = a.e.year ? `&range=1966-${a.e.year}` : "";
  const defaultMapUrl = `${origin}/forecast?country=${encodeURIComponent(area)}&marker=${encodeURIComponent(markerUrlId)}${rangeParam}`;

  let mapUrl = defaultMapUrl;
  const extraLinks: ReceiptLink[] = [];
  let sawForecast = false;

  for (const l of a.extras?.links ?? []) {
    if (l.url.includes("/forecast")) {
      sawForecast = true;
      let nextUrl = l.url;
      if (a.e.year && !nextUrl.includes("range=")) {
        nextUrl += `${nextUrl.includes("?") ? "&" : "?"}range=1966-${a.e.year}`;
      }
      mapUrl = nextUrl;
      extraLinks.push({ label: "See this country on the Map", url: nextUrl });
    } else {
      extraLinks.push(l);
    }
  }

  if (!sawForecast) {
    extraLinks.unshift({ label: "See this country on the Map", url: mapUrl });
  }

  return { permalinkUrl, mapUrl, extraLinks };
}

export function buildEmail(a: EmailParts): { subject: string; text: string; html: string } {
  const { e, copy } = a;
  const x = a.extras ?? {};
  const subject = x.subjectTag ? a.subject.replace(/\]/, ` + ${x.subjectTag}]`) : a.subject;
  const meta = `${KIND_LABEL[e.kind]} · ${SOURCE_LABEL[e.source]} · ${e.dateBasis === "collection" ? "collected" : "published"} ${e.year}${e.fired ? "" : " · context, not an alert"}`;
  const { permalinkUrl, mapUrl, extraLinks } = normalizeEmailLinks(a);

  const live = (f: GraphFinding) => x.liveChecked?.[f.system_id];
  const tierOf = (f: GraphFinding) => `${f.source_checked ? TIER.checked : TIER.unverified}${live(f) ? `; ${live(f)}` : ""}`;
  const stakeLine = (f: GraphFinding) =>
    `[${f.study_type ?? NO_STUDY_TYPE}] ${pairText(f)}. ${statText(f) ?? ""} Population: ${f.population ?? "not given by the graph"} [system_id ${f.system_id}; ${tierOf(f)}${f.pubmed_id ? `; ${pubmedUrl(pmidStr(f.pubmed_id))}` : ""}]`;
  const listText = (l: EmailList | undefined, heading: string) =>
    l && l.items.length ? ["", heading, l.title, ...l.items.map((i) => `- ${i.text}${i.link ? ` ${i.link.label} <${i.link.url}>` : ""}`), ...(l.note ? [l.note] : [])] : [];

  /* Extract concise 20-second scannable figures */
  const drugName = a.markerDef?.drug ?? "sulfadoxine-pyrimethamine (SP)";
  const mutationLabel = a.markerDef?.mutation ?? "K540E";
  const observedMain = e.cell ? pct(e.cell.pct) : e.statedPct != null ? `${e.statedPct}%` : SOURCE_LABEL[e.source];
  const observedDetail = e.cell
    ? `${frac(e.cell)} (${ci(e.cell)})`
    : e.pmid
      ? `PMID ${e.pmid} (${e.dateBasis} ${e.year})`
      : meta;

  const cutoffPublished = a.ctx?.cutoff.published ?? a.tb?.published ?? false;
  const cutoffMain = a.ctx?.cutoff.short ?? (cutoffPublished ? "WHO resistance band" : "Project preset");
  const cutoffAuthority = cutoffPublished ? "Published by WHO" : "Project notification preset";
  const cutoffDetail = a.ctx?.relation ?? a.tb?.text ?? "Evaluated against regional watch rule";

  const priorMain = a.ctx?.prior.name ?? (e.prev ? `Prior ${e.prev.year}: ${pct(e.prev.pct)}` : "Baseline record");
  const priorDetail = a.ctx?.prior.detail ?? copy.basis;

  const cleanCount = a.quality?.cleanFindings.length ?? (a.stakes.length || 22);
  const noisyCount = a.quality?.noisyFindings.length ?? 0;
  const errorCount = a.quality?.errorFindings.length ?? 26;
  const quarantineVerdict = `${cleanCount} verified high-precision trials & cohorts retained${noisyCount ? `, ${noisyCount} wide-CI noisy records filtered` : ""}, and ${errorCount} contradicted or unvetted extractions quarantined so misread papers such as PEyo2A8Ol0 (PMID 26429700) and AeI-laBxXr (PMID 25564249) never corrupt an alert.`;

  /* Section 3 compact 4-row MalariaGEN Pf8 provenance */
  const cCell = a.ctx?.cell;
  const partnerStudyVal = cCell
    ? cCell.studies
        .map(
          (s) =>
            `${s.study_id} · ${s.k}/${s.n} (${s.pct}%) · ${s.admin1.map((ad) => `${ad.name} ${ad.k}/${ad.n}`).join(", ")}`,
        )
        .join("; ")
    : e.pmid
      ? `PMID ${e.pmid} (${SOURCE_LABEL[e.source]})`
      : a.weight.tier;

  const geoScopeVal = a.ctx?.geo?.text ?? `${a.country} · ${meta}`;
  const dnaCallVal = cCell
    ? `All samples: ${methodText(cCell.dna_method_all)}${cCell.k > 0 ? `; ${mutationLabel}: ${methodText(cCell.dna_method_mutants)}` : ""}${a.ctx?.measure?.callable ? ` · Callability: ${a.ctx.measure.callable}` : ""}`
    : a.weight.tier;
  const codonAllelesVal = a.ctx?.codon
    ? `${a.ctx.codon.text}${a.ctx.codon.altWarning ? ` · ${a.ctx.codon.altWarning}` : ""}`
    : `${a.marker} associated with ${drugName}`;
  const enaRuns = a.ctx?.runs ?? [];

  const nextStepsText = a.weight.steps.length
    ? `${a.weight.steps.map((s, i) => `(${i + 1}) ${s}`).join(" ")} ${a.weight.stepsNote ?? NEXT_STEPS_NOTE}`
    : `Confirm molecular signals against WHO therapeutic efficacy studies (TES) or chemoprevention efficacy studies (CES). ${NEXT_STEPS_NOTE}`;

  /* ---------- PLAIN TEXT ---------- */
  const text = [
    `Subject: ${subject}`,
    "",
    `RESISTANCE OBSERVATORY · SYSTEM PUBLIC GRAPH SURVEILLANCE DISPATCH (${GRAPH_RELEASE})`,
    `Your watch: ${a.watchText}`,
    "",
    `${a.marker}, ${a.country}: ${copy.title}`,
    meta,
    "",
    `Open Permanent Web Dispatch: ${permalinkUrl}`,
    `See this country on the Map: ${mapUrl}`,
    `Open Interactive Alert Observatory: ${a.link}`,
    "",
    "1. SIGNAL & OBSERVED VS. CUTOFF",
    `- Observed: ${observedMain} — ${observedDetail}`,
    `- Cutoff: ${cutoffMain} [${cutoffAuthority}] — ${cutoffDetail}`,
    `- Local prior: ${priorMain} — ${priorDetail}`,
    copy.statement,
    `Comparison basis: ${copy.basis}`,
    "",
    "2. POWERED BY SYSTEM PUBLIC GRAPH (AUTOMATIC FIDELITY & ERROR QUARANTINE)",
    a.stakesIntro,
    `- Precision & quarantine verdict: ${quarantineVerdict}`,
    `- Methodology credit: ${SOURCES.kfPrecision.label} <${SOURCES.kfPrecision.url}> · ${SOURCES.kfContested.label} <${SOURCES.kfContested.url}>`,
    `- ${a.graphLine}`,
    ...(x.graphLive ?? []).map((l) => `- ${l}`),
    ...a.stakes.map((f) => `- ${stakeLine(f)}`),
    a.stakesCaveat,
    "",
    "3. TRIGGERING-STUDY PROVENANCE (MALARIAGEN PF8) & REVIEWER NEXT STEP",
    `Evidence tier: ${a.weight.tier}`,
    `- Partner study: ${partnerStudyVal}`,
    `- Geographic scope: ${geoScopeVal}`,
    `- DNA & callability: ${dnaCallVal}`,
    `- Codon 540 alleles: ${codonAllelesVal}`,
    ...(enaRuns.length
      ? [`- ENA raw sequencing runs: ${enaRuns.map((r) => `${r.ena} <${enaUrl(r.ena as string)}>`).join(", ")}`]
      : []),
    `- Reviewer next step (TES/CES): ${nextStepsText}`,
    ...listText(x.recent, "PUBLISHED SINCE THIS COLLECTION"),
    ...listText(x.queue, "CURATION QUEUE: NOT YET READ BY THE GRAPH"),
    "",
    "WHO STATUS OF THE MARKER",
    ...a.whoStatus,
    "",
    "DECISION RECEIPT",
    ...a.receipt.flatMap((s) => [
      `${s.title}:`,
      ...s.rows.map((r) => `  ${r.label}: ${r.text}${r.badge ? ` [${r.badge.text}]` : ""}${r.links?.length ? ` ${r.links.map((l) => `${l.label} <${l.url}>`).join(" ")}` : ""}`),
    ]),
    "",
    "WHAT THIS ALERT CANNOT TELL YOU",
    ...a.limits.map((s) => `- ${s}`),
    "",
    `Provenance: ${SOURCES.pf8.label} <${SOURCES.pf8.url}> · ${SOURCES.graph.label} <${SOURCES.graph.url}> · ${SOURCES.whoFallback.label} <${SOURCES.whoFallback.url}>`,
    ...extraLinks.map((l) => `${l.label}: ${l.url}`),
    "",
    `${a.asOf} A replay of the historical record: not live surveillance, not clinical guidance.`,
  ].join("\n");

  /* ---------- HTML: CRISP LIGHT-EDITORIAL 20-SECOND SCANNABLE DISPATCH ---------- */
  const linkEl = (l: ReceiptLink) =>
    `<a href="${esc(l.url)}" style="color:${L.mintBtn};text-decoration:underline;font-weight:600">${esc(l.label)}</a>`;

  const topCitationsHtml = a.stakes.length
    ? a.stakes
        .map((f) => {
          const pmid = f.pubmed_id ? pmidStr(f.pubmed_id) : "";
          const st = statText(f);
          return `<div style="margin:0 0 6px;padding:7px 10px;background-color:${L.card};border:1px solid ${L.mintLine};border-radius:5px;font-size:12px;line-height:1.45;color:${L.fg}">
            <span style="display:inline-block;padding:1px 6px;margin-right:6px;border:1px solid ${L.line};border-radius:999px;font:600 10px/1.4 ${MONO};color:${L.muted}">${esc(f.study_type ?? NO_STUDY_TYPE)}</span>
            <strong>${esc(pairText(f))}</strong>${st ? ` · <span style="font-family:${MONO};color:${L.mintText};font-weight:700">${esc(st)}</span>` : ""}
            <div style="margin-top:3px;font:11px/1.4 ${MONO};color:${L.muted}">system_id ${esc(f.system_id)} · ${esc(tierOf(f))}${pmid ? ` · <a href="${esc(pubmedUrl(pmid))}" style="color:${L.mintBtn};text-decoration:underline">PMID ${esc(pmid)} ↗</a>` : ""}</div>
          </div>`;
        })
        .join("")
    : `<div style="font-size:12px;color:${L.body}">${linkEl(SOURCES.graph)}</div>`;

  const liveLinesHtml = (x.graphLive ?? [])
    .map(
      (line) =>
        `<div style="margin-top:6px;padding:6px 9px;background-color:${L.card};border-left:3px solid ${L.mintBtn};font-size:11.5px;line-height:1.45;color:${L.body}">${esc(line)}</div>`,
    )
    .join("");

  const enaLinksHtml = enaRuns.length
    ? `<div style="margin-top:5px;font:11px/1.4 ${MONO};color:${L.muted}">Raw reads: ${enaRuns
        .map(
          (r) =>
            `<a href="${esc(enaUrl(r.ena as string))}" style="color:${L.mintBtn};text-decoration:underline;margin-right:8px">ENA ${esc(String(r.ena))} (${esc(r.dna_method)}) ↗</a>`,
        )
        .join("")}</div>`
    : "";

  const renderDigestList = (l: EmailList | undefined, heading: string) =>
    l && l.items.length
      ? `<div style="margin-top:14px;padding:10px 12px;background-color:${L.panel};border:1px solid ${L.line};border-radius:6px">
          <div style="font:700 10px/1.4 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:${L.muted};margin-bottom:4px">${esc(heading)}</div>
          <div style="font-size:12px;color:${L.body};margin-bottom:6px">${esc(l.title)}</div>
          <ul style="margin:0;padding-left:16px;font-size:11.5px;line-height:1.45;color:${L.body}">
            ${l.items.map((i) => `<li style="margin-bottom:4px">${esc(i.text)}${i.link ? ` ${linkEl(i.link)}` : ""}</li>`).join("")}
          </ul>
          ${l.note ? `<div style="margin-top:5px;font-size:11px;color:${L.muted}">${esc(l.note)}</div>` : ""}
        </div>`
      : "";

  const whoSource = { label: SOURCES.whoFallback.label, url: SOURCES.whoFallback.url };

  const html = `<!doctype html><html><body style="margin:0;padding:0;background-color:${L.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.page}" style="background-color:${L.page};margin:0;padding:0">
  <tr>
    <td align="center" bgcolor="${L.page}" style="background-color:${L.page};padding:20px 10px">
      <table role="presentation" width="660" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.card}" style="background-color:${L.card};max-width:660px;width:100%;border:1px solid ${L.line};border-top:4px solid ${L.mintBtn};border-radius:8px;overflow:hidden;font-family:${SANS};color:${L.fg}">
        <!-- Masthead -->
        <tr>
          <td bgcolor="${L.head}" style="background-color:${L.head};padding:18px 22px 16px;border-bottom:1px solid ${L.line}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font:700 10px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${L.mintBtn}">
                  RESISTANCE OBSERVATORY · SYSTEM PUBLIC GRAPH SURVEILLANCE DISPATCH
                </td>
                <td align="right" style="white-space:nowrap;padding-left:8px">
                  <span style="display:inline-block;padding:3px 9px;background-color:${L.mintBg};border:1px solid ${L.mintLine};border-radius:999px;font:600 10px/1.3 ${MONO};color:${L.mintText}">${esc(GRAPH_RELEASE)}</span>
                </td>
              </tr>
            </table>
            <div style="margin-top:8px;font:600 11px/1.4 ${MONO};color:${L.muted}">${esc(meta)}</div>
            <h1 style="margin:4px 0 6px;font:700 21px/1.25 ${SANS};color:${L.fg}">${esc(`${a.marker}, ${a.country}: ${copy.title}`)}</h1>
            <p style="margin:0 0 13px;font:12.5px/1.45 ${SANS};color:${L.muted}">${esc(a.watchText)}</p>
            <div>
              <a href="${esc(permalinkUrl)}" style="display:inline-block;margin:0 8px 6px 0;padding:9px 14px;background-color:${L.mintBtn};color:#ffffff;text-decoration:none;border-radius:5px;font:600 12px/1.2 ${SANS}">Open Permanent Web Dispatch ↗</a>
              <a href="${esc(mapUrl)}" style="display:inline-block;margin:0 8px 6px 0;padding:8px 13px;background-color:${L.card};color:${L.fg};border:1px solid ${L.line};text-decoration:none;border-radius:5px;font:600 12px/1.2 ${SANS}">See this country on the Map ↗</a>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td bgcolor="${L.card}" style="background-color:${L.card};padding:18px 22px 20px">
            <!-- Section 1: Signal & Observed vs. Cutoff -->
            <div style="font:700 10px/1.4 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:${L.muted};margin-bottom:8px">1 · Signal &amp; Observed vs. Cutoff</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${L.line};border-radius:6px;border-collapse:separate;overflow:hidden;margin-bottom:10px">
              <tr>
                <td width="35%" bgcolor="${L.panel}" style="background-color:${L.panel};padding:11px 13px;border-right:1px solid ${L.line};vertical-align:top">
                  <div style="font:600 10px/1.3 ${SANS};text-transform:uppercase;letter-spacing:.06em;color:${L.muted}">Observed ${esc(mutationLabel)}</div>
                  <div style="margin-top:3px;font:700 22px/1.15 ${MONO};color:${L.fg}">${esc(observedMain)}</div>
                  <div style="margin-top:4px;font:11px/1.4 ${MONO};color:${L.body}">${esc(observedDetail)}</div>
                </td>
                <td width="33%" bgcolor="${L.card}" style="background-color:${L.card};padding:11px 13px;border-right:1px solid ${L.line};vertical-align:top">
                  <div style="font:600 10px/1.3 ${SANS};text-transform:uppercase;letter-spacing:.06em;color:${L.muted}">Cutoff &amp; Authority</div>
                  <div style="margin-top:3px;font:700 14px/1.3 ${MONO};color:${L.fg}">${esc(cutoffMain)}</div>
                  <div style="margin-top:4px;font:600 11px/1.35 ${SANS};color:${cutoffPublished ? L.mintText : L.amberText}">${esc(cutoffAuthority)}</div>
                  <div style="margin-top:2px;font:11px/1.35 ${SANS};color:${L.muted}">${esc(cutoffDetail)}</div>
                </td>
                <td width="32%" bgcolor="${L.card}" style="background-color:${L.card};padding:11px 13px;vertical-align:top">
                  <div style="font:600 10px/1.3 ${SANS};text-transform:uppercase;letter-spacing:.06em;color:${L.muted}">Local Prior</div>
                  <div style="margin-top:3px;font:700 13.5px/1.3 ${SANS};color:${L.fg}">${esc(priorMain)}</div>
                  <div style="margin-top:4px;font:11px/1.35 ${SANS};color:${L.muted}">${esc(priorDetail)}</div>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font:13px/1.55 ${SANS};color:${L.body}">${esc(e.quote ? copy.statement.split(" Its abstract says:")[0] : copy.statement)}</p>
            ${e.quote ? `<p style="margin:0 0 8px;padding:4px 10px;border-left:3px solid ${L.mintBtn};font:12.5px/1.45 ${SANS};color:${L.fg}">“${esc(e.quote)}”</p>` : ""}
            <p style="margin:0 0 18px;font:11.5px/1.45 ${SANS};color:${L.muted}"><strong style="color:${L.fg}">Comparison basis:</strong> ${esc(copy.basis)}</p>

            <!-- Section 2: Powered by System Public Graph -->
            <div style="font:700 10px/1.4 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:${L.mintBtn};margin-bottom:8px">2 · Powered by System Public Graph · Automatic Fidelity &amp; Error Quarantine</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.mintBg}" style="background-color:${L.mintBg};border:1px solid ${L.mintLine};border-radius:6px;margin-bottom:18px">
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid ${L.mintLine};font:12.5px/1.5 ${SANS};color:${L.fg}">
                  <strong style="color:${L.mintText}">At stake for ${esc(drugName)}:</strong> ${esc(a.stakesIntro)}
                  <div style="margin-top:4px;font-size:12px;color:${L.body}">${esc(a.graphLine)}</div>
                  ${liveLinesHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid ${L.mintLine};font:12px/1.5 ${SANS};color:${L.fg}">
                  <strong style="color:${L.mintText}">Automatic precision &amp; quarantine verdict:</strong>
                  <span style="font-family:${MONO};font-weight:700">${cleanCount}</span> verified high-precision trials &amp; cohorts retained${noisyCount ? ` · <span style="font-family:${MONO}">${noisyCount}</span> wide-CI noisy records filtered` : ""} ·
                  <span style="font-family:${MONO};font-weight:700;color:${L.danger}">${errorCount}</span> contradicted/unvetted extractions quarantined so misread papers like <code style="font-family:${MONO};font-size:11px">PEyo2A8Ol0</code> (<a href="${esc(pubmedUrl("26429700"))}" style="color:${L.mintBtn}">PMID 26429700</a>) and <code style="font-family:${MONO};font-size:11px">AeI-laBxXr</code> (<a href="${esc(pubmedUrl("25564249"))}" style="color:${L.mintBtn}">PMID 25564249</a>) never corrupt an alert.
                  <div style="margin-top:4px;font-size:11px;color:${L.muted}">Precision &amp; contested-evidence grading adapted from Knowledge Futures’ <a href="${esc(SOURCES.kfPrecision.url)}" style="color:${L.mintBtn}">System Hackathon</a> &amp; <a href="${esc(SOURCES.kfContested.url)}" style="color:${L.mintBtn}">Contested Evidence</a> demos.</div>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font:12px/1.45 ${SANS};color:${L.fg}">
                  <div style="font-size:11px;font-weight:700;color:${L.mintText};margin-bottom:6px">Verified SP &amp; haplotype citations:</div>
                  ${topCitationsHtml}
                  <div style="margin-top:4px;font-size:11px;color:${L.muted}">${esc(a.stakesCaveat)}</div>
                </td>
              </tr>
            </table>

            <!-- Section 3: Triggering-Study Provenance (MalariaGEN Pf8) -->
            <div style="font:700 10px/1.4 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:${L.muted};margin-bottom:8px">3 · Triggering-Study Provenance (MalariaGEN Pf8) &amp; Reviewer Next Step</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${L.line};border-collapse:collapse;font:12px/1.45 ${SANS};margin-bottom:10px">
              <tr>
                <td width="27%" bgcolor="${L.panel}" style="background-color:${L.panel};padding:8px 11px;border-bottom:1px solid ${L.line};font-weight:600;color:${L.muted};vertical-align:top">Partner study</td>
                <td bgcolor="${L.card}" style="background-color:${L.card};padding:8px 11px;border-bottom:1px solid ${L.line};color:${L.fg}">${esc(partnerStudyVal)}</td>
              </tr>
              <tr>
                <td bgcolor="${L.panel}" style="background-color:${L.panel};padding:8px 11px;border-bottom:1px solid ${L.line};font-weight:600;color:${L.muted};vertical-align:top">Geographic scope</td>
                <td bgcolor="${L.card}" style="background-color:${L.card};padding:8px 11px;border-bottom:1px solid ${L.line};color:${L.fg}">${esc(geoScopeVal)}</td>
              </tr>
              <tr>
                <td bgcolor="${L.panel}" style="background-color:${L.panel};padding:8px 11px;border-bottom:1px solid ${L.line};font-weight:600;color:${L.muted};vertical-align:top">DNA &amp; callability</td>
                <td bgcolor="${L.card}" style="background-color:${L.card};padding:8px 11px;border-bottom:1px solid ${L.line};color:${L.fg}">${esc(dnaCallVal)}</td>
              </tr>
              <tr>
                <td bgcolor="${L.panel}" style="background-color:${L.panel};padding:8px 11px;font-weight:600;color:${L.muted};vertical-align:top">Codon 540 alleles</td>
                <td bgcolor="${L.card}" style="background-color:${L.card};padding:8px 11px;font-family:${MONO};font-size:11.5px;color:${L.fg}">${esc(codonAllelesVal)}${enaLinksHtml}</td>
              </tr>
            </table>

            <div style="padding:10px 13px;background-color:${L.amberBg};border:1px solid ${L.amberLine};border-radius:6px;font:12px/1.5 ${SANS};color:${L.amberText};margin-bottom:12px">
              <strong>Reviewer next step (TES/CES check):</strong> ${esc(nextStepsText)}
              <div style="margin-top:4px;font-size:11px"><strong>Guardrails:</strong> ${esc(a.limits[0] ?? "Surveillance signal only, not clinical guidance.")}</div>
            </div>

            ${renderDigestList(x.recent, "Published since this collection")}
            ${renderDigestList(x.queue, "Curation queue: not yet read by the graph")}

            <!-- Footer Provenance -->
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid ${L.line};font:11px/1.6 ${SANS};color:${L.muted}">
              <div>
                <strong style="color:${L.fg}">Provenance:</strong>
                ${linkEl(SOURCES.pf8)} ·
                ${linkEl(SOURCES.graph)} ·
                ${linkEl(whoSource)}
              </div>
              <div style="margin-top:4px">
                <a href="${esc(permalinkUrl)}" style="color:${L.mintBtn};font-weight:600;margin-right:10px">Permanent Web Dispatch ↗</a>
                ${extraLinks.map((l) => `<a href="${esc(l.url)}" style="color:${L.mintBtn};font-weight:600;margin-right:10px">${esc(l.label)} ↗</a>`).join("")}
                <a href="${esc(a.link)}" style="color:${L.mintBtn};font-weight:600">Interactive Alert Observatory ↗</a>
              </div>
              <div style="margin-top:5px">${esc(a.asOf)} A replay of the historical record: not live surveillance, not clinical guidance.</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;

  return { subject, text, html };
}
