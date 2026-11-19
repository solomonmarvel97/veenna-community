<script setup lang="ts">
import { PhCheck } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'

/**
 * The check every copy shows once it has worked: a soft green disc with a thin check, the same
 * mark a finished step wears in the chat activity. Give it the slot of the icon it replaces; the disc is a little larger than that slot (it grows past it without moving anything),
 * (`size-3.5`, `h-4 w-4`); the check sits in the disc with a small padding all round and scales with it. Never a filled circle or a bare check.
 */
defineProps<{ class?: string }>()
</script>

<template>
  <span
    :class="cn('inline-flex size-4 shrink-0 items-center justify-center', $props.class)"
    aria-hidden="true"
  >
    <span
      class="flex shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
      style="box-sizing: border-box; width: 120%; height: 120%; padding: 2.5px"
    >
      <PhCheck weight="regular" style="width: 100%; height: 100%; flex-shrink: 0" />
    </span>
  </span>
</template>
