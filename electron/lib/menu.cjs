'use strict';

const { Menu, app } = require('electron');
const { APP_NAME, ZOOM_LIMITS } = require('../config/app.cjs');
const { zoomBy, resetZoom, focusedWebContents } = require('./zoom.cjs');

function viewSubmenu() {
  return [
    { role: 'reload' },
    { role: 'forceReload' },
    { type: 'separator' },
    {
      label: 'Actual Size',
      accelerator: 'CmdOrCtrl+0',
      click: () => resetZoom(focusedWebContents()),
    },
    {
      label: 'Zoom In',
      accelerator: 'CmdOrCtrl+Plus',
      click: () => zoomBy(focusedWebContents(), ZOOM_LIMITS.step),
    },
    {
      // Same action on the unshifted key, so ⌘= works too.
      label: 'Zoom In',
      accelerator: 'CmdOrCtrl+=',
      visible: false,
      click: () => zoomBy(focusedWebContents(), ZOOM_LIMITS.step),
    },
    {
      label: 'Zoom Out',
      accelerator: 'CmdOrCtrl+-',
      click: () => zoomBy(focusedWebContents(), -ZOOM_LIMITS.step),
    },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];
}

/**
 * @param {{ isDev?: boolean, onPreferences?: () => void }} options
 */
function setupApplicationMenu({ isDev, onPreferences } = {}) {
  const preferencesItem = {
    label: 'Preferences…',
    accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
    click: () => onPreferences?.(),
  };

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: APP_NAME,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            preferencesItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
          ],
        },
        {
          label: 'View',
          submenu: viewSubmenu(),
        },
        {
          label: 'Window',
          submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
        },
      ]),
    );
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [preferencesItem, { type: 'separator' }, { role: 'quit' }],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: viewSubmenu(),
      },
    ]),
  );
}

module.exports = { setupApplicationMenu };
