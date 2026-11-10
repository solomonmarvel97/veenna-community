function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

/** Copy text to the system clipboard. Uses Electron IPC in the desktop app. */
export async function writeClipboardText(text: string): Promise<boolean> {
  const value = String(text ?? '')
  if (!value) return false

  const copyText = window.veennaElectron?.copyText
  if (typeof copyText === 'function') {
    try {
      const result = await copyText(value)
      if (result?.ok === true) return true
    } catch {
      /* fall through to browser clipboard */
    }
  }

  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return fallbackCopy(value)
  }
}
