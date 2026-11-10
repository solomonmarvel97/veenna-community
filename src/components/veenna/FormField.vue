<script setup lang="ts">
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    label?: string
    htmlFor?: string
    hint?: string
    size?: 'default' | 'compact'
    class?: string
  }>(),
  { size: 'compact' },
)
</script>

<template>
  <div :class="cn('space-y-1.5', $props.class)">
    <!--
      The label row only becomes a flex row when a caller passes labelSuffix
      (an action button beside the label). Without the slot the Label renders
      exactly as before, so existing forms keep their layout.
    -->
    <div v-if="$slots.labelSuffix" class="flex min-h-6 items-center justify-between gap-2">
      <Label
        v-if="label"
        :for="htmlFor"
        :class="
          size === 'compact'
            ? 'mb-0 block text-caption text-veenna-muted'
            : 'text-body font-normal text-veenna-fg'
        "
      >
        {{ label }}
      </Label>
      <slot name="labelSuffix" />
    </div>
    <Label
      v-else-if="label"
      :for="htmlFor"
      :class="
        size === 'compact'
          ? 'mb-0 block text-caption text-veenna-muted'
          : 'text-body font-normal text-veenna-fg'
      "
    >
      {{ label }}
    </Label>
    <slot />
    <p v-if="hint" class="text-caption text-veenna-muted">{{ hint }}</p>
  </div>
</template>
