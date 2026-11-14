/**
 * Link to the real paper behind a finding. CLAUDE.md: every finding keeps its
 * system_id, pubmed_id and doi end to end, and a user must always be able to
 * click through. DOI is preferred; PubMed is the fallback; if neither exists we
 * say so plainly rather than hiding the finding's provenance.
 */
type Props = {
  systemId: string;
  pubmedId?: string | null;
  doi?: string | null;
  /** Visible link text. Defaults to "Read source paper". */
  children?: React.ReactNode;
  className?: string;
};

export function paperUrl(pubmedId?: string | null, doi?: string | null): string | null {
  if (doi) return `https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}`;
  if (pubmedId) return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pubmedId)}/`;
  return null;
}

export function EvidenceLink({ systemId, pubmedId, doi, children, className = "" }: Props) {
  const href = paperUrl(pubmedId, doi);
  const ids = (
    <span className="font-mono text-xs text-muted">
      system_id {systemId}
      {pubmedId ? ` · PMID ${pubmedId}` : ""}
      {doi ? ` · doi:${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}` : ""}
    </span>
  );
  if (!href) {
    return (
      <span className={`inline-flex flex-col gap-1 ${className}`}>
        <span className="text-xs text-gap">No PubMed ID or DOI recorded on this finding</span>
        {ids}
      </span>
    );
  }
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group/link inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-drug underline decoration-drug/40 underline-offset-4 hover:decoration-drug"
      >
        <span>{children ?? "Inspect source paper"}</span>
        <span aria-hidden="true" className="transition-transform group-hover/link:translate-x-0.5">
          ↗
        </span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {ids}
    </span>
  );
}
