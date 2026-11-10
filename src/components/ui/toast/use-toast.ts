import { markRaw, ref } from 'vue'

/**
 * default      neutral (success / info)
 * credits      blue: AI tokens, balance or Budget unavailable or exhausted
 * upgrade      orange: tried something the plan does not allow
 * warning      amber: recoverable (validation, missing input, rate limits)
 * destructive  red: real failures only
 */
export type ToastVariant = 'default' | 'destructive' | 'credits' | 'upgrade' | 'warning'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  /** The error behind a destructive toast; lets the toast be presented by its kind. */
  error?: unknown
  duration?: number
  icon?: unknown
  onClick?: () => void
  onClickHint?: string
  actionLabel?: string
  onAction?: () => void
  actionHint?: string
  /** The server-status toast itself; never held back while the server is down. */
  network?: boolean
}

interface TimerState {
  timeoutId: ReturnType<typeof setTimeout>
  remaining: number
  startedAt: number
}

const toasts = ref<Toast[]>([])
const timers = new Map<string, TimerState>()
const suppressionScopes = new Map<string, number>()
let toastIdCounter = 0

function startTimer(id: string, remaining: number, onExpire: () => void) {
  timers.set(id, {
    timeoutId: setTimeout(onExpire, remaining),
    remaining,
    startedAt: Date.now(),
  })
}

export function useToast() {
  const toast = (rawProps: Omit<Toast, 'id'>) => {
    if (suppressionScopes.size > 0) return ''
    const props = rawProps
    // The same error reported twice in a row (two paths of one failed send)
    // is one problem; keep the toast already on screen instead of stacking.
    if (props.variant && props.variant !== 'default') {
      const twin = toasts.value.find(
        (t) =>
          t.variant === props.variant &&
          t.title === props.title &&
          t.description === props.description,
      )
      if (twin) return twin.id
    }

    const id = `toast-${++toastIdCounter}`
    const duration = props.duration ?? 3000

    const { error: _error, ...displayProps } = props
    const newToast: Toast = {
      id,
      ...displayProps,
      icon: props.icon ? markRaw(props.icon as object) : props.icon,
    }

    toasts.value.push(newToast)

    if (duration > 0) {
      startTimer(id, duration, () => dismiss(id))
    }

    return id
  }

  const dismiss = (id: string) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer.timeoutId)
      timers.delete(id)
    }
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) toasts.value.splice(index, 1)
  }

  const pause = (id: string) => {
    const timer = timers.get(id)
    if (!timer) return
    clearTimeout(timer.timeoutId)
    const elapsed = Date.now() - timer.startedAt
    timer.remaining = Math.max(timer.remaining - elapsed, 0)
  }

  const resume = (id: string) => {
    const timer = timers.get(id)
    if (!timer) return
    startTimer(id, timer.remaining, () => dismiss(id))
  }

  return { toast, toasts, dismiss, pause, resume }
}
