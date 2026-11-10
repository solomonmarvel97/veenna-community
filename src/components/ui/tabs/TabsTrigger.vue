<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { TabsTrigger, type TabsTriggerProps, useForwardProps } from 'reka-ui'
import { PhCheck } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<
    TabsTriggerProps & {
      class?: HTMLAttributes['class']
      /** Show a check on the selected tab. Off for tabs that page content. */
      showCheck?: boolean
    }
  >(),
  { showCheck: true },
)

const delegatedProps = computed(() => {
  const { class: _, showCheck: __, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    :class="
      cn(
        'group inline-flex h-full flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-0 text-caption font-medium ring-offset-transparent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--veenna-focus-line)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--veenna-tab-active-bg)] data-[state=active]:text-[var(--veenna-tab-active-fg)] data-[state=active]:shadow-sm',
        props.class,
      )
    "
  >
    <!--
      data-state lives on the trigger, so the check reads it through `group`.
      Hidden rather than invisible on inactive tabs: the label then centres in
      the full trigger instead of leaving a gap where the icon would be.
    -->
    <PhCheck
      v-if="showCheck"
      class="hidden size-3 shrink-0 group-data-[state=active]:block"
      weight="bold"
      aria-hidden="true"
    />
    <slot />
  </TabsTrigger>
</template>
