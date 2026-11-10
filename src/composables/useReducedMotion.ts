import { onMounted, onUnmounted, watch } from 'vue'
import { applyMotionDomFlags } from '@/motion/reducedMotion'
import { useThemeStore } from '@/stores/theme'

/**
 * Keeps motion-related html dataset flags in sync:
 * - `data-reduced-motion` - OS accessibility only
 * - `data-motion-dev` - user opt-in for Motion.dev scroll/route animations
 */
export function useReducedMotion(): void {
  const theme = useThemeStore()
  let mql: MediaQueryList | null = null

  watch(
    () => theme.motionEnabled,
    () => {
      applyMotionDomFlags()
    },
  )

  onMounted(() => {
    applyMotionDomFlags()
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    mql.addEventListener('change', applyMotionDomFlags)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', applyMotionDomFlags)
  })
}
