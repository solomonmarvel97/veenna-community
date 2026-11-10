<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { format } from 'date-fns'
import { PhCalendarBlank } from '@phosphor-icons/vue'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const inputLikeClasses = cn(veennaUi.controlTrigger, 'h-8 py-1.5 min-w-0 overflow-hidden veenna-field')

interface Props {
  modelValue?: string | Date | null
  placeholder?: string
  disabled?: boolean
  class?: string
  max?: Date | string
  min?: Date | string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Pick a date',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

/** `YYYY-MM-DD` and nothing else, checked without a pattern. */
function isPlainDay(value: string): boolean {
  if (value.length !== 10 || value[4] !== '-' || value[7] !== '-') return false
  return value.split('-').join('').split('').every((ch) => ch >= '0' && ch <= '9')
}

const parseInitialDate = (): Date | undefined => {
  if (!props.modelValue) return undefined
  if (props.modelValue instanceof Date) return props.modelValue
  if (typeof props.modelValue === 'string') {
    const str = props.modelValue.trim()
    if (isPlainDay(str)) {
      const parsed = new Date(str + 'T12:00:00')
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    const parsed = new Date(str)
    return isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}

const date = ref<Date | undefined>(parseInitialDate())

const formattedDate = computed(() => {
  if (!date.value) return ''
  return format(date.value, 'd MMM yyyy')
})

const dateString = computed(() => {
  if (!date.value) return null
  // Format as YYYY-MM-DD for backend
  const year = date.value.getFullYear()
  const month = String(date.value.getMonth() + 1).padStart(2, '0')
  const day = String(date.value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

watch(date, () => {
  emit('update:modelValue', dateString.value)
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (!newValue) {
      date.value = undefined
      return
    }
    if (newValue instanceof Date) {
      date.value = newValue
      return
    }
    if (typeof newValue === 'string') {
      // Handle YYYY-MM-DD format or full ISO timestamp
      const str = newValue.trim()
      // If it's just YYYY-MM-DD, append time to avoid UTC parsing issues
      if (isPlainDay(str)) {
        const parsed = new Date(str + 'T12:00:00')
        date.value = isNaN(parsed.getTime()) ? undefined : parsed
        return
      }
      // Otherwise, parse as-is (handles full ISO timestamps)
      const parsed = new Date(str)
      date.value = isNaN(parsed.getTime()) ? undefined : parsed
      return
    }
    date.value = undefined
  },
  { immediate: true },
)
</script>

<template>
  <div :class="cn('min-w-0 overflow-hidden', props.class)">
    <Popover v-if="!disabled">
      <PopoverTrigger as-child>
        <button
          type="button"
          :class="
            cn(
              inputLikeClasses,
              'text-left font-normal justify-start gap-2 cursor-pointer',
              !date && 'text-veenna-muted',
            )
          "
        >
          <PhCalendarBlank class="h-4 w-4 shrink-0 flex-shrink-0" />
          <span class="min-w-0 truncate block overflow-hidden">{{
            date ? formattedDate : placeholder
          }}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0 veenna-popover-surface" align="start">
        <Calendar
          :key="`calendar-${date?.getTime() || 'empty'}`"
          v-model="date"
          :max="props.max"
          :min="props.min"
        />
      </PopoverContent>
    </Popover>
    <button
      v-else
      type="button"
      disabled
      :class="
        cn(
          inputLikeClasses,
          'text-left font-normal justify-start gap-2 cursor-not-allowed',
          !date && 'text-veenna-muted',
        )
      "
    >
      <PhCalendarBlank class="h-4 w-4 shrink-0 flex-shrink-0" />
      <span class="min-w-0 truncate block overflow-hidden">{{
        date ? formattedDate : placeholder
      }}</span>
    </button>
  </div>
</template>
