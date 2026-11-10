import { defineAsyncComponent, type Component } from 'vue'
import PageLoadError from '@/components/skeleton/PageLoadError.vue'
import PageLoadingSkeleton from '@/components/skeleton/PageLoadingSkeleton.vue'

type PageLoader = () => Promise<unknown>

/** The import behind each lazy page, so its code can be fetched ahead of a click. */
const loaders = new WeakMap<object, PageLoader>()

/**
 * A page whose code loads after the route has already switched.
 *
 * A plain `() => import(...)` route makes vue-router hold the old page on
 * screen until the new page's code arrives, so a click on a cold page looks
 * ignored. Wrapped this way the router commits at once and the sidebar and
 * URL move with the click.
 *
 * The page's own loading states only exist once its code has run, so until
 * then a placeholder holds the page area (a page-shaped one when given). The
 * page area must never be a bare gap: on a cold start a page's code can take
 * seconds. Pages warmed in the background (warmRouteComponents) are fully
 * resolved by `loadPageCode`, so they mount at once and never show it.
 *
 * Views loaded like this must not use in-component route guards.
 */
export function lazyPage(
  load: () => Promise<{ default: Component }>,
  options: { placeholder?: Component } = {},
): Component {
  const page = defineAsyncComponent({
    loader: load,
    loadingComponent: options.placeholder ?? PageLoadingSkeleton,
    // No delay: an unresolved page shows its placeholder in the very first frame.
    delay: 0,
    // A load that never answers (a stalled chunk, a dev server mid-rebuild) is tried again, then
    // shows the error page with Reload, instead of leaving the placeholder up for good.
    timeout: 15_000,
    // Without this a failed load would leave the page slot empty for good.
    errorComponent: PageLoadError,
    // A busy dev server or a dropped connection can fail one fetch; try again before giving up.
    onError(error, retry, fail, attempts) {
      if (attempts <= 2) retry()
      else fail()
    },
  })
  // The wrapper is deliberate (see above); mark it as already warned so vue-router's
  // dev-only "use () => import() instead of defineAsyncComponent()" notice stays quiet.
  ;(page as { __warnedDefineAsync?: boolean }).__warnedDefineAsync = true
  loaders.set(page, load)
  return page
}

/**
 * Fetch a lazy page's code now and resolve the page itself, so its first
 * visit mounts at once with no placeholder. Resolves quietly when there is
 * nothing to load.
 */
export async function loadPageCode(page: unknown): Promise<void> {
  if (!page || typeof page !== 'object') return
  // Vue's own loader for the wrapper: running it marks the page resolved.
  const resolve = (page as { __asyncLoader?: () => Promise<unknown> }).__asyncLoader
  if (typeof resolve === 'function') {
    await resolve()
    return
  }
  const load = loaders.get(page)
  if (load) await load()
}
