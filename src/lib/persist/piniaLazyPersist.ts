import { effectScope, watch } from 'vue'
import type { PiniaPluginContext, StateTree } from 'pinia'

/**
 * Pinia persistence that stays out of the way.
 *
 * Replaces pinia-plugin-persistedstate and reads the same `persist` options,
 * but that plugin wrote every persisted store to localStorage synchronously
 * on every single change, behind a deep watch that walked the whole state
 * each time. Here:
 *
 * - restoring is the same: read once, synchronously, when the store is made;
 * - a change only marks the store as needing a save; saves run together once
 *   things go quiet (in idle time), and at once when the page is hidden or
 *   closed, so nothing is lost;
 * - `watchDepth` lets a store say how far down a change can happen. A store
 *   that always replaces what it changes (never edits in place) sets a small
 *   depth, so noticing a change no longer means walking everything it holds.
 */

type LazyPersistOptions = {
  key?: string
  paths?: string[]
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  serializer?: {
    serialize: (value: StateTree) => string
    deserialize: (value: string) => StateTree
  }
  beforeRestore?: (context: PiniaPluginContext) => void
  afterRestore?: (context: PiniaPluginContext) => void
  /** How deep a change can be; unset watches everything, as before. */
  watchDepth?: number
}

declare module 'pinia' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface DefineStoreOptionsBase<S extends StateTree, Store> {
    persist?: boolean | LazyPersistOptions | LazyPersistOptions[]
  }
}

/** How long after the last change a save waits. */
const SAVE_DELAY_MS = 800

const due = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

function runWhenIdle(job: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(job, { timeout: 2000 })
  else setTimeout(job, 0)
}

/** Save everything that is waiting, now. */
function flushPersistence() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const jobs = [...due]
  due.clear()
  for (const job of jobs) job()
}

function listenForLeaving() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('pagehide', flushPersistence)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersistence()
  })
}

/** Queue a save; saves already queued for the same job run once. */
function scheduleSave(job: () => void) {
  listenForLeaving()
  due.add(job)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    runWhenIdle(flushPersistence)
  }, SAVE_DELAY_MS)
}

function readPath(state: StateTree, path: string): unknown {
  let at: unknown = state
  for (const part of path.split('.')) {
    if (at == null || typeof at !== 'object') return undefined
    at = (at as Record<string, unknown>)[part]
  }
  return at
}

function pickPaths(state: StateTree, paths: string[]): StateTree {
  const out: StateTree = {}
  for (const path of paths) {
    const parts = path.split('.')
    let into = out
    for (const part of parts.slice(0, -1)) {
      if (part === '__proto__') break
      into[part] = into[part] && typeof into[part] === 'object' ? into[part] : {}
      into = into[part]
    }
    into[parts[parts.length - 1]] = readPath(state, path)
  }
  return out
}

export function lazyPersist(context: PiniaPluginContext) {
  const { options, store, pinia } = context
  const persist = options.persist
  if (!persist) return
  // A hot-reloaded copy: the original store already persists.
  if (!(store.$id in pinia.state.value)) return

  const list: LazyPersistOptions[] = Array.isArray(persist)
    ? persist
    : [persist === true ? {} : persist]

  for (const opts of list) {
    const key = opts.key ?? store.$id
    const storage = opts.storage ?? (typeof localStorage === 'undefined' ? null : localStorage)
    if (!storage) continue
    const serializer = opts.serializer ?? { serialize: JSON.stringify, deserialize: JSON.parse }
    const paths = Array.isArray(opts.paths) ? opts.paths : null

    opts.beforeRestore?.(context)
    let leftovers = false
    try {
      const saved = storage.getItem(key)
      if (saved) {
        const restored = serializer.deserialize(saved)
        store.$patch(restored)
        // Something written under this key that is no longer kept there (an
        // older layout): rewrite it soon, so it stops being read on every boot.
        if (paths && restored && typeof restored === 'object') {
          leftovers = Object.keys(restored).some((k) => !paths.some((p) => p.split('.')[0] === k))
        }
      }
    } catch {
      /* unreadable or unavailable storage: start from the defaults */
    }
    opts.afterRestore?.(context)

    const save = () => {
      try {
        storage.setItem(
          key,
          serializer.serialize(paths ? pickPaths(store.$state, paths) : store.$state),
        )
      } catch {
        /* full or unavailable storage: the next change tries again */
      }
    }

    const depth = typeof opts.watchDepth === 'number' ? opts.watchDepth : true
    // Detached, like the plugin it replaces: the store outlives any component.
    effectScope(true).run(() => {
      watch(
        () => (paths ? paths.map((path) => readPath(store.$state, path)) : store.$state),
        () => scheduleSave(save),
        { deep: depth },
      )
    })
    if (leftovers) scheduleSave(save)
  }
}
