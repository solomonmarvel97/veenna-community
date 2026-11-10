<script setup lang="ts">
import { veennaUi } from '@/lib/veennaUi'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    narrow?: boolean
    wide?: boolean
    /** Home hero tabs: medium column between chat landing and Insights. */
    home?: boolean
    /** Full width/height workspace (e.g. Notes editor). */
    fill?: boolean
    /** Extra-wide column for content-heavy pages (e.g. Files grid) */
    full?: boolean
    class?: string
  }>(),
  { narrow: false, wide: false, home: false, fill: false, full: false },
)
</script>

<template>
  <div
    :class="
      cn(
        fill
          ? 'mx-auto flex h-full w-full max-w-none min-h-0 flex-1 flex-col px-0'
          : home
            ? veennaUi.pageColumnHome
            : narrow
              ? veennaUi.pageColumnNarrow
              : wide
                ? veennaUi.pageColumnWide
                : full
                  ? veennaUi.pageColumnFull
                  : veennaUi.pageColumn,
        $props.class,
      )
    "
  >
    <slot />
  </div>
</template>
