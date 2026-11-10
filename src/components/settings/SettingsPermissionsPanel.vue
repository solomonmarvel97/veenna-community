<script setup lang="ts">
/**
 * What veenna has been allowed to do on this Mac, and how to change it.
 *
 * macOS keeps the final say: an app can raise the system's own prompt but not
 * grant itself anything, and it cannot revoke a grant at all. The honest
 * version of "clear" is a reset, which puts the permission back to never-asked
 * so the system will ask again next time. Every row says which of those it is
 * doing rather than implying more control than the OS gives.
 */
import { computed, onMounted, ref } from 'vue'
import { PhArrowSquareOut, PhShieldCheck } from '@phosphor-icons/vue'
import { Button } from '@/components/ui/button'
import { getVeennaElectron, isElectron } from '@/lib/platform/isElectron'
import { veennaUi } from '@/lib/veennaUi'
import { useToast } from '@/components/ui/toast/use-toast'
import type { VeennaPermission, VeennaPermissionStatus } from '@/types/electron'
import Skeleton from '@/components/ui/Skeleton.vue'
import { usePermissionRecheck } from '@/composables/usePermissionRecheck'
import { skeletonDelay } from '@/lib/skeleton'

const api = getVeennaElectron()
const { toast } = useToast()

const permissions = ref<VeennaPermission[]>([])
const loading = ref(true)
const supported = ref(false)
const platform = ref<string>('')

/** Each OS calls its own settings app something different. */
const osName = computed(() => {
  if (platform.value === 'darwin') return 'macOS'
  if (platform.value === 'win32') return 'Windows'
  return 'your system'
})
const settingsAppName = computed(() =>
  platform.value === 'win32' ? 'Windows Settings' : 'System Settings',
)
/** The row currently waiting on the system, so only its buttons go quiet. */
const busyId = ref<string | null>(null)
/**
 * Cleared since this window opened. macOS keeps its answer cached per process,
 * so these can no longer raise a prompt and have to be granted in Settings.
 */
const clearedThisSession = ref(new Set<string>())

const canManage = computed(() => isElectron && Boolean(api?.listSystemPermissions))

const STATUS_LABEL: Record<VeennaPermissionStatus, string> = {
  granted: 'Allowed',
  denied: 'Not allowed',
  'not-determined': 'Not asked yet',
  restricted: 'Blocked by this Mac',
  unknown: 'Unknown',
  unsupported: 'Not needed here',
}

const STATUS_CLASS: Record<VeennaPermissionStatus, string> = {
  granted: 'bg-emerald-500/15 text-emerald-500',
  denied: 'bg-red-500/15 text-red-400',
  'not-determined': 'bg-veenna-row text-veenna-muted',
  restricted: 'bg-amber-500/15 text-amber-500',
  unknown: 'bg-veenna-row text-veenna-muted',
  unsupported: 'bg-veenna-row text-veenna-muted',
}

function statusLabel(status: VeennaPermissionStatus) {
  return STATUS_LABEL[status] ?? STATUS_LABEL.unknown
}

function statusClass(status: VeennaPermissionStatus) {
  return STATUS_CLASS[status] ?? STATUS_CLASS.unknown
}

/**
 * What the ask button should say. "Allow" reads as a promise this page cannot
 * keep, so it says what actually happens: the system is asked, or the pane is
 * opened for the user to do it by hand.
 *
 * A permission cleared in this session falls in the second group even though
 * macOS has a prompt for it - the prompt cannot fire again until the app
 * restarts, so offering to ask would be offering nothing.
 */
function requestLabel(permission: VeennaPermission) {
  if (permission.status === 'granted') return null
  if (
    permission.canRequest &&
    permission.status === 'not-determined' &&
    !clearedThisSession.value.has(permission.id)
  ) {
    return `Ask ${osName.value}`
  }
  return `Open ${settingsAppName.value}`
}

async function refresh() {
  if (!api?.listSystemPermissions) {
    loading.value = false
    return
  }
  try {
    const result = await api.listSystemPermissions()
    supported.value = Boolean(result?.supported)
    platform.value = String(result?.platform || '')
    permissions.value = result?.permissions ?? []
  } catch {
    supported.value = false
  } finally {
    loading.value = false
  }
}

async function onRequest(permission: VeennaPermission) {
  if (busyId.value) return
  busyId.value = permission.id
  try {
    const result = await api?.requestSystemPermission?.(permission.id)
    clearedThisSession.value = new Set(
      [...clearedThisSession.value].filter((id) => id !== permission.id),
    )
    if (result?.status === 'granted') applyStatus(permission.id, 'granted')
    if (result?.promptUnavailable) {
      toast({
        title: `Turn ${permission.label.toLowerCase()} on in ${settingsAppName.value}`,
      })
    }
  } catch (err) {
    toast({
      title: 'Could not open that',
      description: err instanceof Error ? err.message : `Try ${settingsAppName.value} directly.`,
      variant: 'destructive',
    })
  } finally {
    busyId.value = null
    // Granting happens outside this window, so read the state back rather than
    // assuming the click worked - now, and again until the switch is flipped.
    await refresh()
    if (permissions.value.find((p) => p.id === permission.id)?.status !== 'granted') {
      awaitingId = permission.id
      recheck.watch()
    }
  }
}

