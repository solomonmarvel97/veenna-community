'use strict'

/**
 * CSP for Electron session headers + Vite HTML meta inject (vite.config.ts).
 * The page may read from the speech-model host and nothing else; the app's own origin is the
 * `veenna-community:` scheme.
 */
const VEENNA_APP_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' blob:",
  "connect-src 'self' veenna-community: blob: data: https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co",
  "img-src 'self' data: blob: veenna-community:",
  "font-src 'self' data:",
  "media-src 'self' blob: veenna-community:",
  "style-src 'self' 'unsafe-inline'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
].join('; ')

const VEENNA_APP_CSP_DEV = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: veenna-community:",
  "font-src 'self' data:",
  "media-src 'self' blob: veenna-community:",
  "connect-src 'self' veenna-community: blob: data: http://localhost:* ws://localhost:* https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co",
  "worker-src 'self' blob:",
].join('; ')

/**
 * Browsers ignore frame-ancestors (and sandbox / report-uri) on <meta> CSP.
 * Keep those on HTTP headers only so the console is not spammed.
 */
function cspForMetaElement(policy) {
  return String(policy || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^(frame-ancestors|sandbox|report-uri|report-to)\b/i.test(part))
    .join('; ')
}

module.exports = { VEENNA_APP_CSP, VEENNA_APP_CSP_DEV, cspForMetaElement }
