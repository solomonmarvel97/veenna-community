<script setup lang="ts">
import { type HTMLAttributes, computed, nextTick, onMounted, ref, watch } from 'vue'
import { TabsList, type TabsListProps, injectTabsRootContext, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)

const rootContext = injectTabsRootContext()
const listRef = ref<{ $el: HTMLElement } | null>(null)

/**
 * Brings the selected tab fully into view inside the list. Moves only the
 * list's own scroll, never the page, so this is plain scrollLeft math rather
 * than scrollIntoView.
 */
function revealActive(behavior: 'auto' | 'smooth') {
  const list = listRef.value?.$el
  if (!list || list.scrollWidth <= list.clientWidth) return
  const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
  if (!active) return
  const listBox = list.getBoundingClientRect()
  const tabBox = active.getBoundingClientRect()
  const pad = 8
  let delta = 0
  if (tabBox.left < listBox.left + pad) delta = tabBox.left - listBox.left - pad
  else if (tabBox.right > listBox.right - pad) delta = tabBox.right - listBox.right + pad
  if (delta !== 0) list.scrollBy({ left: delta, behavior })
}

watch(
  () => rootContext.modelValue.value,
  () => nextTick(() => revealActive('smooth')),
)
onMounted(() => nextTick(() => revealActive('auto')))

/**
 * A mouse wheel only scrolls vertically, which a one-row strip can't use, so
 * turn it sideways while the strip still has room to move that way. Trackpads
 * already send horizontal deltas and pass straight through.
 */
function onWheel(event: WheelEvent) {
  const list = event.currentTarget as HTMLElement
  if (event.deltaX !== 0 || event.deltaY === 0) return
  if (list.scrollWidth <= list.clientWidth) return
  const atStart = list.scrollLeft <= 0
  const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1
  if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return
  event.preventDefault()
  list.scrollLeft += event.deltaY
}
</script>

<template>
  <TabsList
    ref="listRef"
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex h-7 w-full items-center justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-full bg-veenna-row p-0.5 text-veenna-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        props.class,
      )
    "
    @wheel="onWheel"
  >
    <slot />
  </TabsList>
</template>
