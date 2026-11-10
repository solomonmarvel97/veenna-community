'use strict';

/** Where the HUD pill sits: placing the window, dragging, snapping to an edge, and remembering it. */

const { screen } = require('electron');
const { state } = require('./state.cjs');
const { liveWindow } = require('./chrome.cjs');
const { pillCenterOf, boundsEqual, overlayLayoutFor } = require('./geometry.cjs');
const { saveOverlayState, boundsForAnchor, stateForPillCenter } = require('../overlayState.cjs');

/** Renderer event carrying the pill point, so it can draw in place. */
const OVERLAY_LAYOUT_EVENT = 'veenna:overlay-layout';

/** How long the pill takes to ease into its snapped edge position after a drag. */
const SNAP_ANIMATION_MS = 180;
const SNAP_ANIMATION_STEPS = 10;
/** Wait this long after the last move before saving, so a drag saves once. */
const PERSIST_DELAY_MS = 180;

/** Tell the renderer where the pill is inside the window. */
function sendOverlayLayout() {
  const win = liveWindow();
  const wc = win?.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    wc.send(OVERLAY_LAYOUT_EVENT, {
      pill: { ...state.pillPoint },
      size: { width: bounds.width, height: bounds.height },
    });
  } catch {
    /* tearing down */
  }
}

/** Move the window ourselves without the `moved` handler mistaking it for a drag. */
function applyBounds(win, bounds) {
  if (!win || win.isDestroyed() || boundsEqual(win.getBounds(), bounds)) return;
  state.programmaticBoundsChanges += 1;
  win.setBounds(bounds, false);
  setTimeout(() => {
    state.programmaticBoundsChanges = Math.max(0, state.programmaticBoundsChanges - 1);
  }, 150);
}

/** Current pill anchor in screen coordinates. */
function currentPillCenter() {
  const win = liveWindow();
  if (!win) return pillCenterOf(boundsForAnchor(state.saved, screen.getPrimaryDisplay()));
  const bounds = win.getBounds();
  return { x: bounds.x + state.pillPoint.x, y: bounds.y + state.pillPoint.y };
}

/** Place the fixed-size window so the pill lands on `pillCenter`. */
function applyOverlayLayout(win, pillCenter) {
  if (!win || win.isDestroyed()) return;
  const display = screen.getDisplayNearestPoint({ x: Math.round(pillCenter.x), y: Math.round(pillCenter.y) });
  const layout = overlayLayoutFor(pillCenter, display);
  const pillMoved = layout.pill.x !== state.pillPoint.x || layout.pill.y !== state.pillPoint.y;
  state.pillPoint = layout.pill;
  applyBounds(win, layout.bounds);
  if (pillMoved) sendOverlayLayout();
}

/** Place the window for a saved dock position. */
function applyOverlayBounds(win, saved) {
  const display = screen.getDisplayNearestPoint({ x: saved.x ?? 0, y: saved.y ?? 0 });
  applyOverlayLayout(win, pillCenterOf(boundsForAnchor(saved, display)));
}

/** Ease the pill from its drop point into the snapped edge position instead of jumping. */
function animateToPillCenter(win, target) {
  const start = currentPillCenter();
  const stepMs = SNAP_ANIMATION_MS / SNAP_ANIMATION_STEPS;
  let step = 0;
  const tick = () => {
    if (!win || win.isDestroyed()) return;
    step += 1;
    const t = Math.min(1, step / SNAP_ANIMATION_STEPS);
    const eased = 1 - (1 - t) ** 3;
    applyOverlayLayout(win, {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
    });
    if (t < 1) setTimeout(tick, stepMs);
  };
  setTimeout(tick, stepMs);
}

/**
 * The HUD is never left resting mid-screen: wherever a drag lets go, it settles against
 * whichever of the four edges the pill is closest to. The anchor is window origin + pill
 * offset, so it survives any clamp the window took.
 */
function persistOverlayPosition(win) {
  if (!win || win.isDestroyed()) return;
  const center = currentPillCenter();
  const display = screen.getDisplayNearestPoint({ x: Math.round(center.x), y: Math.round(center.y) });
  state.saved = stateForPillCenter(center, display);
  saveOverlayState(state.saved);

  const target = pillCenterOf(boundsForAnchor(state.saved, display));
  if (Math.round(target.x) !== Math.round(center.x) || Math.round(target.y) !== Math.round(center.y)) {
    animateToPillCenter(win, target);
  }
}

function schedulePersistOverlayPosition(win) {
  if (state.movePersistTimer) clearTimeout(state.movePersistTimer);
  state.movePersistTimer = setTimeout(() => {
    state.movePersistTimer = null;
    persistOverlayPosition(win);
  }, PERSIST_DELAY_MS);
}

/**
 * Drag moves the pill anchor, not the window. Near a screen edge the window stops at the work
 * area while the dot keeps following the cursor inside it.
 */
function moveOverlayByDelta(deltaX, deltaY) {
  const win = liveWindow();
  const dx = Number(deltaX);
  const dy = Number(deltaY);
  if (!win || !Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
  const center = currentPillCenter();
  applyOverlayLayout(win, { x: center.x + dx, y: center.y + dy });
  schedulePersistOverlayPosition(win);
}

module.exports = {
  sendOverlayLayout,
  applyOverlayBounds,
  schedulePersistOverlayPosition,
  moveOverlayByDelta,
};
