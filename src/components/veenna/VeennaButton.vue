<script setup lang="ts">
import { PhSpinner } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'muted' | 'outline' | 'ghost' | 'destructive' | 'nav'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    class?: string
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
  },
)

const variantClass = {
  primary: veennaUi.btnPrimary,
  secondary: veennaUi.btnSecondary,
  muted: veennaUi.btnMuted,
  outline: veennaUi.btnOutline,
  ghost: veennaUi.btnGhost,
  destructive: veennaUi.btnDestructive,
  nav: veennaUi.btnNavAction,
} as const
</script>

<template>
  <button
    :type="type"
    :class="
      cn(
        variantClass[variant],
        // A status label (AnimatedDots) inside a button keeps the button's text size.
        '[&_[role=status]]:[font-size:inherit]',
        block && 'w-full',
        loading && '!gap-1',
        props.class,
      )
    "
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <PhSpinner
      v-if="loading"
      :class="[veennaUi.spinnerIconSm, 'relative z-[1]']"
      aria-hidden="true"
    />
    <!-- Hide leading Phosphor icons while loading so the spinner replaces them. -->
    <span :class="cn('contents', loading && '[&>svg]:hidden')">
      <slot />
    </span>
  </button>
</template>
