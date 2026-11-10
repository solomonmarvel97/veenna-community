<script setup lang="ts">
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { PhCheckCircle, PhDownloadSimple, PhTrash, PhWarningCircle } from '@phosphor-icons/vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AnimatedDots from '@/components/ui/AnimatedDots.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { VeennaButton } from '@/components/veenna'
import { isElectron } from '@/lib/platform/isElectron'
import { DEFAULT_LOCAL_SPEECH_MODEL_ID, LOCAL_SPEECH_MODELS, localSpeechModelDef, SPEECH_MODEL_PROVIDERS, tierLabel, familyLabel, speechModelRuntimeLabel, type LocalSpeechModelId } from '@/lib/voice/localWhisperModels'
import { preloadGuestSttModel, resetGuestSttModel } from '@/lib/voice/localStt'
import { onSpeechModelSettingsChanged, readSpeechModelSettings, writeSpeechModelSettings } from '@/lib/voice/speechModelSettings'
import { cancelWhisperModelDownload, deleteWhisperModel, downloadWhisperModel, formatModelBytes, listWhisperModels, subscribeWhisperModelDownloadProgress, type WhisperModelDownloadProgress, type WhisperModelStatus } from '@/lib/voice/whisperModelClient'
import { veennaUi } from '@/lib/veennaUi'
import { speechProviderLogoSrc } from '@/config/speechProviderLogos'
import SpeechModelRequirementsModal from '@/components/settings/SpeechModelRequirementsModal.vue'
import { fetchSpeechCapabilitiesDetailed } from '@/lib/voice/speechCapabilitiesClient'
import { fetchHuggingFaceModelSpec, getCachedHuggingFaceModelSpec, prefetchHuggingFaceModelSpecs } from '@/lib/voice/huggingfaceModelSpec'
import { checkSpeechModelCompatibility, machineSummaryLabel, type SpeechCapabilitiesSnapshot, type SpeechModelCompatibilityResult } from '@/lib/voice/speechModelRequirements'
import { useErrorToast } from '@/composables/useMessageToast'
import SettingsRowTitle from '@/components/settings/SettingsRowTitle.vue'

const voiceSettingsStore = useVoiceSettingsStore()
const settings = ref(readSpeechModelSettings())
const modelStatuses = ref<WhisperModelStatus[]>([])
const loadingCatalog = ref(false)
const preloading = ref(false)
const downloadProgress = ref<WhisperModelDownloadProgress | null>(null)
const actionError = ref<string | null>(null)
const speechCapabilities = ref<SpeechCapabilitiesSnapshot | null>(null)
const requirementsModal = ref<{
  model: (typeof LOCAL_SPEECH_MODELS)[number]
  compatibility: SpeechModelCompatibilityResult
} | null>(null)
const hfSpecRevision = ref(0)
const hfSpecsLoading = ref(false)
const capabilitiesError = ref<string | null>(null)

const machineSummary = computed(() =>
  speechCapabilities.value ? machineSummaryLabel(speechCapabilities.value.machine) : null,
)

const activeLocalModel = computed(() => localSpeechModelDef(settings.value.localModelId))
const providers = computed(() => SPEECH_MODEL_PROVIDERS)

const installedModelOptions = computed(() => modelStatuses.value.filter((model) => model.installed))

// Veenna Community only ever transcribes on this device.
const effectiveEngineLabel = computed(() => 'On-device')

const activeDownloadPercent = computed(() => downloadProgress.value?.percent ?? 0)

let stopSettingsListener: (() => void) | undefined
let stopProgressListener: (() => void) | undefined
let lastProgressUiAt = 0

function patch(
  partial: Parameters<typeof writeSpeechModelSettings>[0],
  options?: { preload?: boolean },
) {
  const prevModelId = settings.value.localModelId
  settings.value = writeSpeechModelSettings(partial)
  if (partial.localModelId && partial.localModelId !== prevModelId) {
    resetGuestSttModel()
    if (options?.preload !== false) void preloadActiveModel()
  }
}

function statusFor(modelId: string) {
  return modelStatuses.value.find((entry) => entry.id === modelId)
}

function isActiveModel(modelId: string) {
  return settings.value.localModelId === modelId
}

function isModelDownloading(modelId: string) {
  return (
    downloadProgress.value?.modelId === modelId && downloadProgress.value?.phase === 'downloading'
  )
}

function modelDownloadPercent(modelId: string) {
  if (downloadProgress.value?.modelId !== modelId) return 0
  return downloadProgress.value?.percent ?? 0
}

