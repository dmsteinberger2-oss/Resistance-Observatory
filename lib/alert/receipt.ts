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
import { EVIDENCE_TIER, NEXT_STEPS_NOTE, NO_STUDY_TYPE, assayKeywords, enaUrl, methodText, type GenomeContext, type StudyContextFile } from "./context";
import { pmidStr, type AbstractPrevalence, type ClientPack, type GraphFinding, type MarkerDef, type Paper } from "./pack";

export const SOURCES = {
  pf8: { label: "MalariaGEN Pf8, DOI 10.5281/zenodo.18681980", url: "https://zenodo.org/records/18681980" },
  graph: { label: "System Public Graph v2.1, DOI 10.7910/DVN/7V6JDO", url: "https://doi.org/10.7910/DVN/7V6JDO" },
  whoFallback: {
    label: "WHO guidelines for malaria (13 August 2025)",
    url: "https://iris.who.int/server/api/core/bitstreams/26a6af2d-060c-4449-8207-1f25e63c6cc3/content",
  },
} as const;

export const PRESET_BADGE = "Project notification preset (no published WHO K540E cut-off for this region)";
export const TIER = {
  checked: "Source-checked against paper",
  unverified: "Reported by System Graph, unverified",
} as const;

export const pubmedUrl = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`;

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
  for (const f of pack.graph.stakes_sp) {
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
  const sameCountry = pack.graph.stakes_sp.filter((f) => f.checked?.country_iso3 === area);
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
      links: [{ label: `PMID ${pmidStr(f.pmid)}`, url: p?.url ?? pubmedUrl(pmidStr(f.pmid)) }],
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
    if (f.pubmed_id) math.push({ label: "Paper", text: `${f.paper_title ?? ""} ${f.journal ?? ""} ${f.pub_year ?? ""}`.trim(), links: [{ label: `PMID ${f.pubmed_id}`, url: f.pubmed_url ?? pubmedUrl(pmidStr(f.pubmed_id)) }] });
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
      links: [{ label: `PMID ${e.pmid}`, url: args.paper?.url ?? pubmedUrl(e.pmid) }],
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
    links: f.pubmed_id ? [{ label: `PMID ${f.pubmed_id}`, url: f.pubmed_url ?? pubmedUrl(pmidStr(f.pubmed_id)) }] : undefined,
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
  limits: string[];
  link: string;
  asOf: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildEmail(a: EmailParts): { subject: string; text: string; html: string } {
  const { e, copy } = a;
  const subject = a.subject;
  const meta = `${KIND_LABEL[e.kind]} · ${SOURCE_LABEL[e.source]} · ${e.dateBasis === "collection" ? "collected" : "published"} ${e.year}${e.fired ? "" : " · context, not an alert"}`;
  const stakeLine = (f: GraphFinding) =>
    `[${f.study_type ?? NO_STUDY_TYPE}] ${pairText(f)}. ${statText(f) ?? ""} Population: ${f.population ?? "not given by the graph"} [system_id ${f.system_id}; ${f.source_checked ? TIER.checked : TIER.unverified}${f.pubmed_id ? `; ${f.pubmed_url ?? pubmedUrl(pmidStr(f.pubmed_id))}` : ""}]`;

  const text = [
    `Your watch: ${a.watchText}`,
    "",
    copy.title.toUpperCase(),
    meta,
    "",
    "WHY IT MATTERS (ACCORDING TO THE SYSTEM GRAPH)",
    a.stakesIntro,
    ...a.stakes.map((f) => `- ${stakeLine(f)}`),
    a.stakesCaveat,
    "",
    "WHAT CHANGED",
    copy.statement,
    `Comparison basis: ${copy.basis}`,
    "",
    "HOW MUCH WEIGHT TO GIVE THIS: THE TRIGGERING STUDY",
    `Evidence tier: ${a.weight.tier}`,
    ...a.weight.lines.map((l) => `${l.warn ? "! " : "- "}${l.label}: ${l.text}`),
    ...(a.weight.steps.length ? ["Next steps a reviewer would look for:", ...a.weight.steps.map((s, i) => `  ${i + 1}. ${s}`), a.weight.stepsNote ?? ""] : []),
    "",
    "WHAT THE SYSTEM GRAPH HAS ON IT",
    a.graphLine,
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
    `Open this alert: ${a.link}`,
    "",
    `${a.asOf} A replay of the historical record: not live surveillance, not clinical guidance.`,
  ].join("\n");

  const h = (t: string) => `<h3 style="font:600 11px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#5a5f6b;margin:22px 0 6px">${esc(t)}</h3>`;
  const para = (t: string) => `<p style="margin:0 0 8px">${esc(t)}</p>`;
  const link = (l: ReceiptLink) => `<a href="${esc(l.url)}" style="color:#0d6b66">${esc(l.label)}</a>`;
  const html = `<div style="font:15px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#15171c;max-width:640px;margin:0 auto;padding:8px">
