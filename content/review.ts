/**
 * Science-review gate.
 *
 * docs/SCIENCE.md: every factual claim "must be checked ... by the science
 * lead before it appears in the UI". docs/LEARN.md: "Science lead has not
 * reviewed — do not ship. Hold the section rather than showing unreviewed
 * claims."
 *
 * So: content carries `reviewed: boolean`. In production, unreviewed content
 * is HELD (a visible "awaiting review" panel renders in its place). For the
 * science lead to review it in context, set NEXT_PUBLIC_SHOW_UNREVIEWED=1
 * locally or on a Vercel *preview* environment only — everything then renders
 * with a loud DRAFT tag. Never set it on production.
 */
export const SHOW_UNREVIEWED = process.env.NEXT_PUBLIC_SHOW_UNREVIEWED === "1";

export type Reviewable<T> = { value: T; reviewed: boolean };

/** Should this content render at all? */
export function canShow(item: { reviewed: boolean } | null | undefined): boolean {
  if (!item) return false;
  return item.reviewed || SHOW_UNREVIEWED;
}

/** Should it render with a DRAFT tag? */
export function isDraft(item: { reviewed: boolean }): boolean {
  return !item.reviewed && SHOW_UNREVIEWED;
}
