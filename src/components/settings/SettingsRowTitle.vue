<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'

/**
 * A settings row's title. Most titles say enough on their own, so the longer
 * explanation sits in a tooltip on hover instead of a line of text under it.
 */
defineProps<{ hint?: string | null }>()
</script>

<template>
  <TooltipProvider v-if="hint" :delay-duration="250">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <p class="w-fit cursor-default text-body font-medium text-veenna-foreground">
          <slot />
        </p>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="top"
          align="start"
          :side-offset="6"
          class="z-[400] max-w-[18rem] rounded-md border border-veenna-divider bg-veenna-surface px-2.5 py-1.5 text-caption leading-snug text-veenna-fg shadow-veenna-sm"
        >
          {{ hint }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
  <p v-else class="text-body font-medium text-veenna-foreground">
    <slot />
  </p>
</template>
