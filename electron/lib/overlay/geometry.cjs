'use strict';

/**
 * Pure layout maths for the dictation HUD window. No state and no window handles:
 * everything here takes values in and gives values out, so it is easy to reason about.
 *
 * **The overlay window never changes size.** Resizing a transparent always-on-top window is
 * not synchronised with the renderer's paint, so the compositor can present a stale frame at
 * the old geometry (a ghost at the wrong place). One size, always, large enough for the
 * biggest chrome the HUD draws. The window is a transparent canvas; only the DOM inside it
 * changes between modes, and everything outside the drawn chrome is click-through.
 */

const { screen } = require('electron');
const { DEFAULT_SIZE } = require('../overlayState.cjs');

/** The one and only size of the HUD window, in px. */
const OVERLAY_WINDOW_SIZE = { width: 250, height: 220 };

/**
 * How close the pill may get to the window edge before its own chrome would be clipped,
 * measured from the widest thing drawn around it (the hands-free row, the mode menu opening
 * upward, the mode bar hanging below). It only binds when the window itself is jammed against
 * a screen edge, which is what stops a corner-parked dot from cutting its controls in half.
 */
const PILL_SAFE_INSET = { left: 100, right: 100, top: 95, bottom: 60 };

/** Centre of a rectangle, in the same coordinates as the rectangle. */
function pillCenterOf(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function boundsEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Clamp to [min, max]; if the range is inverted (too small to fit), take its middle. */
function clampAxis(value, min, max) {
  return max < min ? Math.round((min + max) / 2) : Math.min(Math.max(value, min), max);
}

/**
 * Resolve the window position for a pill anchor, plus where the pill sits inside that window.
 *
 * The window is kept fully on the work area so chrome is never clipped by the screen edge.
 * Clamping it would normally drag the pill along with it, so the pill's offset inside the
 * window absorbs exactly what the clamp moved: the canvas shifts, the dot does not. When the
 * anchor is comfortably inside the display (the usual case) the offset is zero and the pill
 * is dead centre.
 *
 * @param {{ x: number, y: number }} pillCenter anchor in screen coordinates
 * @param {import('electron').Display | undefined} display the display the anchor is on
 */
function overlayLayoutFor(pillCenter, display) {
  const work = display?.workArea ?? screen.getPrimaryDisplay().workArea;
  const { width, height } = OVERLAY_WINDOW_SIZE;

  // The dot itself must stay on screen even if the anchor drifted off it.
  const anchor = {
    x: clampAxis(pillCenter.x, work.x + DEFAULT_SIZE.width / 2, work.x + work.width - DEFAULT_SIZE.width / 2),
    y: clampAxis(pillCenter.y, work.y + DEFAULT_SIZE.height / 2, work.y + work.height - DEFAULT_SIZE.height / 2),
  };

  const bounds = {
    x: Math.round(clampAxis(anchor.x - width / 2, work.x, work.x + work.width - width)),
    y: Math.round(clampAxis(anchor.y - height / 2, work.y, work.y + work.height - height)),
    width,
    height,
  };

  // Pill position in window-local CSS px, kept far enough from the canvas edge that its own
  // controls still fit. Settling here, rather than at the raw anchor, makes a corner drag
  // stop at a usable spot instead of half off-screen, and it is stable: nothing shifts later.
  const pill = {
    x: Math.round(clampAxis(anchor.x - bounds.x, PILL_SAFE_INSET.left, width - PILL_SAFE_INSET.right)),
    y: Math.round(clampAxis(anchor.y - bounds.y, PILL_SAFE_INSET.top, height - PILL_SAFE_INSET.bottom)),
  };

  return { bounds, anchor: { x: bounds.x + pill.x, y: bounds.y + pill.y }, pill };
}

module.exports = { OVERLAY_WINDOW_SIZE, pillCenterOf, boundsEqual, overlayLayoutFor };
