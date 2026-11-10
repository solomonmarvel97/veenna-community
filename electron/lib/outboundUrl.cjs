'use strict'

/** Keep in sync with protocol.cjs SCHEME. This file must not require Electron. */
const APP_SCHEME = 'veenna-community'

/**
 * Where an outbound URL from the app renderer should go.
 *  - app: stay in this window (app scheme / vite / about:blank)
 *  - browser: in-app WebContentsView
 *  - external: OS handler (mailto)
 *  - block: drop
 */
function classifyOutboundUrl(url, options = {}) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === `${APP_SCHEME}:`) return 'app'
    const viteDevServerUrl = options.viteDevServerUrl
    if (
      options.loadViteDevServer &&
      viteDevServerUrl &&
      parsed.origin === new URL(viteDevServerUrl).origin
    ) {
      return 'app'
    }
    if (parsed.protocol === 'about:' && (parsed.pathname === 'blank' || url === 'about:blank')) {
      return 'app'
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return 'browser'
    if (parsed.protocol === 'mailto:') return 'external'
  } catch {
    /* malformed */
  }
  return 'block'
}

module.exports = { APP_SCHEME, classifyOutboundUrl }
