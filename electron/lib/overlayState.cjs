'use strict';

const fs = require('fs');
const path = require('path');
const { app, screen } = require('electron');

const DEFAULT_SIZE = { width: 40, height: 40 };
const EDGE_MARGIN = 20;

/** The only places the HUD is allowed to rest once it has been moved. */
const EDGE_ANCHORS = ['top', 'bottom', 'left', 'right'];

function stateFilePath() {
  return path.join(app.getPath('userData'), 'dictation-overlay-state.json');
}

function loadOverlayState() {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return normalizeOverlayState(parsed);
  } catch {
    /* first launch */
  }
  return {
    anchor: 'center',
    offsetX: EDGE_MARGIN,
    offsetY: EDGE_MARGIN,
    width: DEFAULT_SIZE.width,
    height: DEFAULT_SIZE.height,
  };
}

/**
 * The HUD only ever rests in one of five places: screen center (first launch,
 * before it has ever been moved) or flush against one edge. A state file saved
 * by an older build could carry a corner or an arbitrary free-floating point -
 * fold those into the nearest edge so loading it can't reintroduce a resting
 * position outside the four this build supports.
 */
function normalizeOverlayState(state) {
  const width = DEFAULT_SIZE.width;
  const height = DEFAULT_SIZE.height;
  const offsetX = Number.isFinite(state.offsetX) ? state.offsetX : EDGE_MARGIN;
  const offsetY = Number.isFinite(state.offsetY) ? state.offsetY : EDGE_MARGIN;

  if (state.anchor === 'center' || EDGE_ANCHORS.includes(state.anchor)) {
    return { anchor: state.anchor, offsetX, offsetY, width, height };
  }

  if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
    const work = screen.getPrimaryDisplay().workArea;
    const center = { x: state.x + width / 2, y: state.y + height / 2 };
    return { anchor: nearestEdgeAnchor(center, work), offsetX: EDGE_MARGIN, offsetY: EDGE_MARGIN, width, height };
  }

  // Legacy corner anchors ("top-left", "bottom-right", ...): keep the first half.
  if (typeof state.anchor === 'string' && state.anchor.includes('-')) {
    const [primary] = state.anchor.split('-');
    if (EDGE_ANCHORS.includes(primary)) {
      return { anchor: primary, offsetX, offsetY, width, height };
    }
  }

  return { anchor: 'center', offsetX: EDGE_MARGIN, offsetY: EDGE_MARGIN, width, height };
}

function saveOverlayState(state) {
  try {
    fs.writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('[overlay-state] save failed:', err?.message || err);
  }
}

function getWorkArea(display) {
  return display?.workArea ?? screen.getPrimaryDisplay().workArea;
}

function boundsForAnchor(state, display) {
  const work = getWorkArea(display);
  const width = state.width || DEFAULT_SIZE.width;
  const height = state.height || DEFAULT_SIZE.height;
  const offsetX = state.offsetX ?? EDGE_MARGIN;
  const offsetY = state.offsetY ?? EDGE_MARGIN;

  switch (state.anchor) {
    case 'top':
      return { x: work.x + Math.round((work.width - width) / 2), y: work.y + offsetY, width, height };
    case 'bottom':
      return {
        x: work.x + Math.round((work.width - width) / 2),
        y: work.y + work.height - height - offsetY,
        width,
        height,
      };
    case 'left':
      return { x: work.x + offsetX, y: work.y + Math.round((work.height - height) / 2), width, height };
    case 'right':
      return {
        x: work.x + work.width - width - offsetX,
        y: work.y + Math.round((work.height - height) / 2),
        width,
        height,
      };
    case 'center':
    default:
      return {
        x: work.x + Math.round((work.width - width) / 2),
        y: work.y + Math.round((work.height - height) / 2),
        width,
        height,
      };
  }
}

/** Whichever of the four work-area edges a point is closest to. */
function nearestEdgeAnchor(point, work) {
  const distances = {
    top: point.y - work.y,
    bottom: work.y + work.height - point.y,
    left: point.x - work.x,
    right: work.x + work.width - point.x,
  };
  return EDGE_ANCHORS.reduce((closest, edge) => (distances[edge] < distances[closest] ? edge : closest));
}

/** Resting state for wherever a drag let go of the pill - always one of the four edges. */
function stateForPillCenter(pillCenter, display) {
  const work = getWorkArea(display);
  return {
    anchor: nearestEdgeAnchor(pillCenter, work),
    offsetX: EDGE_MARGIN,
    offsetY: EDGE_MARGIN,
    width: DEFAULT_SIZE.width,
    height: DEFAULT_SIZE.height,
  };
}

module.exports = {
  DEFAULT_SIZE,
  EDGE_MARGIN,
  loadOverlayState,
  saveOverlayState,
  boundsForAnchor,
  stateForPillCenter,
  nearestEdgeAnchor,
  normalizeOverlayState,
};
