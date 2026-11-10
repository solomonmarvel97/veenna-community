import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/platform/isElectron', () => ({
  isElectron: true,
}))

import {
  flushLocalMirrorBusForTests,
  scheduleLocalMirrorDelete,
  scheduleLocalMirrorUpsert,
} from '@/lib/localStore/localMirrorBus'

describe('localMirrorBus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(window as unknown as { veennaElectron?: Record<string, unknown> }).veennaElectron = {
      upsertLocalEntity: vi.fn().mockResolvedValue({ ok: true }),
      deleteLocalEntity: vi.fn().mockResolvedValue({ ok: true }),
    }
  })

  afterEach(() => {
    flushLocalMirrorBusForTests()
    vi.useRealTimers()
    delete (window as unknown as { veennaElectron?: unknown }).veennaElectron
  })

  it('debounces and coalesces upserts for the same entity', async () => {
    scheduleLocalMirrorUpsert('voice_capture', 't1', { text: 'First' })
    scheduleLocalMirrorUpsert('voice_capture', 't1', { text: 'Second' })

    expect(window.veennaElectron?.upsertLocalEntity).not.toHaveBeenCalled()

    vi.advanceTimersByTime(32)
    flushLocalMirrorBusForTests()
    await Promise.resolve()

    expect(window.veennaElectron?.upsertLocalEntity).toHaveBeenCalledTimes(1)
    expect(window.veennaElectron?.upsertLocalEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'voice_capture',
        id: 't1',
        payload: { text: 'Second' },
      }),
    )
  })

  it('queues delete jobs in the background', async () => {
    scheduleLocalMirrorDelete('voice_capture', 'n1')
    vi.advanceTimersByTime(32)
    flushLocalMirrorBusForTests()
    await Promise.resolve()

    expect(window.veennaElectron?.deleteLocalEntity).toHaveBeenCalledWith({
      type: 'voice_capture',
      id: 'n1',
    })
  })
})
