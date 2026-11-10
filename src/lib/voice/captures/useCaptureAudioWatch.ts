import { ref } from 'vue'
import { hasCaptureAudio } from '@/lib/voice/captureAudioStore'

/**
 * Tracks which captures are still saving their audio, and polls IndexedDB until the audio
 * blob the HUD stored becomes visible in this window. That keeps the play control live
 * without a route change or refresh.
 *
 * @param deps.hasAudio whether the capture is already known to have audio
 * @param deps.markHasAudio record that the capture's audio is now available
 */
export function useCaptureAudioWatch(deps: {
  hasAudio: (id: string) => boolean
  markHasAudio: (id: string) => void
}) {
  const { hasAudio, markHasAudio } = deps
  const audioSavingIds = ref<Record<string, true>>({})
  const audioWatchTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function isAudioSaving(id: string) {
    return Boolean(audioSavingIds.value[id])
  }

  function setAudioSaving(id: string, saving: boolean) {
    if (!id) return
    if (saving) {
      if (audioSavingIds.value[id]) return
      audioSavingIds.value = { ...audioSavingIds.value, [id]: true }
      return
    }
    if (!audioSavingIds.value[id]) return
    const next = { ...audioSavingIds.value }
    delete next[id]
    audioSavingIds.value = next
  }

  function stopWatchingCaptureAudio(id: string) {
    const timer = audioWatchTimers.get(id)
    if (timer != null) {
      clearTimeout(timer)
      audioWatchTimers.delete(id)
    }
  }

  /**
   * Poll IndexedDB until the HUD-persisted audio blob is visible in this window.
   * Keeps the play control live without requiring a route change / refresh.
   */
  function watchCaptureAudio(id: string, options?: { maxAttempts?: number; intervalMs?: number }) {
    if (!id || hasAudio(id)) {
      setAudioSaving(id, false)
      return
    }
    stopWatchingCaptureAudio(id)
    setAudioSaving(id, true)

    const maxAttempts = options?.maxAttempts ?? 40
    const intervalMs = options?.intervalMs ?? 250
    let attempts = 0

    const tick = async () => {
      attempts += 1
      try {
        if (await hasCaptureAudio(id)) {
          markHasAudio(id)
          setAudioSaving(id, false)
          stopWatchingCaptureAudio(id)
          return
        }
      } catch {
        /* keep polling */
      }

      if (attempts >= maxAttempts) {
        setAudioSaving(id, false)
        stopWatchingCaptureAudio(id)
        return
      }
      audioWatchTimers.set(
        id,
        setTimeout(() => {
          void tick()
        }, intervalMs),
      )
    }

    void tick()
  }

  return { audioSavingIds, isAudioSaving, setAudioSaving, watchCaptureAudio, stopWatchingCaptureAudio }
}
