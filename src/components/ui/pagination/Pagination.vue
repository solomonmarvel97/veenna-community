<template>
  <div
    v-if="totalPages > 1 || alwaysShow"
    ref="rootRef"
    class="relative z-20 isolate flex w-full min-w-0 items-center justify-between gap-3"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div v-if="showItemsPerPageSelect" class="flex shrink-0 items-center gap-2">
        <Select
          :model-value="itemsPerPage.toString()"
          :disabled="navDisabled"
          @update:model-value="onItemsPerPageChange"
        >
          <SelectTrigger
            class="h-8 w-[4.25rem] min-w-[4.25rem] gap-1 rounded-md px-2.5 text-caption tabular-nums [&>span:first-child]:overflow-visible [&>span:first-child]:whitespace-nowrap"
            :disabled="navDisabled"
            aria-label="Rows per page"
          >
            <SelectValue :placeholder="itemsPerPage.toString()" />
          </SelectTrigger>
          <SelectContent
            :side="pageSizeSelectSide"
            :side-offset="4"
            :class="cn('min-w-[4.25rem]', selectContentClass)"
          >
            <SelectItem
              v-for="size in pageSizeOptions"
              :key="size"
              :value="size.toString()"
              :class="cn('tabular-nums', selectItemClass)"
            >
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
        <PhSpinner
          v-if="showItemsPerPageSpinner"
          class="h-4 w-4 animate-spin text-veenna-fg"
          aria-label="Loading page size"
        />
      </div>

      <div
        v-if="showResultsText"
        class="min-w-0 truncate whitespace-nowrap text-body tabular-nums text-veenna-muted"
      >
        {{ resultsLabel }}
      </div>
    </div>

    <div
      class="flex shrink-0 items-stretch overflow-hidden rounded-md border border-veenna-border bg-veenna-row divide-x divide-veenna-border"
    >
      <button
        type="button"
        :class="navButtonClass"
        :disabled="pageButtonsDisabled || currentPage <= 1"
        aria-label="First page"
        @click="goToPage(1)"
      >
        <PhSpinner
          v-if="currentPage > 1 && isSpinningFor(1)"
          class="size-3.5 shrink-0 animate-spin text-veenna-fg"
        />
        <PhCaretDoubleLeft v-else class="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        :class="navButtonClass"
        :disabled="pageButtonsDisabled || currentPage <= 1"
        aria-label="Previous page"
        @click="goToPage(currentPage - 1)"
      >
        <PhSpinner
          v-if="currentPage - 1 > 1 && isSpinningFor(currentPage - 1)"
          class="size-3.5 shrink-0 animate-spin text-veenna-fg"
        />
        <PhCaretLeft v-else class="size-3.5 shrink-0" />
      </button>
      <button
        v-if="showFirstPage"
        type="button"
        :class="pageButtonClass(false)"
        :disabled="pageButtonsDisabled"
        aria-label="Page 1"
        @click="goToPage(1)"
      >
        <PhSpinner v-if="isSpinningFor(1)" class="size-3.5 shrink-0 animate-spin text-veenna-fg" />
        <span v-else>1</span>
      </button>
      <span v-if="showStartEllipsis" :class="ellipsisClass">…</span>
      <button
        v-for="page in visiblePages"
        :key="page"
        type="button"
        :class="pageButtonClass(page === currentPage)"
        :disabled="pageButtonsDisabled"
        :aria-current="page === currentPage ? 'page' : undefined"
        :aria-label="`Page ${page}`"
        @click="goToPage(page)"
      >
        <PhSpinner v-if="isSpinningFor(page)" class="size-3.5 shrink-0 animate-spin text-veenna-fg" />
        <span v-else>{{ page }}</span>
      </button>
      <span v-if="showEndEllipsis" :class="ellipsisClass">…</span>
      <button
        v-if="showLastPage"
        type="button"
        :class="pageButtonClass(false)"
        :disabled="pageButtonsDisabled"
        :aria-label="`Page ${totalPages}`"
        @click="goToPage(totalPages)"
      >
        <PhSpinner
          v-if="isSpinningFor(totalPages)"
          class="size-3.5 shrink-0 animate-spin text-veenna-fg"
        />
        <span v-else>{{ totalPages }}</span>
      </button>
      <button
        type="button"
        :class="navButtonClass"
        :disabled="pageButtonsDisabled || currentPage >= totalPages"
        aria-label="Next page"
        @click="goToPage(currentPage + 1)"
      >
        <PhSpinner
          v-if="currentPage + 1 < totalPages && isSpinningFor(currentPage + 1)"
          class="size-3.5 shrink-0 animate-spin text-veenna-fg"
        />
        <PhCaretRight v-else class="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        :class="navButtonClass"
        :disabled="pageButtonsDisabled || currentPage >= totalPages"
        aria-label="Last page"
        @click="goToPage(totalPages)"
      >
        <PhSpinner
          v-if="currentPage < totalPages && isSpinningFor(totalPages)"
          class="size-3.5 shrink-0 animate-spin text-veenna-fg"
        />
        <PhCaretDoubleRight v-else class="size-3.5 shrink-0" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PhCaretDoubleLeft,
  PhCaretDoubleRight,
  PhCaretLeft,
  PhCaretRight,
  PhSpinner,
} from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'

