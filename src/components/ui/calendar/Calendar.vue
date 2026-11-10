<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'

interface Props {
  modelValue?: Date
  class?: HTMLAttributes['class']
  max?: Date | string
  min?: Date | string
  /** When provided, dates for which this returns true are disabled and not selectable. */
  disabledDates?: (date: Date) => boolean
  /** When provided, dates for which this returns true get a primary highlight (e.g. day already has slots). Still selectable. */
  highlightedDates?: (date: Date) => boolean
  /**
   * When false, the day matching modelValue has no distinct “selected” styling; only highlightedDates are styled.
   * Selection still updates v-model for picking a date.
   */
  showSelectedDayStyle?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Date | undefined]
}>()

const getInitialDate = (): Date => {
  if (props.modelValue) {
    const date = new Date(props.modelValue)
    if (!isNaN(date.getTime())) {
      return date
    }
  }
  return new Date()
}

const currentDate = ref<Date>(getInitialDate())
const selectedDate = ref<Date | undefined>(props.modelValue)
const viewMode = ref<'calendar' | 'month' | 'year'>('calendar')

const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const currentMonthYear = computed(() => {
  if (!currentDate.value || !(currentDate.value instanceof Date)) {
    return new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})

// Generate years for year picker (100 years range, centered around current year)
const yearRange = computed(() => {
  const currentYear = new Date().getFullYear()
  const startYear = currentYear - 50
  const endYear = currentYear + 50
  const years = []
  for (let year = startYear; year <= endYear; year++) {
    years.push(year)
  }
  return years
})

// Generate months for month picker
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // First day of the month
  const firstDay = new Date(year, month, 1)
  const firstDayOfWeek = firstDay.getDay()

  // Last day of the month
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Previous month's days to fill the grid
  const prevMonth = new Date(year, month, 0)
  const daysInPrevMonth = prevMonth.getDate()

  const days: Array<{
    day: number
    date: Date
    isCurrentMonth: boolean
    isToday: boolean
    isSelected: boolean
  }> = []

  // Previous month's trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i)
    date.setHours(0, 0, 0, 0)
    days.push({
      day: daysInPrevMonth - i,
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: selectedDate.value ? isSameDay(date, selectedDate.value) : false,
    })
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    days.push({
      day,
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      isSelected: selectedDate.value ? isSameDay(date, selectedDate.value) : false,
    })
  }

  // Next month's leading days to finish the last week only
  const remainingCells = (7 - (days.length % 7)) % 7
  for (let day = 1; day <= remainingCells; day++) {
    const date = new Date(year, month + 1, day)
    date.setHours(0, 0, 0, 0)
    days.push({
      day,
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: selectedDate.value ? isSameDay(date, selectedDate.value) : false,
    })
  }

  return days
})

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

const isDateHighlighted = (date: Date): boolean => !!props.highlightedDates?.(date)

const isDateDisabled = (date: Date): boolean => {
  if (props.disabledDates?.(date)) return true
  if (props.max) {
    const maxDate = props.max instanceof Date ? props.max : new Date(props.max)
    maxDate.setHours(23, 59, 59, 999)
    if (date > maxDate) return true
  }
  if (props.min) {
    const minDate = props.min instanceof Date ? props.min : new Date(props.min)
    minDate.setHours(0, 0, 0, 0)
    if (date < minDate) return true
  }
  return false
}

/** Day cell styles: slot-highlight uses soft fill; optional selected-day styling when showSelectedDayStyle is true. */
function calendarDayButtonClass(calendarDay: (typeof calendarDays.value)[number]): string {
  const { date, isCurrentMonth, isSelected } = calendarDay
  const selectedStyled = props.showSelectedDayStyle !== false && isSelected
  if (!isCurrentMonth) {
    return 'text-veenna-muted opacity-50 hover:bg-veenna-row'
  }
  if (isDateDisabled(date)) {
    return 'text-veenna-muted opacity-30 cursor-not-allowed hover:bg-transparent'
  }
  const highlighted = isDateHighlighted(date)
  if (highlighted && selectedStyled) {
    return 'bg-veenna-accent text-veenna-accent-fg font-normal hover:opacity-90 shadow-none ring-0 outline-none'
  }
  if (highlighted) {
    return 'bg-veenna-accent-soft text-veenna-accent font-normal hover:bg-veenna-row-hover shadow-none ring-0 outline-none border-0'
  }
  if (selectedStyled) {
    return 'bg-veenna-row text-veenna-accent font-medium hover:bg-veenna-row-hover shadow-none ring-0 outline-none'
  }
  return ''
}

const previousMonth = () => {
  if (!currentDate.value || !(currentDate.value instanceof Date)) {
    currentDate.value = new Date()
    return
  }
  if (viewMode.value === 'year') {
    currentDate.value = new Date(
      currentDate.value.getFullYear() - 12,
      currentDate.value.getMonth(),
      1,
    )
  } else {
    currentDate.value = new Date(
      currentDate.value.getFullYear(),
      currentDate.value.getMonth() - 1,
      1,
    )
  }
}

const nextMonth = () => {
  if (!currentDate.value || !(currentDate.value instanceof Date)) {
    currentDate.value = new Date()
    return
  }
  if (viewMode.value === 'year') {
    currentDate.value = new Date(
      currentDate.value.getFullYear() + 12,
      currentDate.value.getMonth(),
      1,
    )
  } else {
    currentDate.value = new Date(
      currentDate.value.getFullYear(),
      currentDate.value.getMonth() + 1,
      1,
    )
  }
}

