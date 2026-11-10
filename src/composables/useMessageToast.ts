import { watch, type WatchSource } from 'vue'
import { useToast, type ToastVariant } from '@/components/ui/toast/use-toast'

type MessageValue = string | null | undefined | false

export type MessageToastOptions = {
  /** Headline; the message becomes the description. Without it the message is the headline. */
  title?: string
  /** A function when the tone depends on the message, e.g. a notice that can go either way. */
  variant?: ToastVariant | (() => ToastVariant)
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

/**
 * Show a message as a toast instead of printing it into the page.
 *
 * Messages across the app are toasts, never banners inside the body. Point
 * this at the error (or success) text a component already keeps; each time
 * it changes to a new non-empty value, one toast shows. The same text again
 * shows again only after it was cleared first, which is what a retry does.
 */
export function useMessageToast(
  source: WatchSource<MessageValue>,
  options: MessageToastOptions = {},
) {
  const { toast } = useToast()
  watch(source, (next, previous) => {
    const text = typeof next === 'string' ? next.trim() : ''
    if (!text || next === previous) return
    const variant =
      (typeof options.variant === 'function' ? options.variant() : options.variant) ?? 'destructive'
    toast({
      title: options.title ?? text,
      description: options.title ? text : undefined,
      variant,
      duration: options.duration ?? (variant === 'default' ? 3000 : 5000),
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    })
  })
}

/**
 * Errors. Red by default, but a message made by toUserErrorMessage from a token,
 * plan or recoverable error is presented blue / orange / amber (see lib/messageKinds.ts).
 */
export function useErrorToast(
  source: WatchSource<MessageValue>,
  options: Omit<MessageToastOptions, 'variant'> = {},
) {
  useMessageToast(source, { ...options, variant: 'destructive' })
}