interface Props {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  loading?: boolean
  pageSizeOptions?: number[]
  pageSizeSelectSide?: 'top' | 'right' | 'bottom' | 'left'
  selectContentClass?: string
  selectItemClass?: string
  showResultsText?: boolean
  showItemsPerPageSelect?: boolean
  /** Keep the bar visible on a single page (page size + result count). */
  alwaysShow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currentPage: 1,
  totalItems: 0,
  itemsPerPage: 10,
  loading: false,
  pageSizeOptions: () => [10, 20, 50, 100],
  pageSizeSelectSide: 'top',
  selectContentClass: '',
  selectItemClass: '',
  showResultsText: true,
  showItemsPerPageSelect: true,
  alwaysShow: false,
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:itemsPerPage': [size: number]
}>()

const totalPages = computed(() => {
  const perPage = Math.max(1, props.itemsPerPage)
  return Math.ceil(Math.max(0, props.totalItems) / perPage)
})

const resultsLabel = computed(() => {
  const total = Math.max(0, props.totalItems)
  if (total === 0) return 'Showing 0 of 0'
  const perPage = Math.max(1, props.itemsPerPage)
  const page = Math.min(Math.max(1, props.currentPage), Math.max(1, totalPages.value))
  const from = (page - 1) * perPage + 1
  const to = Math.min(total, page * perPage)
  return `Showing ${from.toLocaleString()}-${to.toLocaleString()} of ${total.toLocaleString()}`
})

const cellBase =
  'inline-flex h-8 items-center justify-center text-caption tabular-nums transition-colors focus:outline-none focus-visible:bg-veenna-row-hover'

const navButtonClass = `${cellBase} w-8 text-veenna-secondary hover:bg-veenna-row-hover hover:text-veenna-fg disabled:pointer-events-none disabled:opacity-40`

const ellipsisClass = `${cellBase} w-8 text-veenna-secondary`

function pageButtonClass(active: boolean) {
  return cn(
    cellBase,
    'min-w-10 px-2.5 font-normal',
    active
      ? 'bg-veenna-bg text-veenna-fg'
      : 'text-veenna-secondary hover:bg-veenna-row-hover hover:text-veenna-fg',
  )
}

const maxVisiblePages = 3
const halfVisible = Math.floor(maxVisiblePages / 2)