<p style="font:12px ui-monospace,Menlo,monospace;color:#5a5f6b;margin:0 0 4px">${esc(a.watchText)}</p>
<p style="font:11px ui-monospace,Menlo,monospace;color:#0d6b66;margin:6px 0 0">${esc(a.subject.match(/^\[[^\]]*\]/)?.[0] ?? "")}</p>
<h2 style="font:600 22px/1.25 Georgia,serif;margin:6px 0 4px">${esc(`${a.marker}, ${a.country}: ${copy.title}`)}</h2>
<p style="font:12px ui-monospace,Menlo,monospace;color:#b3341d;margin:0">${esc(meta)}</p>
${h("Why it matters, according to the System graph")}
${para(a.stakesIntro)}
<ul style="margin:0 0 8px;padding-left:18px">${a.stakes
    .map(
      (f) =>
        `<li style="margin-bottom:6px"><span style="border:1px solid #a9a08c;border-radius:9px;padding:0 6px;font-size:11px;white-space:nowrap">${esc(f.study_type ?? NO_STUDY_TYPE)}</span> ${esc(pairText(f))}. <strong>${esc(statText(f) ?? "")}</strong><br><span style="color:#5a5f6b">Population: ${esc(f.population ?? "not given by the graph")}</span><br><span style="font:11px ui-monospace,Menlo,monospace;color:#5a5f6b">system_id ${esc(f.system_id)} · ${esc(f.source_checked ? TIER.checked : TIER.unverified)}${
          f.pubmed_id ? ` · ${link({ label: `PMID ${f.pubmed_id}`, url: f.pubmed_url ?? pubmedUrl(pmidStr(f.pubmed_id)) })}` : ""
        }</span></li>`,
    )
    .join("")}</ul>
<p style="margin:0 0 8px;color:#5a5f6b;font-size:13px">${esc(a.stakesCaveat)}</p>
${h("What changed")}
${para(e.quote ? copy.statement.split(" Its abstract says:")[0] : copy.statement)}
${e.quote ? `<blockquote style="margin:0 0 8px;padding:2px 0 2px 12px;border-left:3px solid #8a6400;font-family:Georgia,serif">“${esc(e.quote)}”</blockquote>` : ""}
<p style="margin:0 0 8px;color:#5a5f6b;font-size:13px"><strong style="color:#15171c">Comparison basis.</strong> ${esc(copy.basis)}</p>
${h("How much weight to give this: the triggering study")}
<p style="margin:0 0 8px"><span style="border:1px solid #0d6b66;color:#0d6b66;border-radius:9px;padding:1px 8px;font-size:12px">${esc(a.weight.tier)}</span></p>
${a.weight.lines
    .map(
      (l) =>
        `<p style="margin:0 0 6px;font-size:13.5px;${l.warn ? "border-left:3px solid #b3341d;padding-left:9px" : ""}"><strong>${esc(l.label)}.</strong> ${esc(l.text)}</p>`,
    )
    .join("")}
${a.weight.steps.length ? `<p style="margin:8px 0 4px;font-size:13px"><strong>Next steps a reviewer would look for</strong></p><ol style="margin:0 0 6px;padding-left:20px;font-size:13px">${a.weight.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><p style="margin:0 0 8px;color:#5a5f6b;font-size:12px">${esc(a.weight.stepsNote ?? "")}</p>` : ""}
${h("What the System graph has on it")}
${para(a.graphLine)}
${h("WHO status of the marker")}
${a.whoStatus.map(para).join("")}
${h("Decision receipt")}
<table style="border-collapse:collapse;width:100%;font-size:12.5px;border:1px solid #d6cfbf">${a.receipt
    .map(
      (s) =>
        `<tr><td colspan="2" style="background:#ece7dc;padding:5px 8px;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase">${esc(s.title)}</td></tr>` +
        s.rows
          .map(
            (r) =>
              `<tr><td style="padding:5px 8px;border-top:1px solid #d6cfbf;color:#5a5f6b;white-space:nowrap;vertical-align:top">${esc(r.label)}</td><td style="padding:5px 8px;border-top:1px solid #d6cfbf">${esc(r.text)}${
                r.badge ? ` <span style="border:1px solid #a9a08c;border-radius:9px;padding:0 6px;font-size:11px;white-space:nowrap">${esc(r.badge.text)}</span>` : ""
              }${r.links?.length ? ` ${r.links.map(link).join(" · ")}` : ""}</td></tr>`,
          )
          .join(""),
    )
    .join("")}</table>
${h("What this alert cannot tell you")}
<ul style="margin:0 0 8px;padding-left:18px;color:#5a5f6b;font-size:13px">${a.limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p style="margin:18px 0 6px"><a href="${esc(a.link)}" style="color:#0d6b66">Open this alert</a></p>
<p style="font-size:12px;color:#5a5f6b;margin:0">${esc(a.asOf)} A replay of the historical record: not live surveillance, not clinical guidance.</p>
</div>`;

  return { subject, text, html };
}
