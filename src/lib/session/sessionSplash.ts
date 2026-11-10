/**
 * The splash that covers a change of account.
 *
 * It is the boot splash from index.html, kept rather than thrown away: main.ts
 * parks the node when the app mounts, and signing in or switching accounts
 * puts the same node back on screen until the new account's first data has
 * loaded. One look for "getting your workspace ready", whether the window just
 * opened or the person just became someone else.
 */

import { nextTick, ref } from 'vue'

const PENDING_KEY = 'veenna-session-splash-pending'

/** Longest the splash may hold the app, however slow the new account's data is. */
const SESSION_SPLASH_BUDGET_MS = 8000

let parked: HTMLElement | null = null

/**
 * Take the splash off screen and keep the node for later.
 *
 * It goes in one frame, never a fade: a cover fading out over the app shows
 * both at half strength, so the splash seems to melt into the page.
 */
function takeDown(el: HTMLElement) {
  parked = el
  el.className = ''
  el.remove()
}

/** Take the boot splash off screen but keep the node for later. */
export function parkBootSplash() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('boot-splash')
  if (!el) return
  takeDown(el)
}

/**
 * True while a share link's boot splash stays over its page. The page draws no spinner of its own
 * meanwhile, so the one spinner runs from first paint until the shared thing is on screen.
 */
export const shareSplashHeld = ref(false)
let shareSplashBudget: ReturnType<typeof setTimeout> | null = null

/** At mount on a share link: leave the splash up for the page to take down. False anywhere else. */
export function holdShareSplash(budgetMs = SESSION_SPLASH_BUDGET_MS): boolean {
  if (typeof document === 'undefined') return false
  const el = document.getElementById('boot-splash')
  if (el?.getAttribute('data-variant') !== 'share') return false
  shareSplashHeld.value = true
  // A load that never settles hands over to the page's own spinner rather than hang here.
  shareSplashBudget = setTimeout(releaseShareSplash, budgetMs)
  return true
}

/** The share page has what it shows: take the splash down once that has rendered under it. */
export function releaseShareSplash() {
  if (!shareSplashHeld.value) return
  if (shareSplashBudget) clearTimeout(shareSplashBudget)
  shareSplashBudget = null
  void nextTick(() => {
    shareSplashHeld.value = false
    parkBootSplash()
  })
}

/** Put the splash back over everything. No-op in windows that never had one. */
export function showSessionSplash() {
  if (typeof document === 'undefined') return
  const el = parked ?? document.getElementById('boot-splash')
  if (!el) return
  el.style.zIndex = '2147483000'
  // Booted on a share link, the node is still in its share look; an account change is a workspace one.
  el.removeAttribute('data-variant')
  if (!el.isConnected) document.body.appendChild(el)
  // The backdrop covers the app from this frame on. The content's class flips
  // on the next frame so its fade runs from the hidden state.
  requestAnimationFrame(() => {
    el.className = 'is-visible'
  })
}

export function hideSessionSplash() {
  if (typeof document === 'undefined') return
  // The node on screen first: a parked copy may be a stale one.
  const el = document.getElementById('boot-splash') ?? parked
  if (!el) return
  takeDown(el)
}


/** Call before a full reload that lands on a different signed-in account. */
export function markSessionSplashPending() {
  try {
    sessionStorage.setItem(PENDING_KEY, '1')
  } catch {
    /* storage blocked: the reload just shows the ordinary boot splash */
  }
}

/** True once per marked reload. */
export function consumeSessionSplashPending(): boolean {
  try {
    const pending = sessionStorage.getItem(PENDING_KEY) === '1'
    sessionStorage.removeItem(PENDING_KEY)
    return pending
  } catch {
    return false
  }
}

/** Resolve when the work settles or the budget runs out, whichever is first. */
export function withinSplashBudget(work: Promise<unknown>, budgetMs = SESSION_SPLASH_BUDGET_MS) {
  return Promise.race([
    work.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => {
      setTimeout(resolve, budgetMs)
    }),
  ])
}
