'use strict';

const { screen } = require('electron');
const { WINDOW_DEFAULTS, WINDOW_MIN_WIDTH_NAV_COLLAPSED } = require('../config/app.cjs');

/**
 * Sets the window's minimum width for the nav's state. A window narrower than
 * that grows to it, moving left if it would otherwise run off the screen.
 *
 * @param {import('electron').BrowserWindow} win
 * @param {boolean} collapsed
 */
function fitWindowToNav(win, collapsed) {
  const minWidth = collapsed ? WINDOW_MIN_WIDTH_NAV_COLLAPSED : WINDOW_DEFAULTS.minWidth;
  win.setMinimumSize(minWidth, win.getMinimumSize()[1]);
  if (win.isFullScreen() || win.isMaximized()) return;
  const bounds = win.getBounds();
  if (bounds.width >= minWidth) return;
  const area = screen.getDisplayMatching(bounds).workArea;
  const x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - minWidth));
  win.setBounds({ ...bounds, x, width: minWidth });
}

module.exports = { fitWindowToNav };
