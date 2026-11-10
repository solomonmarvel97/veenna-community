<script setup lang="ts">
import { computed } from 'vue'
import AnimatedDots from '@/components/ui/AnimatedDots.vue'
import { ModalBody, ModalFooter, ModalHeader, VeennaButton, VeennaModal } from '@/components/veenna'
import type { LocalSpeechModelDef } from '@/lib/voice/localWhisperModels'
import { speechModelRuntimeLabel } from '@/lib/voice/localWhisperModels'
import type { HuggingFaceModelSpec } from '@/lib/voice/huggingfaceModelSpec'
import type { SpeechModelCompatibilityResult } from '@/lib/voice/speechModelRequirements'
import { formatMegabytes } from '@/lib/voice/speechModelRequirements'

const props = defineProps<{
  open: boolean
  model: LocalSpeechModelDef | null
  compatibility: SpeechModelCompatibilityResult | null
  machineSummary?: string | null
  hfSpec?: HuggingFaceModelSpec | null
  specsLoading?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const titleId = 'speech-model-requirements-title'

const requirements = computed(() => props.compatibility?.requirements ?? null)

const blockingIssues = computed(
  () =>
    props.compatibility?.issues.filter((issue) =>
      [
        'catalog_unavailable',
        'capabilities_unknown',
        'runtime_platform',
        'runtime_not_bundled',
        'runtime_not_ready',
        'unsupported_architecture',
        'insufficient_ram',
        'insufficient_disk',
      ].includes(issue.code),
    ) ?? [],
)

const warnings = computed(
  () => props.compatibility?.issues.filter((issue) => issue.code === 'low_ram') ?? [],
)
</script>

<template>
  <VeennaModal
    :open="open"
    :title-id="titleId"
    size="md"
    :z-index="140"
    panel-class="min-h-0"
    @close="emit('close')"
  >
    <ModalHeader
      :title="model ? `${model.label} requirements` : 'Model requirements'"
      :title-id="titleId"
      @close="emit('close')"
    />
    <ModalBody class="veenna-thin-scrollbar overscroll-contain">
      <p v-if="machineSummary" class="text-caption text-veenna-muted">
        This device: {{ machineSummary }}
      </p>

      <section
        v-if="model"
        class="rounded-md border border-veenna-divider bg-veenna-row-hover/40 px-3 py-2.5"
      >
        <p class="text-body font-medium text-veenna-foreground">{{ model.label }}</p>
        <p class="mt-1 text-caption text-veenna-muted">
          Runtime: {{ speechModelRuntimeLabel(model) }}
          <span v-if="requirements">
            · Download {{ formatMegabytes(requirements.downloadMb) }}
          </span>
          <span v-else> · {{ model.sizeLabel }}</span>
        </p>
      </section>

      <p v-if="specsLoading" class="text-caption text-veenna-muted">
        <AnimatedDots label="Loading model size from Hugging Face" size="sm" class="text-caption" />
      </p>

      <section v-if="requirements" class="space-y-2">
        <p class="text-label font-medium uppercase tracking-overline text-veenna-muted">Required</p>
        <ul class="space-y-1 text-caption text-veenna-muted">
          <li>Download size: {{ formatMegabytes(requirements.downloadMb) }}</li>
          <li>Free disk: ~{{ formatMegabytes(requirements.minFreeDiskMb) }}</li>
          <li>
            RAM: at least {{ formatMegabytes(requirements.minRamMb) }} (estimated from model size)
          </li>
          <li>Recommended RAM: {{ formatMegabytes(requirements.recommendedRamMb) }}</li>
          <li v-if="model">Runtime: {{ speechModelRuntimeLabel(model) }}</li>
        </ul>
        <p class="text-caption text-veenna-muted">
          <template v-if="requirements.source === 'huggingface'">
            Download size from Hugging Face
            <span v-if="hfSpec?.matchedFiles.length">
              ({{ hfSpec.matchedFiles.length }} veenna files) </span
            >. RAM is estimated from that size; Hugging Face does not publish a minimum RAM field.
          </template>
          <template v-else> Couldn't check download size. Showing an estimate instead. </template>
        </p>
      </section>

      <section v-if="blockingIssues.length" class="space-y-2">
        <p class="text-label font-medium uppercase tracking-overline text-red-400">
          Cannot run yet
        </p>
        <ul class="space-y-2">
          <li
            v-for="issue in blockingIssues"
            :key="issue.code"
            class="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2"
          >
            <p class="text-body font-medium text-veenna-foreground">{{ issue.title }}</p>
            <p class="mt-0.5 text-caption text-veenna-muted">{{ issue.detail }}</p>
          </li>
        </ul>
      </section>

      <section v-if="warnings.length" class="space-y-2">
        <p class="text-label font-medium uppercase tracking-overline text-amber-500">Warning</p>
        <ul class="space-y-2">
          <li
            v-for="issue in warnings"
            :key="issue.code"
            class="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2"
          >
            <p class="text-body font-medium text-veenna-foreground">{{ issue.title }}</p>
            <p class="mt-0.5 text-caption text-veenna-muted">{{ issue.detail }}</p>
          </li>
        </ul>
      </section>

      <section v-if="compatibility?.setupSteps?.length" class="space-y-2">
        <p class="text-label font-medium uppercase tracking-overline text-veenna-muted">
          To set up on this machine
        </p>
        <ol class="list-decimal space-y-1 pl-4 text-caption text-veenna-muted">
          <li v-for="(step, index) in compatibility.setupSteps" :key="index">{{ step }}</li>
        </ol>
      </section>
    </ModalBody>
    <ModalFooter variant="single" class="flex justify-end">
      <VeennaButton variant="primary" @click="emit('close')"> Got it </VeennaButton>
    </ModalFooter>
  </VeennaModal>
</template>
