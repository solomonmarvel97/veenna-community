import { onMounted, ref } from 'vue'
import { getVeennaElectron, isElectron } from '@/lib/platform/isElectron'
import type { VeennaAppInfo } from '@/types/electron'

export function useElectron() {
  const appInfo = ref<VeennaAppInfo | null>(null)
  const ready = ref(!isElectron)

  onMounted(async () => {
    const api = getVeennaElectron()
    if (!api?.getAppInfo) {
      ready.value = true
      return
    }
    try {
      appInfo.value = await api.getAppInfo()
    } catch {
      /* non-fatal */
    } finally {
      ready.value = true
    }
  })

  return {
    isElectron,
    appInfo,
    ready,
    api: getVeennaElectron(),
  }
}
