/**
 * The product's card family: an outer lane (tinted container with a title row) holding
 * inner cards (the lighter bordered surface). Boards, Docket columns, Home panels and
 * stat tiles all take these two strings so they cannot drift.
 */

/** The outer container. Add width, height and padding-free layout on top. */
export const LANE_CLASS =
  'rounded-sm bg-[color-mix(in_srgb,var(--veenna-fg)_5%,var(--veenna-bg))] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-veenna-divider dark:bg-[color-mix(in_srgb,black_15%,var(--veenna-bg))]'

/** The card inside a lane. Add padding and layout on top. */
export const ITEM_CARD_CLASS =
  'rounded-sm border border-veenna-divider bg-veenna-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]'

/**
 * For a lane built from plain children: every direct child except the title row
 * (marked `lane-title`) is drawn as an inner card.
 */
export const LANE_CHILD_CARD =
  '[&>*:not(.lane-title)]:overflow-hidden [&>*:not(.lane-title)]:rounded-sm [&>*:not(.lane-title)]:border [&>*:not(.lane-title)]:border-veenna-divider [&>*:not(.lane-title)]:bg-veenna-surface [&>*:not(.lane-title)]:shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
