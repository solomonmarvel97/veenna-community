<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { TabsContent, type TabsContentProps, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TabsContentProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <TabsContent
    v-bind="forwarded"
    :class="
      cn(
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--veenna-focus-line)]',
        props.class,
      )
    "
  >
    <slot />
  </TabsContent>
</template>