async function onReset(permission: VeennaPermission) {
  if (busyId.value) return
  busyId.value = permission.id
  try {
    const result = await api?.resetSystemPermission?.(permission.id)
    if (result?.ok) {
      // The main process already read the status back for us, and for the two
      // whose probes cache until relaunch its answer beats anything a refresh
      // could ask. Take it, rather than letting refresh() overwrite it.
      applyStatus(permission.id, result.status)
      clearedThisSession.value = new Set(clearedThisSession.value).add(permission.id)
      toast({
        title: `${permission.label} cleared`,
        description: `${osName.value} will ask again next time.`,
      })
      return
    }
    toast({
      title: `Could not clear ${permission.label.toLowerCase()}`,
      description: result?.opened
        ? `This machine would not let veenna reset it, so ${settingsAppName.value} is open instead.`
        : result?.reason || `Turn it off in ${settingsAppName.value} instead.`,
      variant: 'destructive',
    })
    await refresh()
  } finally {
    busyId.value = null
  }
}

/** The permission the user was just sent off to grant, until it lands. */
let awaitingId: string | null = null
const recheck = usePermissionRecheck(refresh, () => {
  const row = permissions.value.find((p) => p.id === awaitingId)
  return !row || row.status === 'granted'
})

/** Patch one row in place, so a refresh cannot walk back what we just did. */
function applyStatus(id: string, status: VeennaPermissionStatus | undefined) {
  if (!status) return
  permissions.value = permissions.value.map((row) => (row.id === id ? { ...row, status } : row))
}

onMounted(refresh)
</script>

<template>
  <div class="w-full space-y-4">
    <section v-if="!canManage" :class="veennaUi.settingsCard">
      <div :class="veennaUi.settingsRow">
        <div class="flex items-start gap-3">
          <PhShieldCheck class="mt-0.5 size-5 shrink-0 text-veenna-muted" weight="fill" />
          <div class="min-w-0 space-y-0.5">
            <p class="text-body font-medium text-veenna-foreground">Nothing to manage here</p>
            <p class="text-caption text-veenna-muted">
              System permissions belong to the desktop app. In the browser, your browser handles
              them from the padlock in the address bar.
            </p>
          </div>
        </div>
      </div>
    </section>

    <template v-else>
      <section :class="veennaUi.settingsCard">
        <p :class="veennaUi.settingsGroupTitle">System permissions</p>

        <div
          v-if="loading"
          :class="veennaUi.settingsRows"
          role="status"
          aria-busy="true"
          aria-label="Loading permissions"
        >
          <div v-for="n in 4" :key="n" :class="veennaUi.settingsRow">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1.5">
                <Skeleton class="h-3.5 w-32" :delay="skeletonDelay(n - 1)" />
                <Skeleton class="h-2.5 w-full max-w-sm" :animated="false" />
              </div>
              <Skeleton rounded="full" class="h-6 w-20 shrink-0" :animated="false" />
            </div>
          </div>
        </div>

        <div v-else-if="!supported || !permissions.length" :class="veennaUi.settingsRow">
          <p class="text-caption text-veenna-muted">
            Nothing to manage on this system. Linux desktops leave microphone and screen access to
            the session and its portals rather than to a per-app permission, so there is no list
            here to grant or clear.
          </p>
        </div>

        <div v-else :class="veennaUi.settingsRows">
          <div v-for="permission in permissions" :key="permission.id" :class="veennaUi.settingsRow">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 space-y-0.5">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-body font-medium text-veenna-foreground">{{ permission.label }}</p>
                  <span
                    class="shrink-0 rounded-full px-1.5 py-0.5 text-micro font-medium leading-none"
                    :class="statusClass(permission.status)"
                  >
                    {{ statusLabel(permission.status) }}
                  </span>
                </div>
                <p class="text-caption text-veenna-muted">{{ permission.purpose }}</p>
              </div>

              <div class="flex shrink-0 items-center gap-1.5">
                <Button
                  v-if="requestLabel(permission)"
                  size="sm"
                  variant="flatMuted"
                  :disabled="busyId === permission.id"
                  @click="onRequest(permission)"
                >
                  {{ requestLabel(permission) }}
                </Button>
                <Button
                  v-if="permission.canReset && permission.status !== 'not-determined'"
                  size="sm"
                  variant="flatMuted"
                  class="text-destructive"
                  :disabled="busyId === permission.id"
                  :title="`Put ${permission.label.toLowerCase()} back to never-asked`"
                  @click="onReset(permission)"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section :class="veennaUi.settingsCard">
        <div :class="veennaUi.settingsRow">
          <div class="space-y-1.5">
            <p class="text-caption leading-relaxed text-veenna-muted">
              {{ osName }} has the last word on all of these. veenna can ask, and on macOS it can
              clear a grant so you are asked again, but only you can allow one - in
              {{ settingsAppName }}, under privacy.
            </p>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-caption text-primary link-dotted"
              @click="api?.openSystemPermissionSettings?.(permissions[0]?.id ?? 'microphone')"
            >
              Open {{ settingsAppName }}
              <PhArrowSquareOut class="size-3" />
            </button>
          </div>
        </div>
      </section>
    </template>

    <!-- Desktop only: in the browser the agent always uses Veenna's sandbox. -->

  </div>
</template>
