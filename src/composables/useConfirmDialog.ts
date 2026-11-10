import { ref, shallowRef } from 'vue'

export type ConfirmDialogOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Runs after the user confirms; dialog stays open (with spinner) until this settles. */
  onConfirm?: () => void | Promise<void>
}

type PendingConfirm = ConfirmDialogOptions & {
  resolve: (value: boolean) => void
}

const open = ref(false)
const pending = shallowRef<PendingConfirm | null>(null)
const confirming = ref(false)

function normalizeOptions(options: ConfirmDialogOptions | string): ConfirmDialogOptions {
  if (typeof options === 'string') {
    return { title: options }
  }
  return options
}

/** Promise-based confirm dialog (replaces `window.confirm`). */
export function confirm(options: ConfirmDialogOptions | string): Promise<boolean> {
  const normalized = normalizeOptions(options)

  return new Promise((resolve) => {
    confirming.value = false
    pending.value = {
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      destructive: false,
      ...normalized,
      resolve,
    }
    open.value = true
  })
}

export function useConfirmDialogHost() {
  function settle(confirmed: boolean) {
    const current = pending.value
    if (!current) return

    confirming.value = false
    open.value = false
    pending.value = null
    current.resolve(confirmed)
  }

  async function confirmPending() {
    const current = pending.value
    if (!current || confirming.value) return

    if (!current.onConfirm) {
      settle(true)
      return
    }

    confirming.value = true
    try {
      await current.onConfirm()
      settle(true)
    } catch {
      // Keep dialog open so the user can retry or cancel.
      confirming.value = false
    }
  }

  return {
    open,
    pending,
    confirming,
    settle,
    confirmPending,
  }
}
