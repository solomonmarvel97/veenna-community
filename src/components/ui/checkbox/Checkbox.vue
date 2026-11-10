<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import type { CheckboxRootEmits, CheckboxRootProps } from 'radix-vue'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'radix-vue'
import { PhCheck } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<
    CheckboxRootProps & {
      class?: HTMLAttributes['class']
      /** @deprecated Neutral styling is always used; kept for backward compatibility. */
      variant?: 'default' | 'muted'
    }
  >(),
  { variant: 'default' },
)
const emits = defineEmits<CheckboxRootEmits>()

const delegatedProps = computed(() => {
  const { class: _, variant: __, ...delegated } = props

  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :class="
      cn(
        'peer h-4 w-4 shrink-0 rounded-[5px] border border-veenna-border bg-veenna-panel text-veenna-fg focus-visible:outline-none focus-visible:border-[var(--veenna-focus-line)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-veenna-accent data-[state=checked]:bg-veenna-accent data-[state=checked]:text-veenna-accent-fg data-[state=indeterminate]:border-veenna-accent data-[state=indeterminate]:bg-veenna-accent data-[state=indeterminate]:text-veenna-accent-fg',
        props.class,
      )
    "
  >
    <CheckboxIndicator class="flex h-full w-full items-center justify-center text-current">
      <PhCheck class="h-4 w-4" weight="bold" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
