import type { NavigationGuard } from 'vue-router'
import { isSettingsTab, normalizePath, ROUTES } from '@/router/paths'
import { queryString } from '@/router/query'

/** A Settings address with a tab we do not have goes to plain Settings. */
export const settingsQueryGuard: NavigationGuard = (to) => {
  if (to.path !== ROUTES.settings) return true
  const tab = queryString(to.query.tab)
  if (!tab || isSettingsTab(tab)) return true
  return { path: ROUTES.settings, replace: true }
}

/** Refuse paths with doubled slashes, backslashes or encoded dots. */
export const pathSanityGuard: NavigationGuard = (to) => {
  if (to.path.includes('//') || to.path.includes('\\') || to.path.toLowerCase().includes('%2e')) {
    return { path: ROUTES.home, replace: true }
  }
  return true
}

/** Redirect to the canonical form of a path (`/home` → `/`, no trailing slash, no hash). */
export const canonicalPathGuard: NavigationGuard = (to) => {
  const normalized = normalizePath(to.path)
  if (normalized === to.path) return true
  return { path: normalized, query: to.query, hash: '', replace: true }
}