function modelsForProvider(provider: string) {
  return LOCAL_SPEECH_MODELS.filter((model) => model.provider === provider)
}

function modelTags(model: (typeof LOCAL_SPEECH_MODELS)[number]) {
  type Tagged = { tags?: string[] } | null | undefined
  return (model as Tagged)?.tags ?? (statusFor(model.id) as Tagged)?.tags ?? []
}

function hfSpecFor(modelId: string) {
  void hfSpecRevision.value
  return getCachedHuggingFaceModelSpec(modelId)
}

async function ensureSpeechCapabilities() {
  if (speechCapabilities.value) return speechCapabilities.value
  if (!isElectron) return null
  const result = await fetchSpeechCapabilitiesDetailed({ refresh: true })
  speechCapabilities.value = result.capabilities
  capabilitiesError.value = result.error
  return result.capabilities
}

function closeRequirementsModal() {
  requirementsModal.value = null
}

async function ensureModelCanRun(model: (typeof LOCAL_SPEECH_MODELS)[number]) {
  let spec = hfSpecFor(model.id)
  if (!spec) {
    spec = await fetchHuggingFaceModelSpec(model)
    hfSpecRevision.value += 1
  }
  await ensureSpeechCapabilities()
  const compatibility = checkSpeechModelCompatibility(model, speechCapabilities.value, spec, {
    capabilitiesError: capabilitiesError.value,
    inDesktopApp: isElectron,
  })
  if (!compatibility.ok) {
    requirementsModal.value = { model, compatibility }
    return false
  }
  return true
}

async function loadHuggingFaceSpecs() {
  hfSpecsLoading.value = true
  try {
    await prefetchHuggingFaceModelSpecs(LOCAL_SPEECH_MODELS)
    hfSpecRevision.value += 1
  } finally {
    hfSpecsLoading.value = false
  }
}

async function loadSpeechCapabilities() {
  if (!isElectron) return
  const result = await fetchSpeechCapabilitiesDetailed()
  speechCapabilities.value = result.capabilities
  capabilitiesError.value = result.error
}

async function refreshCatalog() {
  if (!isElectron) {
    modelStatuses.value = LOCAL_SPEECH_MODELS.map((model) => ({
      ...model,
      localAvailable: model.localAvailable !== false,
      tags: model.tags ?? [],
      installed: model.bundled,
      source: model.bundled ? ('bundled' as const) : null,
      bytesOnDisk: 0,
      downloading: false,
    }))
    return
  }
  loadingCatalog.value = true
  actionError.value = null
  try {
    modelStatuses.value = await listWhisperModels()
  } finally {
    loadingCatalog.value = false
  }
}

async function preloadActiveModel() {
  if (!isElectron) return
  preloading.value = true
  try {
    resetGuestSttModel()
    await preloadGuestSttModel()
  } finally {
    preloading.value = false
  }
}

async function useModel(modelId: LocalSpeechModelId) {
  const model = localSpeechModelDef(modelId)
  if (!model) return
  if (!(await ensureModelCanRun(model))) return
  const status = statusFor(modelId)
  if (!status?.installed) {
    actionError.value = 'Download this model before selecting it.'
    return
  }
  patch({ localModelId: modelId })
}

async function startDownload(modelId: LocalSpeechModelId) {
  if (!isElectron) return
  const model = localSpeechModelDef(modelId)
  if (!model || !(await ensureModelCanRun(model))) return
  actionError.value = null
  downloadProgress.value = {
    modelId,
    phase: 'downloading',
    file: null,
    fileIndex: 0,
    fileCount: 7,
    percent: 0,
  }
  const result = await downloadWhisperModel(modelId)
  downloadProgress.value = null
  if (result?.models) {
    modelStatuses.value = result.models as WhisperModelStatus[]
  } else {
    await refreshCatalog()
  }
  if (!result?.ok) {
    actionError.value = result?.reason || 'Download failed'
    return
  }
  patch({ localModelId: modelId }, { preload: false })
}

async function cancelDownload(modelId: LocalSpeechModelId) {
  await cancelWhisperModelDownload(modelId)
  downloadProgress.value = null
  await refreshCatalog()
}

