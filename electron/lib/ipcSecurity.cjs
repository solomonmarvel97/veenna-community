'use strict';

/**
 * Restrict IPC handlers to trusted application renderers.
 * @param {import('electron').IpcMainInvokeEvent} event
 * @param {() => Array<import('electron').WebContents | null | undefined>} getTrustedWebContentsList
 */
function isTrustedRenderer(event, getTrustedWebContentsList) {
  const trusted = getTrustedWebContentsList().filter(Boolean);
  return trusted.some((wc) => !wc.isDestroyed() && event.sender === wc);
}

/**
 * @template T
 * @param {() => Array<import('electron').WebContents | null | undefined>} getTrustedWebContentsList
 * @param {(event: import('electron').IpcMainInvokeEvent, ...args: any[]) => T} handler
 */
function trustedHandler(getTrustedWebContentsList, handler) {
  return (event, ...args) => {
    if (!isTrustedRenderer(event, getTrustedWebContentsList)) {
      return { ok: false, reason: 'untrusted_sender' };
    }
    return handler(event, ...args);
  };
}

module.exports = {
  isTrustedRenderer,
  trustedHandler,
};