const selectYear = (year: number) => {
  const month = currentDate.value instanceof Date ? currentDate.value.getMonth() : 0
  currentDate.value = new Date(year, month, 1)
  viewMode.value = 'month'
}

const selectMonth = (month: number) => {
  const year =
    currentDate.value instanceof Date ? currentDate.value.getFullYear() : new Date().getFullYear()
  currentDate.value = new Date(year, month, 1)
  viewMode.value = 'calendar'
}

const goToYearView = () => {
  viewMode.value = 'year'
}

const goToMonthView = () => {
  viewMode.value = 'month'
}

const selectDate = (date: Date) => {
  if (isDateDisabled(date)) return
  // Check max date constraint
  if (props.max) {
    const maxDate = props.max instanceof Date ? props.max : new Date(props.max)
    maxDate.setHours(23, 59, 59, 999) // End of day
    if (date > maxDate) return
  }
  // Check min date constraint
  if (props.min) {
    const minDate = props.min instanceof Date ? props.min : new Date(props.min)
    minDate.setHours(0, 0, 0, 0) // Start of day
    if (date < minDate) return
  }
  selectedDate.value = date
  currentDate.value = new Date(date)
  viewMode.value = 'calendar' // Reset to calendar view after selection
  emit('update:modelValue', date)
}

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      selectedDate.value = newValue
      currentDate.value = new Date(newValue)
    } else {
      selectedDate.value = undefined
    }
  },
  { immediate: true },
)
</script>

<template>
  <div :class="cn('p-2', props.class)">
    <!-- Year View -->
    <div v-if="viewMode === 'year'" :key="'year-view'" class="space-y-2">
      <div class="flex items-center justify-between">
        <button
          @click="previousMonth"
          aria-label="Previous"
          class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon focus-visible:outline-none"
        >
          <PhCaretLeft class="h-3.5 w-3.5" />
        </button>
        <div class="text-caption font-medium">
          {{ yearRange[0] }} - {{ yearRange[yearRange.length - 1] }}
        </div>
        <button
          @click="nextMonth"
          aria-label="Next"
          class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon focus-visible:outline-none"
        >
          <PhCaretRight class="h-3.5 w-3.5" />
        </button>
      </div>
      <div class="grid max-h-[220px] grid-cols-4 gap-1 overflow-y-auto">
        <button
          v-for="year in yearRange"
          :key="year"
          @click="selectYear(year)"
          :class="[
            'h-8 rounded-md text-caption font-normal transition-colors',
            year === currentDate?.getFullYear()
              ? 'bg-veenna-accent font-normal text-veenna-accent-fg'
              : 'hover:bg-veenna-row-hover hover:text-veenna-fg',
          ]"
        >
          {{ year }}
        </button>
      </div>
    </div>

    <!-- Month View -->
    <div v-else-if="viewMode === 'month'" :key="'month-view'" class="space-y-2">
      <div class="flex items-center justify-between">
        <button
          @click="previousMonth"
          aria-label="Previous"
          class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon focus-visible:outline-none"
        >
          <PhCaretLeft class="h-3.5 w-3.5" />
        </button>
        <button
          @click="goToYearView"
          class="rounded-md px-1.5 py-0.5 text-caption font-medium text-veenna-fg transition-colors hover:bg-veenna-row-hover hover:text-veenna-fg"
        >
          {{ currentDate?.getFullYear() || new Date().getFullYear() }}
        </button>
        <button
          @click="nextMonth"
          aria-label="Next"
          class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon focus-visible:outline-none"
        >
          <PhCaretRight class="h-3.5 w-3.5" />
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="(month, index) in months"
          :key="index"
          @click="selectMonth(index)"
          :class="[
            'h-8 rounded-md text-caption font-normal transition-colors',
            index === currentDate?.getMonth()
              ? 'bg-veenna-accent font-normal text-veenna-accent-fg'
              : 'hover:bg-veenna-row-hover hover:text-veenna-fg',
          ]"
        >
          {{ month }}
        </button>
      </div>
    </div>

    <!-- Calendar View -->
    <div v-else :key="'calendar-view'" class="space-y-1.5">
      <div class="flex items-center justify-between">
        <button
          @click="previousMonth"
          aria-label="Previous"
          class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon focus-visible:outline-none"
        >
          <PhCaretLeft class="h-3.5 w-3.5" />
        </button>
        <button
          @click="goToMonthView"
          class="rounded-md px-1.5 py-0.5 text-caption font-medium text-veenna-fg transition-colors hover:bg-veenna-row-hover hover:text-veenna-fg"
        >
          {{ currentMonthYear }}
        </button>
        <button
          @click="nextMonth"
          aria-label="Next"
          class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon focus-visible:outline-none"
        >
          <PhCaretRight class="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <div class="mb-1 grid grid-cols-7 gap-0.5">
          <div
            v-for="day in dayNames"
            :key="day"
            class="w-7 text-center text-micro font-medium text-veenna-muted"
          >
            {{ day }}
          </div>
        </div>
        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="(calendarDay, index) in calendarDays"
            :key="index"
            @click="selectDate(calendarDay.date)"
            :disabled="isDateDisabled(calendarDay.date)"
            :class="
              cn(
                'h-7 w-7 rounded-md p-0 text-caption font-normal text-veenna-fg transition-colors hover:bg-veenna-row-hover',
                calendarDayButtonClass(calendarDay),
              )
            "
          >
            {{ calendarDay.day }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
