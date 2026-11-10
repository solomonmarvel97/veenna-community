import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDictationStore } from '@/stores/dictation'

describe('useDictationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts idle with overlay hidden', () => {
    const store = useDictationStore()
    expect(store.mode).toBe('idle')
    expect(store.isRecording).toBe(false)
    expect(store.overlayVisible).toBe(false)
  })

  it('shows overlay while recording', () => {
    const store = useDictationStore()
    store.setMode('ptt')
    expect(store.isRecording).toBe(true)
    expect(store.overlayVisible).toBe(true)
  })

  it('tracks phase and preview text', () => {
    const store = useDictationStore()
    store.setPhase('cleaning')
    store.setPreviewText('hello world')

    expect(store.phase).toBe('cleaning')
    expect(store.previewText).toBe('hello world')
    expect(store.overlayVisible).toBe(true)
  })

  it('endRecordingSession hides overlay before processing finishes', () => {
    const store = useDictationStore()
    store.setMode('ptt')
    store.setPhase('recording')

    store.endRecordingSession()

    expect(store.mode).toBe('idle')
    expect(store.phase).toBeNull()
    expect(store.overlayVisible).toBe(false)
  })

  it('reset clears transient state', () => {
    const store = useDictationStore()
    store.setMode('continuous')
    store.setError('mic denied')
    store.setSuccessMessage('Done')
    store.setPasteFallbackText('fallback transcript')

    store.reset()

    expect(store.mode).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.successMessage).toBeNull()
    expect(store.previewText).toBe('')
    expect(store.pasteFallbackText).toBeNull()
    expect(store.handsFreeUi).toBe(false)
  })

  it('keeps overlay visible when paste fallback text is set', () => {
    const store = useDictationStore()
    store.setPasteFallbackText('hello world')
    expect(store.pasteFallbackText).toBe('hello world')
    expect(store.overlayVisible).toBe(true)
  })

  it('keeps paste-fallback overlay visible after returning to idle', () => {
    const store = useDictationStore()
    store.setMode('processing')
    store.setPasteFallbackText('shown on hud')
    store.setMode('idle')
    store.setPhase(null)
    expect(store.pasteFallbackText).toBe('shown on hud')
    expect(store.overlayVisible).toBe(true)
  })

  it('enables hands-free HUD chrome in continuous mode', () => {
    const store = useDictationStore()
    store.setMode('continuous')
    expect(store.showHandsFreeControls).toBe(true)
  })
})
