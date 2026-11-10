import type { UsageCategoryId } from '@/lib/insightsCopy'
import { isContextAwarenessEnabled } from '@/lib/privacySettings'

export type DictationForegroundContext = {
  appName: string
  /** Ephemeral - used only on-device for category inference, never sent to the server. */
  windowTitle?: string | null
  bundleId?: string | null
  source: 'os' | 'in-app'
}

/** Only app name + inferred category cross the network. No titles, URLs, or paths. */
export type AppContextPayload = {
  appContext: string | null
  appCategory?: UsageCategoryId | null
}

const SELF_APP_PATTERNS = [/^veenna\.?$/i, /^electron$/i, /veenna*dictation/i]

function haystack(appName: string, windowTitle?: string | null): string {
  return [appName, windowTitle]
    .map((part) =>
      String(part || '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(' ')
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle))
}

/** Infer usage category on-device. Window title is ephemeral input only. */
export function inferUsageCategory(appName: string, windowTitle?: string | null): UsageCategoryId {
  const app = String(appName || '')
    .trim()
    .toLowerCase()
  const value = haystack(appName, windowTitle)
  if (!value) return 'other'

  if (app === 'code' || app === 'vscode' || app.includes('visual studio code')) {
    return 'work'
  }

  if (
    matchesAny(value, [
      'chatgpt',
      'claude',
      'copilot',
      'cursor',
      'gemini',
      'perplexity',
      'openai',
      'anthropic',
      'prompt',
      'midjourney',
    ])
  ) {
    return 'ai'
  }

  if (
    matchesAny(value, [
      'notion',
      'google docs',
      ' docs',
      'document',
      'pages',
      ' word',
      'microsoft word',
      'obsidian',
      'bear',
      'ulysses',
      'ia writer',
      'markdown',
      'evernote',
      'onenote',
      'roam',
      'craft docs',
    ])
  ) {
    return 'documents'
  }

  if (
    matchesAny(value, [
      'imessage',
      'messages',
      'whatsapp',
      'telegram',
      'signal',
      'facebook messenger',
      'messenger',
    ])
  ) {
    return 'personal'
  }

  if (
    matchesAny(value, [
      'slack',
      'teams',
      'microsoft teams',
      'discord',
      'zoom',
      'linear',
      'figma',
      'asana',
      'jira',
      'confluence',
      'github',
      'gitlab',
      'bitbucket',
      'xcode',
      'intellij',
      'webstorm',
      'android studio',
      'terminal',
      'iterm',
      'warp',
    ])
  ) {
    return 'work'
  }

  if (
    matchesAny(value, [
      'mail',
      'gmail',
      'outlook',
      'spark',
      'superhuman',
      'inbox',
      'compose',
      'yahoo mail',
      'proton mail',
    ])
  ) {
    return 'email'
  }

  // Generic browsers without a recognizable tab → other (never guess documents).
  return 'other'
}

export function isSelfForegroundApp(appName: string | null | undefined): boolean {
  if (!appName) return false
  const value = appName.trim()
  return SELF_APP_PATTERNS.some((pattern) => pattern.test(value))
}

export function normalizeForegroundContext(
  raw:
    | {
        appName?: string | null
        windowTitle?: string | null
        bundleId?: string | null
        source?: 'os' | 'in-app'
      }
    | null
    | undefined,
  source: 'os' | 'in-app' = 'os',
): DictationForegroundContext | null {
  const appName = raw?.appName?.trim()
  if (!appName) return null

  const resolvedSource = raw?.source ?? source
  if (resolvedSource === 'os' && isSelfForegroundApp(appName)) return null

  return {
    appName,
    windowTitle: raw?.windowTitle?.trim() || null,
    bundleId: raw?.bundleId?.trim() || null,
    source: resolvedSource,
  }
}

export function inAppDictationContext(): DictationForegroundContext {
  return {
    appName: 'veenna',
    windowTitle: null,
    source: 'in-app',
  }
}

/**
 * Build the API payload for a capture.
 * In-app veenna dictation is excluded from desktop usage breakdown.
 */
export function toAppContextPayload(ctx: DictationForegroundContext | null): AppContextPayload {
  if (!isContextAwarenessEnabled()) {
    return { appContext: null, appCategory: null }
  }
  if (!ctx || ctx.source === 'in-app' || isSelfForegroundApp(ctx.appName)) {
    return { appContext: null, appCategory: null }
  }

  return {
    appContext: ctx.appName.slice(0, 128),
    appCategory: inferUsageCategory(ctx.appName, ctx.windowTitle),
  }
}
