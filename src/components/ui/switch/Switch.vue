<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import {
  SwitchRoot,
  type SwitchRootEmits,
  type SwitchRootProps,
  SwitchThumb,
  useForwardPropsEmits,
} from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<SwitchRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<SwitchRootEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SwitchRoot
    v-bind="forwarded"
    :class="
      cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:border-[var(--veenna-focus-line)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-veenna-accent data-[state=unchecked]:bg-veenna-border',
        props.class,
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-veenna-panel shadow-sm data-[state=unchecked]:bg-white ring-0 transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
        )
      "
    />
  </SwitchRoot>
</template>
