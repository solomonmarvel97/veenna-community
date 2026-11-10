<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { AlertDialogAction, type AlertDialogActionProps } from 'radix-vue'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = defineProps<
  AlertDialogActionProps & {
    class?: HTMLAttributes['class']
    actionVariant?: 'default' | 'destructive'
  }
>()

const delegatedProps = computed(() => {
  const { class: _, actionVariant: __, ...delegated } = props
  return delegated
})

const variantClass = computed(() =>
  buttonVariants({
    variant: props.actionVariant === 'destructive' ? 'destructive' : 'default',
  }),
)
</script>

<template>
  <AlertDialogAction v-bind="delegatedProps" :class="cn(variantClass, props.class)">
    <slot />
  </AlertDialogAction>
</template>