async function removeModel(modelId: LocalSpeechModelId) {
  const result = await deleteWhisperModel(modelId)
  if (result?.models) {
    modelStatuses.value = result.models as WhisperModelStatus[]
  } else {
    await refreshCatalog()
  }
  if (!result?.ok) {
    actionError.value = result?.reason || 'Could not remove model'
    return
  }
  if (settings.value.localModelId === modelId) {
    patch({ localModelId: DEFAULT_LOCAL_SPEECH_MODEL_ID })
  }
}

function onLocalModelChange(value: string) {
  void useModel(value as LocalSpeechModelId)
}

onMounted(() => {
  stopSettingsListener = onSpeechModelSettingsChanged((next) => {
    settings.value = next
  })
  stopProgressListener = subscribeWhisperModelDownloadProgress((progress) => {
    const now = Date.now()
    const force = progress.phase === 'done' || progress.phase === 'error'
    if (!force && now - lastProgressUiAt < 120) return
    lastProgressUiAt = now
    downloadProgress.value = progress
    if (progress.phase === 'done') {
      void refreshCatalog()
    }
  })
  void loadSpeechCapabilities()
  void loadHuggingFaceSpecs()
  void refreshCatalog()
})

onUnmounted(() => {
  stopSettingsListener?.()
  stopProgressListener?.()
})

useErrorToast(actionError)
</script>

