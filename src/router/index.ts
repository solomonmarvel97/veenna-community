import { createRouter, createWebHistory } from 'vue-router'
import { communityGuard } from '@/router/guards/community'
import { canonicalPathGuard, pathSanityGuard, settingsQueryGuard } from '@/router/guards/validation'
import { routes } from '@/router/routes'

const router = createRouter({
  history: createWebHistory('/'),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash && !to.hash.startsWith('#/')) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  },
})

router.beforeEach(pathSanityGuard)
router.beforeEach(canonicalPathGuard)
router.beforeEach(settingsQueryGuard)
// There is no account, so no sign-in wall: this guard keeps people on the three screens.
router.beforeEach(communityGuard)

export default router
