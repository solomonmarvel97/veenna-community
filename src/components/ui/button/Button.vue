<script setup lang="ts">
import { PhSpinner } from '@phosphor-icons/vue'
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  loading?: boolean
  disabled?: boolean
  /** Native button type; default "button" so buttons inside forms do not submit unless explicitly type="submit". */
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  asChild: false,
  loading: false,
  disabled: false,
  type: 'button',
})
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="type"
    :disabled="disabled || loading"
    :class="
      cn(
        buttonVariants({ variant, size }),
        loading && '!gap-1',
        loading && '[&_svg:not(.animate-spin)]:hidden',
        props.class,
      )
    "
  >
    <PhSpinner
      v-if="loading"
      class="size-3.5 shrink-0 animate-spin text-foreground"
      weight="bold"
    />
    <slot />
  </Primitive>
</template>
