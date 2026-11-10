'use strict';

/**
 * Send one message to every trusted window. A window that is tearing down is skipped, not an error.
 * @param {Array<import('electron').WebContents | null | undefined>} webContentsList
 * @param {string} channel
 * @param {unknown} payload
 */
function broadcast(webContentsList, channel, payload) {
  for (const wc of webContentsList) {
    if (!wc || wc.isDestroyed()) continue;
    try {
      wc.send(channel, payload);
    } catch {
      /* window may be tearing down */
    }
  }
}

module.exports = { broadcast };
