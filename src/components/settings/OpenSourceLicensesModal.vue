<script setup lang="ts">
import { ref, watch } from 'vue'
import { ModalBody, ModalHeader, VeennaModal } from '@/components/veenna'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

// The notices are a few hundred kilobytes, so they load when the window is first opened.
const notices = ref('')
const failed = ref(false)

watch(
  () => props.open,
  async (open) => {
    if (!open || notices.value) return
    failed.value = false
    try {
      const module = await import('@/assets/licenses/third-party-notices.txt?raw')
      notices.value = module.default
    } catch {
      failed.value = true
    }
  },
  { immediate: true },
)
</script>

<template>
  <VeennaModal :open="open" title-id="open-source-licenses-title" size="lg" @close="emit('close')">
    <ModalHeader
      title="Open-source licenses"
      title-id="open-source-licenses-title"
      size="sm"
      @close="emit('close')"
    />
    <ModalBody compact>
      <p v-if="failed" class="text-caption text-veenna-muted">
        Could not load the notices. They are also in the app's source under src/assets/licenses.
      </p>
      <pre
        v-else
        class="whitespace-pre-wrap break-words font-mono text-caption leading-relaxed text-veenna-muted"
        >{{ notices }}</pre>
    </ModalBody>
  </VeennaModal>
</template>
