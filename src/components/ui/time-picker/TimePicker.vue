<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { PhClock } from '@phosphor-icons/vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, getCurrentTimeRoundedUp } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const inputLikeClasses = cn(veennaUi.controlTrigger, 'h-8 py-1.5 min-w-0 overflow-hidden veenna-field')

type Period = 'AM' | 'PM'

interface Props {
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  class?: string
  /** Minute step (default 15 → 00, 15, 30, 45) */
  minuteStep?: number
  /** When true, automatically rounds time up to next 15-min interval when picker opens (only if no value set) */
  autoRound?: boolean
  /** Earliest selectable time (24h `HH:mm`). Hours/minutes before this are hidden. */
  minTime?: string | null
  /** When true, an empty value stays empty (shows the placeholder) and the popover offers Clear. */
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Pick time',
  disabled: false,
  minuteStep: 15,
  autoRound: false,
  clearable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
const PERIODS: Period[] = ['AM', 'PM']

const minutes = computed(() =>
  Array.from({ length: 60 / props.minuteStep }, (_, i) =>
    String(i * props.minuteStep).padStart(2, '0'),
  ),
)

const hour = ref<string>('09')
const minute = ref<string>('00')
const popoverOpen = ref(false)
const empty = ref(false)
const hourCol = ref<HTMLElement | null>(null)
const minuteCol = ref<HTMLElement | null>(null)

function parseValue(v: string | null | undefined): { hour: string; minute: string } {
  if (!v || typeof v !== 'string' || !v.includes(':')) return { hour: '09', minute: '00' }
  const [h, m] = v.split(':')
  const hNum = parseInt(h ?? '9', 10)
  const mNum = parseInt(m ?? '0', 10)
  const minuteVal = Math.floor(mNum / props.minuteStep) * props.minuteStep
  if (Number.isNaN(hNum) || hNum < 0 || hNum > 23) return { hour: '09', minute: '00' }
  return {
    hour: String(hNum).padStart(2, '0'),
    minute: String(minuteVal >= 0 && minuteVal <= 59 ? minuteVal : 0).padStart(2, '0'),
  }
}

function timeToMinutes(h: string, m: string): number {
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

function toHour24(hour12: number, period: Period): number {
  const base = hour12 % 12
  return period === 'PM' ? base + 12 : base
}

function padHour12(hour12: number): string {
  return String(hour12).padStart(2, '0')
}

const minTimeBound = computed(() => (props.minTime ? parseValue(props.minTime) : null))

const period = computed<Period>(() => (parseInt(hour.value, 10) < 12 ? 'AM' : 'PM'))
const hour12 = computed(() => {
  const h = parseInt(hour.value, 10)
  return Number.isNaN(h) ? 9 : h % 12 || 12
})

const allowedHours = computed(() => {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  if (!minTimeBound.value) return hours
  const minHour = parseInt(minTimeBound.value.hour, 10)
  return hours.filter((h) => parseInt(h, 10) >= minHour)
})

const allowedMinutes = computed(() => {
  if (!minTimeBound.value) return minutes.value
  const minHour = parseInt(minTimeBound.value.hour, 10)
  const minMinute = parseInt(minTimeBound.value.minute, 10)
  const selectedHour = parseInt(hour.value, 10)
  if (selectedHour !== minHour) return minutes.value
  return minutes.value.filter((m) => parseInt(m, 10) >= minMinute)
})

function isHour12Allowed(value: number): boolean {
  const h24 = String(toHour24(value, period.value)).padStart(2, '0')
  return allowedHours.value.includes(h24)
}

function isPeriodAllowed(next: Period): boolean {
  if (!minTimeBound.value) return true
  const minHour = parseInt(minTimeBound.value.hour, 10)
  if (next === 'AM') return minHour < 12
  return true
}

function clampToMinTime() {
  if (!minTimeBound.value) return
  const selectedHour = parseInt(hour.value, 10)
  const minHour = parseInt(minTimeBound.value.hour, 10)
  if (selectedHour < minHour) {
    hour.value = minTimeBound.value.hour
    minute.value = minTimeBound.value.minute
    return
  }
  if (
    selectedHour === minHour &&
    timeToMinutes(hour.value, minute.value) <
      timeToMinutes(minTimeBound.value.hour, minTimeBound.value.minute)
  ) {
    minute.value = minTimeBound.value.minute
  }
}

function syncFromModel() {
  empty.value = props.clearable && !props.modelValue
  const parsed = parseValue(props.modelValue)
  hour.value = parsed.hour
  minute.value = parsed.minute
  clampToMinTime()
}

syncFromModel()
watch(
  () => props.modelValue,
  () => syncFromModel(),
  { immediate: false },
)

watch(
  () => props.minTime,
  () => {
    clampToMinTime()
  },
)

watch(hour, () => {
  clampToMinTime()
})

watch(
  [hour, minute],
  () => {
    if (empty.value) return
    const next = `${hour.value}:${minute.value}`
    if (next !== props.modelValue) emit('update:modelValue', next)
  },
  { immediate: true },
)

const displayText = computed(() => {
  if (empty.value) return ''
  const h = parseInt(hour.value, 10)
  const m = minute.value || '00'
  if (Number.isNaN(h)) return ''
  const h12 = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${padHour12(h12)}:${m} ${ampm}`
})

function setHour12(value: number) {
  if (!isHour12Allowed(value)) return
  hour.value = String(toHour24(value, period.value)).padStart(2, '0')
  markPicked()
}

function setMinute(value: string) {
  if (!allowedMinutes.value.includes(value)) return
  minute.value = value
  markPicked()
}

function setPeriod(next: Period) {
  if (!isPeriodAllowed(next) || (next === period.value && !empty.value)) return
  hour.value = String(toHour24(hour12.value, next)).padStart(2, '0')
  markPicked()
}

/** First pick on an empty clearable picker: the shown default becomes the value. */
function markPicked() {
  if (!empty.value) return
  empty.value = false
  emit('update:modelValue', `${hour.value}:${minute.value}`)
}

function clear() {
  empty.value = true
  popoverOpen.value = false
  emit('update:modelValue', null)
}

function cellClass(selected: boolean) {
  selected = selected && !empty.value
  return cn(
    'flex h-6 w-full shrink-0 items-center justify-center text-label font-medium tabular-nums disabled:pointer-events-none disabled:opacity-50',
    veennaUi.menuRowTone,
    selected && cn(veennaUi.menuRowActive, 'font-semibold'),
  )
}

function scrollSelectedIntoView() {
  for (const col of [hourCol.value, minuteCol.value]) {
    col?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'start' })
  }
}

watch(popoverOpen, async (isOpen) => {
  if (!isOpen) return
  if (props.autoRound && !props.modelValue) {
    const roundedTime = getCurrentTimeRoundedUp()
    const parsed = parseValue(roundedTime)
    hour.value = parsed.hour
    minute.value = parsed.minute
  }
  clampToMinTime()
  await nextTick()
  scrollSelectedIntoView()
})
</script>

<template>
  <div :class="cn('min-w-0 overflow-hidden', props.class)">
    <Popover v-if="!disabled" v-model:open="popoverOpen">
      <PopoverTrigger as-child>
        <button
          type="button"
          :class="
            cn(
              inputLikeClasses,
              'cursor-pointer justify-between gap-2 text-left font-normal',
              !displayText && 'text-veenna-muted',
            )
          "
        >
          <span class="min-w-0 truncate">{{ displayText || placeholder }}</span>
          <PhClock class="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0.5 veenna-popover-surface" align="start">
        <div class="flex h-32">
          <div
            ref="hourCol"
            class="veenna-scroll-hidden flex w-9 flex-col overflow-y-auto py-0.5"
            role="listbox"
            aria-label="Hours"
          >
            <button
              v-for="value in HOURS_12"
              :key="`h-${value}`"
              type="button"
              role="option"
              :aria-selected="hour12 === value"
              :data-selected="hour12 === value ? 'true' : undefined"
              :disabled="!isHour12Allowed(value)"
              :class="cellClass(hour12 === value)"
              @click="setHour12(value)"
            >
              {{ padHour12(value) }}
            </button>
          </div>
          <div
            ref="minuteCol"
            class="veenna-scroll-hidden flex w-9 flex-col overflow-y-auto border-l border-veenna-divider py-0.5"
            role="listbox"
            aria-label="Minutes"
          >
            <button
              v-for="value in allowedMinutes"
              :key="`m-${value}`"
              type="button"
              role="option"
              :aria-selected="minute === value"
              :data-selected="minute === value ? 'true' : undefined"
              :class="cellClass(minute === value)"
              @click="setMinute(value)"
            >
              {{ value }}
            </button>
          </div>
          <div
            class="flex w-9 flex-col border-l border-veenna-divider py-0.5"
            role="listbox"
            aria-label="AM or PM"
          >
            <button
              v-for="value in PERIODS"
              :key="value"
              type="button"
              role="option"
              :aria-selected="period === value"
              :disabled="!isPeriodAllowed(value)"
              :class="cellClass(period === value)"
              @click="setPeriod(value)"
            >
              {{ value }}
            </button>
          </div>
        </div>
        <button
          v-if="clearable && !empty"
          type="button"
          class="mt-0.5 flex h-6 w-full items-center justify-center border-t border-veenna-divider text-label font-medium"
          :class="veennaUi.menuRowTone"
          @click="clear"
        >
          Clear
        </button>
      </PopoverContent>
    </Popover>
    <button
      v-else
      type="button"
      disabled
      :class="
        cn(
          inputLikeClasses,
          'cursor-not-allowed justify-between gap-2 text-left font-normal',
          !displayText && 'text-veenna-muted',
        )
      "
    >
      <span class="min-w-0 truncate">{{ displayText || placeholder }}</span>
      <PhClock class="h-4 w-4 shrink-0 opacity-50" />
    </button>
  </div>
</template>
