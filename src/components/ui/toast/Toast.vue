<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import type { ToastVariant } from './use-toast'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    variant?: ToastVariant
    onClick?: () => void
    onClickHint?: string
    actionLabel?: string
    onAction?: () => void
    actionHint?: string
    icon?: unknown
  }>(),
  { variant: 'default' },
)

defineEmits<{ dismiss: [] }>()

const theme = useThemeStore()

/**
 * Default is the inverted surface (black on light, white on dark). Every other kind
 * is a solid fill in both themes: red = failure, blue = credits, orange = upgrade
 * (all white text), amber = recoverable warning (dark text so it stays apart from orange).
 */
const FILLED: Partial<Record<ToastVariant, string>> = {
  destructive: 'bg-red-600 text-white',
  credits: 'bg-blue-600 text-white',
  upgrade: 'bg-orange-700 text-white',
  warning: 'bg-amber-400 text-neutral-950',
}

const variantClasses = computed(
  () => FILLED[props.variant] ?? (theme.isDark ? 'bg-white text-black' : 'bg-black text-white'),
)

const actionClasses = computed(() => {
  if (props.variant === 'warning') return 'font-semibold text-neutral-950 hover:underline'
  if (FILLED[props.variant]) return 'font-semibold text-white hover:underline'
  // Toast surfaces invert vs the app chrome (white bar in dark mode). Never use
  // --veenna-accent here - in dark mode that token is white and the Undo link vanishes.
  return theme.isDark
    ? 'font-semibold text-black hover:underline'
    : 'font-semibold text-white hover:underline'
})

const dismissClasses = computed(() => {
  if (props.variant === 'warning') return 'text-neutral-950/60 hover:text-neutral-950'
  if (FILLED[props.variant]) return 'text-white/75 hover:text-white'
  return theme.isDark ? 'text-black/45 hover:text-black' : 'text-white/55 hover:text-white'
})
</script>

<template>
  <div
    :class="[
      'no-drag pointer-events-auto flex min-h-8 max-w-[min(28rem,calc(100vw-2rem))] items-center gap-1.5 rounded-md py-1.5 pl-3.5 pr-1 shadow-lg',
      variantClasses,
      onClick ? 'cursor-pointer select-none' : '',
    ]"
    :role="onClick ? 'button' : 'status'"
    aria-live="polite"
    @click="onClick?.()"
  >
    <div class="min-w-0 flex-1 text-left">
      <div
        v-if="title || description"
        class="line-clamp-2 break-words text-caption tabular-nums font-medium leading-snug"
        :title="[title, description].filter(Boolean).join(' · ')"
      >
        <template v-if="title">{{ title }}</template>
        <span v-if="description" :class="title ? 'font-normal opacity-90' : ''">
          <template v-if="title"> · </template>{{ description }}
        </span>
      </div>
      <button
        v-if="actionLabel && onAction"
        type="button"
        :class="['mt-0.5 block text-left text-caption font-medium', actionClasses]"
        @click.stop="onAction"
      >
        {{ actionLabel }}
      </button>
    </div>
    <button
      type="button"
      :class="[
        'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
        dismissClasses,
      ]"
      aria-label="Dismiss"
      @click.stop="$emit('dismiss')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</template>
