<script setup lang="ts">
import {
  DropdownMenuRoot,
  type DropdownMenuRootEmits,
  type DropdownMenuRootProps,
  useForwardPropsEmits,
} from 'radix-vue'

const props = withDefaults(defineProps<DropdownMenuRootProps>(), {
  // Match Select (`bodyLock: false`): modal lock sets `body { pointer-events: none }` and
  // the first outside click is often eaten by the stack, so the menu needs a second click.
  modal: false,
})
const emits = defineEmits<DropdownMenuRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DropdownMenuRoot v-bind="forwarded">
    <slot />
  </DropdownMenuRoot>
</template>
