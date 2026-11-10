import { defineStore } from 'pinia'
import { ref } from 'vue'
import { buildLocalAnalyticsPayload } from '@/lib/localAnalyticsPayload'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'
import type { VeennaAnalyticsPayload } from '@/types/insights'

const REFRESH_DEBOUNCE_MS = 1_500

/**
 * The Insights numbers, worked out on this device from the saved dictations. Nothing is fetched.
 * (The store keeps its old name so the Insights components did not have to change.)
 */
export const useVeennaAnalyticsStore = defineStore('veennaAnalytics', () => {
  const loading = ref(false)
  const refreshing = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const periodDays = ref(30)
  const data = ref<VeennaAnalyticsPayload | null>(null)
  /** Always true: the numbers come from this device. Kept for the components that read it. */
  const isLocalOnly = ref(true)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let requestSeq = 0

  async function load(_force = false, days = periodDays.value) {
    periodDays.value = days
    const seq = ++requestSeq
    if (!data.value) loading.value = true
    else refreshing.value = true
    try {
      const voice = useVoiceCapturesStore()
      await voice.ensureLocalCapturesHydrated()
      if (seq !== requestSeq) return
      data.value = buildLocalAnalyticsPayload({
        periodDays: days,
        captures: voice.captures,
        insights: voice.insights,
      })
      loaded.value = true
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not load Insights.'
    } finally {
      if (seq === requestSeq) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  /** Recompute soon after a dictation, coalescing a burst into one pass. */
  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void load(true)
    }, REFRESH_DEBOUNCE_MS)
  }

  return { loading, refreshing, loaded, error, periodDays, data, isLocalOnly, load, scheduleRefresh }
})
