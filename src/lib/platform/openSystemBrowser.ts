/**
 * Open an http(s) URL in the OS browser. In Electron, `window.open` is caught
 * and routed into the in-app browser - OAuth sign-in (Composio, Slack, …)
 * needs the real system browser instead.
 */
export async function openSystemBrowser(url: string): Promise<void> {
  const href = String(url || '').trim()
  let parsed: URL
  try {
    parsed = new URL(href)
  } catch {
    throw new Error('Could not open that page.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Could not open that page.')
  }

  const openExternalUrl = window.veennaElectron?.openExternalUrl
  if (typeof openExternalUrl === 'function') {
    const result = await openExternalUrl(href)
    if (result && result.ok === false) {
      throw new Error(result.message || 'Could not open the system browser.')
    }
    return
  }

  window.open(href, '_blank', 'noopener,noreferrer')
}
