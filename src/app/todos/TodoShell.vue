<script setup lang="ts">
import { computed, watch } from 'vue'
import TodoListPane from './TodoListPane.vue'
import TodoDetailPane from './TodoDetailPane.vue'
import PaneResizeHandle from '@/components/ui/PaneResizeHandle.vue'
import { useTodosStore } from '@/stores/todos'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
import { usePersistedSidebarWidth } from '@/composables/usePersistedSidebarWidth'
import { veennaUi } from '@/lib/veennaUi'

const store = useTodosStore()
const { isMobile, navOpen, closeNav } = useResponsiveLayout()

const {
  widthStyle: detailWidthStyle,
  resizing: detailResizing,
  startResize: startDetailResize,
  resetWidth: resetDetailWidth,
} = usePersistedSidebarWidth({
  storageKey: 'veenna.todo.detailWidth',
  defaultWidth: 420,
  minWidth: 280,
  maxWidth: 720,
  maxViewportRatio: 0.55,
  side: 'right',
})

const hasDetail = computed(() => store.detailOpen && Boolean(store.selectedItemId))
const showMobileDetail = computed(() => isMobile.value && hasDetail.value)
const showDesktopDetail = computed(() => !isMobile.value && hasDetail.value)

watch(showMobileDetail, (onDetail) => {
  if (onDetail && navOpen.value) closeNav()
})
</script>

<template>
  <div class="tasks-shell relative flex h-full min-h-0 w-full flex-1 overflow-hidden">
    <div
      class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      :class="{ 'max-lg:hidden': showMobileDetail }"
    >
      <div :class="veennaUi.tasksListColumn">
        <TodoListPane class="relative flex min-h-0 min-w-0 flex-1 flex-col" />
      </div>
    </div>

    <!-- Desktop: sibling pane that shrinks the list -->
    <template v-if="showDesktopDetail">
      <PaneResizeHandle
        :active="detailResizing"
        @pointerdown="startDetailResize"
        @dblclick="resetDetailWidth"
      />
      <div
        class="veenna-detail-sidebar veenna-pane flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-veenna-divider veenna-divide"
        :style="detailWidthStyle"
      >
        <KeepAlive>
          <TodoDetailPane :key="store.selectedItemId!" />
        </KeepAlive>
      </div>
    </template>

    <!-- Mobile: full-screen detail sheet -->
    <Transition name="mobile-detail">
      <div
        v-if="showMobileDetail"
        class="veenna-detail-sidebar veenna-pane fixed inset-0 z-[var(--veenna-z-detail-sidebar)] flex h-full min-h-0 flex-col overflow-hidden"
      >
        <KeepAlive>
          <TodoDetailPane :key="store.selectedItemId!" />
        </KeepAlive>
      </div>
    </Transition>
  </div>
</template>
