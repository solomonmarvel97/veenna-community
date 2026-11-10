import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/lib/platform/isElectron', () => ({ isElectron: true }))
vi.mock('@/lib/localStore/localStoreClient', () => ({
  listLocalEntities: vi.fn(),
  mirrorLocalEntity: vi.fn(),
  openLocalStore: vi.fn(),
  removeLocalEntity: vi.fn(),
}))

import { listLocalEntities } from '@/lib/localStore/localStoreClient'
import { hydrateStoresFromLocalStore } from '@/lib/localStore/hydrateFromLocalStore'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'

describe('hydrateStoresFromLocalStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('reads dictations back from the local database', async () => {
    vi.mocked(listLocalEntities).mockResolvedValue({
      ok: true,
      entities: [
        {
          type: 'voice_capture',
          id: 'a',
          payload: { id: 'a', text: 'hello there', createdAt: '2026-11-09T10:00:00.000Z' },
        },
      ],
    } as never)

    await hydrateStoresFromLocalStore()
    const rows = useVoiceCapturesStore().captures
    expect(rows.find((r) => r.id === 'a')?.text).toBe('hello there')
  })
})
