/**
 * Shared rules for skeleton loaders, so every page shimmers the same way.
 *
 * - What is already known (a page title, a section label, a pane header)
 *   renders as real text. Only what is still arriving shimmers.
 * - A skeleton draws the thing it stands in for at that thing's real size, so
 *   nothing moves when the content lands.
 * - Rows shimmer in a wave: each one starts `SKELETON_STAGGER_MS` after the row
 *   above it. The wave is capped so a long list never waits a second to start.
 * - Chrome that never holds content (icons, buttons, timestamps) stays still;
 *   the shimmer is for text and media.
 */

/** Delay between one row's shimmer and the next. */
const SKELETON_STAGGER_MS = 50

/** No bone waits longer than this, however far down the list it sits. */
const SKELETON_MAX_DELAY_MS = 600

/** Shimmer delay for the row at `index`, plus an offset for bones within the row. */
export function skeletonDelay(index: number, offsetMs = 0): number {
  return Math.min(index * SKELETON_STAGGER_MS + offsetMs, SKELETON_MAX_DELAY_MS)
}

/** Pick a width for row `index` from a cycle, so neighbouring rows differ like real text. */
export function skeletonWidth(widths: readonly string[], index: number): string {
  return widths[index % widths.length] ?? widths[0] ?? 'w-full'
}
