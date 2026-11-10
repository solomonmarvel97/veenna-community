'use strict';

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const ELECTRON_DIR = path.join(ROOT_DIR, 'electron');
const PRELOAD_PATH = path.join(ELECTRON_DIR, 'preload.cjs');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3020';
const loadViteDevServer = process.env.ELECTRON_DEV === 'true' && Boolean(VITE_DEV_SERVER_URL);

/**
 * The window keeps room for the page beside the open nav, and shrinks to phone
 * width once the nav is collapsed (see lib/navWindowWidth). Below 1024px the
 * pages switch to their narrow layout (see useResponsiveLayout MOBILE_MAX) and
 * the nav stays docked (see useNavSidebarChrome).
 */
const WINDOW_MIN_WIDTH = 560;
const WINDOW_MIN_WIDTH_NAV_COLLAPSED = 375;

const WINDOW_DEFAULTS = {
  width: 1280,
  height: 800,
  minWidth: WINDOW_MIN_WIDTH,
  minHeight: 640,
  backgroundColor: '#121212',
  title: 'Veenna Community',
};

/** Menu bar + process name (matches electron-builder productName). */
const APP_NAME = require('./edition.cjs').isCommunity ? 'Veenna Community' : 'veenna';

/** Page zoom range (1 = 100%) and how far each step moves. */
const ZOOM_LIMITS = {
  min: 0.5,
  max: 2,
  step: 0.1,
};

module.exports = {
  ROOT_DIR,
  ELECTRON_DIR,
  PRELOAD_PATH,
  VITE_DEV_SERVER_URL,
  loadViteDevServer,
  WINDOW_DEFAULTS,
  WINDOW_MIN_WIDTH_NAV_COLLAPSED,
  ZOOM_LIMITS,
  APP_NAME,
};
