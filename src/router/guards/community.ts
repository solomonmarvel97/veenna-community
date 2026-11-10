import type { NavigationGuard } from 'vue-router'
import { ROUTES } from '@/router/paths'

/** The pages that make up the app. Everything else goes to Dictation. */
const APP_PAGES = [ROUTES.dictation, ROUTES.todos, ROUTES.insights, ROUTES.settings]

/**
 * Community has no account, so no page may ask for one. The HUD window loads its own route and
 * passes through; the app pages are allowed; anything else lands on Dictation.
 */
export const communityGuard: NavigationGuard = (to) => {
  if (to.meta.hud || to.path === ROUTES.home) return true
  if (APP_PAGES.some((page) => to.path === page || to.path.startsWith(`${page}/`))) return true
  return { path: ROUTES.dictation, replace: true }
}
