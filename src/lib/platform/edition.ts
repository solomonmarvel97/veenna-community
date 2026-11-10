/**
 * The free, dictation-only desktop app. Set at build time (`VITE_EDITION=community`).
 *
 * It has no sign-in, no account and no cloud: every guard that would send a signed-out
 * person to a login page is bypassed, and the main process blocks all outbound traffic
 * (electron/lib/communityLockdown.cjs).
 */
export const isCommunity = true

/** Where "Go Pro" sends people. Opened in their own browser, never fetched by the app. */
export const GO_PRO_URL = 'https://veenna.com/download?from=community'
