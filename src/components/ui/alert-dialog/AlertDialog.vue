<script setup lang="ts">
import { AlertDialogRoot, type AlertDialogEmits, type AlertDialogProps } from 'radix-vue'
import { onUnmounted, watch } from 'vue'
import { useOverlayChromeLock } from '@/composables/useOverlayChromeLock'

const props = defineProps<AlertDialogProps>()
const emits = defineEmits<AlertDialogEmits>()

watch(
  () => props.open,
  (open) => {
    document.body.classList.toggle('veenna-modal-open', open)
  },
  { immediate: true },
)

useOverlayChromeLock(() => Boolean(props.open))

onUnmounted(() => {
  document.body.classList.remove('veenna-modal-open')
})
</script>

<template>
  <AlertDialogRoot v-bind="props" @update:open="(value: boolean) => emits('update:open', value)">
    <slot />
  </AlertDialogRoot>
</template>
