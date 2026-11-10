import { onBeforeUnmount, onMounted, unref, watch, type Ref } from 'vue'

/**
 * Let a subtree keep focus while a modal dialog is trapping it.
 *
 * radix-vue's dialogs trap focus by listening for focusin and focusout on the
 * document and refocusing anything that lands outside their own content. That
 * is right for ordinary page content and wrong for anything deliberately
 * rendered outside the dialog: a VeennaModal teleported to the body, or the
 * worker computer stream, which lives at the app root so it can outlive the
 * dialog entirely.
 *
 * The symptom is not obviously about focus. A field that cannot hold focus
 * cannot receive keystrokes, so it stays empty, so the button guarded by its
 * length stays disabled, and the whole dialog reads as frozen.
 *
 * radix listens in the bubble phase, so a capture-phase listener on the same
 * node runs first and can stop the event before the trap ever sees it. Focus
 * itself is never prevented, only the notification that would have undone it,
 * and only for events belonging to this element. Everything else still reaches
 * the trap, so the dialog keeps working normally.
 */
export function useFocusTrapEscape(
  target: Ref<HTMLElement | null>,
  active?: Ref<boolean> | (() => boolean),
) {
  const isActive = () => {
    if (active === undefined) return true
    return typeof active === 'function' ? active() : Boolean(unref(active))
  }

  const owns = (node: EventTarget | null) => {
    const el = target.value
    return Boolean(el && node instanceof Node && el.contains(node))
  }

  function onFocusIn(event: FocusEvent) {
    if (!isActive()) return
    if (owns(event.target)) event.stopImmediatePropagation()
  }

  function onFocusOut(event: FocusEvent) {
    // The same moment seen from the trap's side: focus leaving it for us.
    if (!isActive()) return
    if (owns(event.relatedTarget)) event.stopImmediatePropagation()
  }

  function attach() {
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
  }

  function detach() {
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
  }

  onMounted(attach)
  onBeforeUnmount(detach)

  // A teleported modal mounts once and opens many times; re-attaching on each
  // open keeps this listener ahead of any trap installed in the meantime.
  if (active !== undefined && typeof active !== 'function') {
    watch(active, (on) => {
      detach()
      if (on) attach()
    })
  }

  return { attach, detach }
}
