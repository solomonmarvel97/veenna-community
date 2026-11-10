import { isElectron } from '@/lib/platform/isElectron'
import { openLocalStore } from '@/lib/localStore/localStoreClient'
import { clearLocalMirrorBus } from '@/lib/localStore/localMirrorBus'
import { hydrateStoresFromLocalStore } from '@/lib/localStore/hydrateFromLocalStore'
import { LOCAL_OWNER_ID } from '@/lib/localOwner'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'

let started = false

/** Opens the on-device database once and loads the saved dictations from it. */
export function initLocalStoreLifecycle() {
  if (!isElectron || started) return
  started = true
  clearLocalMirrorBus()
  void openLocalStore(LOCAL_OWNER_ID).then(async (result) => {
    if (!result.ok) return
    await hydrateStoresFromLocalStore()
    await useVoiceCapturesStore().hydrateGuestInsights()
  })
}