const visiblePages = computed(() => {
  if (totalPages.value <= maxVisiblePages) {
    return Array.from({ length: Math.max(1, totalPages.value) }, (_, i) => i + 1)
  }

  let start = Math.max(1, props.currentPage - halfVisible)
  let end = Math.min(totalPages.value, start + maxVisiblePages - 1)

  if (end === totalPages.value) {
    start = Math.max(1, end - maxVisiblePages + 1)
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

const showFirstPage = computed(
  () => totalPages.value > maxVisiblePages && visiblePages.value[0] > 1,
)

const showLastPage = computed(
  () =>
    totalPages.value > maxVisiblePages &&
    visiblePages.value[visiblePages.value.length - 1] < totalPages.value,
)

const showStartEllipsis = computed(
  () => totalPages.value > maxVisiblePages && visiblePages.value[0] > 2,
)

const showEndEllipsis = computed(
  () =>
    totalPages.value > maxVisiblePages &&
    visiblePages.value[visiblePages.value.length - 1] < totalPages.value - 1,
)

const pendingPage = ref<number | null>(null)
const localPending = ref(false)
const pendingPageSize = ref<number | null>(null)
const pageSizePendingLocal = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const navDisabled = computed(
  () =>
    localPending.value ||
    pageSizePendingLocal.value ||
    (props.loading && (pendingPage.value != null || pendingPageSize.value != null)),
)

const pageButtonsDisabled = computed(
  () => pageSizePendingLocal.value || (props.loading && pendingPageSize.value != null),
)

const showItemsPerPageSpinner = computed(
  () => pendingPageSize.value != null && (props.loading || pageSizePendingLocal.value),
)

let lastGoToPageAt = 0
let clearSpinnerTimer: ReturnType<typeof setTimeout> | null = null

const MIN_SPINNER_MS = 350

function clearLocalPending() {
  localPending.value = false
  pendingPage.value = null
  if (clearSpinnerTimer) {
    clearTimeout(clearSpinnerTimer)
    clearSpinnerTimer = null
  }
}

function isSpinningFor(page: number) {
  return pendingPage.value === page && (props.loading || localPending.value)
}

function scheduleClearSpinner() {
  if (clearSpinnerTimer) {
    clearTimeout(clearSpinnerTimer)
    clearSpinnerTimer = null
  }
  if (pendingPage.value == null) return

  const targetPage = pendingPage.value
  const reachedTarget = props.currentPage === targetPage

  if (!reachedTarget) {
    if (!props.loading) {
      const elapsed = Date.now() - lastGoToPageAt
      const wait = Math.max(0, MIN_SPINNER_MS - elapsed)
      clearSpinnerTimer = setTimeout(() => {
        clearSpinnerTimer = null
        if (
          pendingPage.value === targetPage &&
          props.currentPage !== targetPage &&
          !props.loading
        ) {
          clearLocalPending()
        }
      }, wait)
    }
    return
  }

  if (props.loading) return

  const elapsed = Date.now() - lastGoToPageAt
  const wait = Math.max(0, MIN_SPINNER_MS - elapsed)
  clearSpinnerTimer = setTimeout(() => {
    clearSpinnerTimer = null
    if (pendingPage.value != null && props.currentPage === pendingPage.value && !props.loading) {
      clearLocalPending()
    }
  }, wait)
}

function goToPage(page: number) {
  if (pageButtonsDisabled.value) return
  const p = Math.max(1, Math.min(totalPages.value, page))
  if (p === props.currentPage) return
  if (p === pendingPage.value) return

  lastGoToPageAt = Date.now()
  pendingPage.value = p
  localPending.value = true

  emit('update:page', p)
  queueMicrotask(() => scheduleClearSpinner())
}

function clearPageSizePending() {
  pendingPageSize.value = null
  pageSizePendingLocal.value = false
}

function onItemsPerPageChange(value: unknown) {
  const next = Number(value)
  if (!Number.isFinite(next) || next <= 0) return
  if (next === props.itemsPerPage) return
  pendingPageSize.value = next
  pageSizePendingLocal.value = true
  emit('update:itemsPerPage', next)
}

watch(
  () => props.loading,
  (isLoading, wasLoading) => {
    if (isLoading) {
      if (pendingPage.value != null || pendingPageSize.value != null) {
        localPending.value = true
      }
      if (clearSpinnerTimer) {
        clearTimeout(clearSpinnerTimer)
        clearSpinnerTimer = null
      }
      return
    }
    if (wasLoading && !isLoading) {
      scheduleClearSpinner()
      // A size that did not load must not leave the select stuck on its spinner.
      clearPageSizePending()
      if (pendingPage.value == null) clearLocalPending()
    }
  },
)

watch(
  () => props.currentPage,
  () => {
    scheduleClearSpinner()
  },
)

watch(
  () => props.itemsPerPage,
  (size) => {
    if (pendingPageSize.value == null) return
    if (Number(size) === pendingPageSize.value && !props.loading) {
      clearPageSizePending()
    }
  },
)
</script>
