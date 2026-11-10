<template>
  <footer :class="['veenna-pane pane-footer flex w-full items-center gap-2 border-t border-veenna-divider veenna-divide', $attrs.class]">
    <slot />
  </footer>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
