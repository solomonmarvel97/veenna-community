import { getVeennaElectron, isElectron } from '@/lib/platform/isElectron'
import type { SpeechCapabilitiesSnapshot } from '@/lib/voice/speechModelRequirements'

type SpeechCapabilitiesResult = {
  ok: boolean
  capabilities?: SpeechCapabilitiesSnapshot
  reason?: string
}

export type SpeechCapabilitiesFetchResult = {
  capabilities: SpeechCapabilitiesSnapshot | null
  error: string | null
}

let cached: SpeechCapabilitiesSnapshot | null = null
let lastError: string | null = null
let inflight: Promise<SpeechCapabilitiesFetchResult> | null = null

export async function fetchSpeechCapabilitiesDetailed(options?: {
  refresh?: boolean
}): Promise<SpeechCapabilitiesFetchResult> {
  if (!isElectron) {
    return { capabilities: null, error: 'not_electron' }
  }
  if (!options?.refresh && cached) {
    return { capabilities: cached, error: null }
  }
  if (!options?.refresh && inflight) return inflight

  inflight = (async () => {
    try {
      const result = (await getVeennaElectron()?.getSpeechCapabilities?.()) as
        SpeechCapabilitiesResult | undefined

      if (result?.ok && result.capabilities) {
        cached = result.capabilities
        lastError = null
        return { capabilities: cached, error: null }
      }

      const reason = result?.reason || 'capabilities_unavailable'
      lastError = reason
      return { capabilities: null, error: reason }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'capabilities_fetch_failed'
      lastError = message
      return { capabilities: null, error: message }
    }
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}