<template>
  <div class="w-full space-y-4">
    <section
      :class="[veennaUi.settingsCard, veennaUi.settingsInset, 'border-veenna-accent/30 bg-veenna-accent/5']"
    >
      <p class="text-body font-medium text-veenna-foreground">Effective engine</p>
      <p class="mt-1 text-caption text-veenna-muted">
        {{ effectiveEngineLabel }}
        <span v-if="activeLocalModel"> · {{ activeLocalModel.label }}</span>
      </p>
    </section>

    <section
      v-if="machineSummary"
      :class="[veennaUi.settingsCard, veennaUi.settingsInset, 'border-veenna-accent/30 bg-veenna-accent/5']"
    >
      <p class="text-body font-medium text-veenna-foreground">This device</p>
      <p class="mt-1 text-caption text-veenna-muted">{{ machineSummary }}</p>
      <p v-if="speechCapabilities?.machine.pythonVersion" class="mt-1 text-caption text-veenna-muted">
        Python {{ speechCapabilities.machine.pythonVersion }} detected
      </p>
      <p
        v-if="speechCapabilities?.runtimes['onnx-node']?.ready"
        class="mt-1 text-caption text-emerald-500"
      >
        ONNX Runtime (Node) ready - desktop app will use the main-process engine.
      </p>
    </section>

    <section v-if="isElectron" :class="veennaUi.settingsCard">
      <p :class="veennaUi.settingsGroupTitle">Active local model</p>
      <div :class="veennaUi.settingsRow">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 space-y-0.5">
            <SettingsRowTitle
              hint="Whisper Base and Tiny ship with the app; Small, Medium, and Large download first. All run fully on-device."
              >Model in use</SettingsRowTitle
            >
          </div>
          <Select
            :model-value="settings.localModelId"
            :disabled="installedModelOptions.length === 0"
            @update:model-value="onLocalModelChange($event as string)"
          >
            <SelectTrigger class="w-full min-w-[11rem] sm:w-[12rem]">
              <SelectValue placeholder="Installed model">
                <span v-if="activeLocalModel" class="flex min-w-0 items-center gap-2">
                  <div
                    v-if="speechProviderLogoSrc(activeLocalModel.provider)"
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/95 p-0.5 ring-1 ring-black/5"
                  >
                    <img
                      :src="speechProviderLogoSrc(activeLocalModel.provider)!"
                      :alt="`${activeLocalModel.provider} logo`"
                      class="h-full w-full object-contain"
                    />
                  </div>
                  <span class="truncate">{{ activeLocalModel.label }}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="model in installedModelOptions" :key="model.id" :value="model.id">
                <span class="flex items-center gap-2">
                  <div
                    v-if="speechProviderLogoSrc(model.provider)"
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/95 p-0.5 ring-1 ring-black/5"
                  >
                    <img
                      :src="speechProviderLogoSrc(model.provider)!"
                      :alt="`${model.provider} logo`"
                      class="h-full w-full object-contain"
                    />
                  </div>
                  <span>{{ model.label }}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="isElectron" class="mt-3 flex flex-wrap gap-2">
          <VeennaButton
            variant="muted"
            :loading="preloading"
            :disabled="loadingCatalog"
            @click="preloadActiveModel"
          >
            Preload active model
          </VeennaButton>
        </div>
      </div>
    </section>

    <section
      v-if="downloadProgress"
      :class="[veennaUi.settingsCard, veennaUi.settingsInset]"
      data-testid="model-download-progress"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="min-w-0 truncate text-body-sm font-medium text-veenna-foreground">
          Downloading
          {{ localSpeechModelDef(downloadProgress.modelId)?.label || downloadProgress.modelId }}
        </p>
        <div class="flex shrink-0 items-center gap-3">
          <span class="text-caption tabular-nums text-veenna-muted">
            {{ Math.round(activeDownloadPercent) }}%
          </span>
          <button
            type="button"
            class="text-caption text-veenna-muted transition-colors hover:text-destructive focus-visible:outline-none focus-visible:underline"
            @click="cancelDownload(downloadProgress.modelId)"
          >
            Cancel
          </button>
        </div>
      </div>
      <div
        class="mt-2 h-1 overflow-hidden rounded-full bg-veenna-row-hover"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(activeDownloadPercent)"
      >
        <div
          class="h-full rounded-full bg-veenna-accent transition-all"
          :style="{ width: `${activeDownloadPercent}%` }"
        />
      </div>
      <p class="mt-1.5 truncate text-caption text-veenna-muted">
        <AnimatedDots
          v-if="!downloadProgress.file"
          label="Preparing"
          size="sm"
          class="text-caption"
        />
        <template v-else>{{ downloadProgress.file }}</template>
        ({{ downloadProgress.fileIndex }}/{{ downloadProgress.fileCount }})
        <span v-if="downloadProgress.bytesTotal">
          · {{ formatModelBytes(downloadProgress.bytesReceived ?? 0) }} /
          {{ formatModelBytes(downloadProgress.bytesTotal) }}
        </span>
      </p>
    </section>

    <template v-if="isElectron">
      <template v-if="loadingCatalog">
        <section
          v-for="n in 1"
          :key="`speech-sk-${n}`"
          :class="veennaUi.settingsCard"
          aria-busy="true"
          aria-label="Loading speech models"
        >
          <div class="flex items-center gap-2.5 border-b border-veenna-divider px-4 py-3">
            <Skeleton class="h-6 w-6 shrink-0" rounded="md" />
            <Skeleton class="h-3 w-28" rounded="md" />
          </div>
          <div :class="veennaUi.settingsRows">
            <div v-for="row in 3" :key="`speech-sk-row-${n}-${row}`" :class="veennaUi.settingsRow">
              <div class="flex items-start gap-3">
                <Skeleton class="mt-0.5 h-8 w-8 shrink-0" rounded="md" />
                <div class="min-w-0 flex-1 space-y-1.5">
                  <Skeleton class="h-3.5 w-40 max-w-[70%]" rounded="md" />
                  <Skeleton class="h-3 w-56 max-w-full" rounded="md" />
                  <Skeleton class="h-3 w-24" rounded="md" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
      <template v-else>
        <section v-for="provider in providers" :key="provider" :class="veennaUi.settingsCard">
          <div class="flex items-center gap-2.5 border-b border-veenna-divider px-4 py-3">
            <div
              v-if="speechProviderLogoSrc(provider)"
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/95 p-1 ring-1 ring-black/5"
            >
              <img
                :src="speechProviderLogoSrc(provider)!"
                :alt="`${provider} logo`"
                class="h-full w-full object-contain"
              />
            </div>
            <p class="text-label font-medium uppercase tracking-overline text-veenna-muted">
              {{ provider }} models
            </p>
          </div>
          <div :class="veennaUi.settingsRows">
            <div
              v-for="model in modelsForProvider(provider)"
              :key="model.id"
              :class="veennaUi.settingsRow"
            >
              <div class="flex flex-col gap-2">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="flex min-w-0 flex-1 gap-3">
                    <div
                      v-if="speechProviderLogoSrc(model.provider)"
                      class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/95 p-1 ring-1 ring-black/5"
                    >
                      <img
                        :src="speechProviderLogoSrc(model.provider)!"
                        :alt="`${model.provider} logo`"
                        class="h-full w-full object-contain"
                      />
                    </div>
                    <div class="min-w-0 flex-1 space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-body font-medium text-veenna-foreground">{{ model.label }}</p>
                        <span
                          v-if="isActiveModel(model.id)"
                          class="rounded-md bg-veenna-accent/15 px-1.5 py-0.5 text-micro font-medium text-veenna-accent"
                        >
                          Active
                        </span>
                        <span
                          v-if="statusFor(model.id)?.installed"
                          class="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-micro text-emerald-500"
                        >
                          Installed
                        </span>
                        <span
                          v-for="tag in modelTags(model)"
                          :key="tag"
                          class="rounded-md bg-veenna-accent/5 px-1.5 py-0.5 text-micro text-veenna-muted/70"
                        >
                          {{ tag }}
                        </span>
                        <span
                          class="rounded-md bg-veenna-row-hover/60 px-1.5 py-0.5 text-micro text-veenna-muted/70"
                        >
                          {{ tierLabel(model.tier) }}
                        </span>
                        <span class="text-caption text-veenna-muted">{{ model.sizeLabel }}</span>
                      </div>
                      <p class="text-caption text-veenna-muted">{{ model.description }}</p>
                      <p class="text-caption text-veenna-muted">{{ familyLabel(model.family) }}</p>
                      <p
                        v-if="statusFor(model.id)?.bytesOnDisk"
                        class="text-caption text-veenna-muted"
                      >
                        On disk: {{ formatModelBytes(statusFor(model.id)!.bytesOnDisk) }}
                        <span v-if="statusFor(model.id)?.source === 'bundled'"> · bundled</span>
                      </p>
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-wrap gap-1.5 sm:pt-0.5">
                    <VeennaButton
                      v-if="statusFor(model.id)?.installed && !isActiveModel(model.id)"
                      variant="secondary"
                      @click="useModel(model.id)"
                    >
                      Use
                    </VeennaButton>
                    <VeennaButton
                      v-if="!statusFor(model.id)?.installed && isElectron"
                      variant="primary"
                      :class="
                        isModelDownloading(model.id)
                          ? 'relative overflow-hidden text-caption disabled:!opacity-100'
                          : 'relative overflow-hidden text-caption'
                      "
                      :loading="isModelDownloading(model.id)"
                      :disabled="Boolean(downloadProgress) || loadingCatalog"
                      @click="startDownload(model.id)"
                    >
                      <span
                        v-if="isModelDownloading(model.id)"
                        class="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-200 ease-out"
                        :style="{ width: `${modelDownloadPercent(model.id)}%` }"
                        aria-hidden="true"
                      />
                      <PhDownloadSimple class="relative z-[1] h-3.5 w-3.5" />
                      <span class="relative z-[1]">
                        {{
                          isModelDownloading(model.id)
                            ? `${modelDownloadPercent(model.id)}%`
                            : 'Download'
                        }}
                      </span>
                    </VeennaButton>
                    <VeennaButton
                      v-if="
                        statusFor(model.id)?.installed &&
                        !model.bundled &&
                        statusFor(model.id)?.source === 'user' &&
                        isElectron
                      "
                      variant="secondary"
                      @click="removeModel(model.id)"
                    >
                      <PhTrash class="h-3.5 w-3.5" />
                      Remove
                    </VeennaButton>
                    <PhCheckCircle
                      v-if="statusFor(model.id)?.installed && isActiveModel(model.id)"
                      class="h-5 w-5 text-emerald-500"
                      weight="fill"
                    />
                    <PhWarningCircle
                      v-else-if="!isElectron && !model.bundled"
                      class="h-5 w-5 text-amber-500"
                      weight="fill"
                    />
                  </div>
                </div>
                <div class="flex w-full items-center justify-between gap-3">
                  <a
                    :href="model.huggingFaceUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-caption text-veenna-accent link-dotted"
                  >
                    View on Hugging Face
                  </a>
                  <span class="shrink-0 text-caption text-veenna-muted">
                    {{ speechModelRuntimeLabel(model, speechCapabilities) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </template>

    <section v-if="!isElectron" :class="[veennaUi.settingsCard, veennaUi.settingsInset]">
      <p class="text-body font-medium text-veenna-foreground">Desktop only</p>
      <p class="mt-1 text-caption text-veenna-muted">
        Downloading and running local Whisper models requires the veenna desktop app.
      </p>
    </section>

    <SpeechModelRequirementsModal
      :open="Boolean(requirementsModal)"
      :model="requirementsModal?.model ?? null"
      :compatibility="requirementsModal?.compatibility ?? null"
      :machine-summary="machineSummary"
      :hf-spec="requirementsModal?.model ? hfSpecFor(requirementsModal.model.id) : null"
      :specs-loading="hfSpecsLoading"
      @close="closeRequirementsModal"
    />
  </div>
</template>
