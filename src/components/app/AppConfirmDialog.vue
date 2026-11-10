<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useConfirmDialogHost } from '@/composables/useConfirmDialog'

const { open, pending, confirming, settle, confirmPending } = useConfirmDialogHost()

function handleOpenChange(next: boolean) {
  if (!next && confirming.value) return
  open.value = next
  if (!next && pending.value) settle(false)
}

function onConfirmClick(event: MouseEvent) {
  event.preventDefault()
  void confirmPending()
}
</script>

<template>
  <AlertDialog :open="open" @update:open="handleOpenChange">
    <AlertDialogContent v-if="pending">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ pending.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="pending.description">
          {{ pending.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="confirming">
          {{ pending.cancelLabel }}
        </AlertDialogCancel>
        <Button
          type="button"
          :variant="pending.destructive ? 'destructive' : 'default'"
          :loading="confirming"
          @click="onConfirmClick"
        >
          {{ pending.confirmLabel }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
