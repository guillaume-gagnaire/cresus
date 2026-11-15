<script setup lang="ts">
import { pictoUrl, resolvePicto } from '@cresus/shared';

const props = withDefaults(defineProps<{ name: string; picto?: string | null; size?: number }>(), { picto: null, size: 56 });
const src = computed(() => pictoUrl(resolvePicto({ name: props.name, picto: props.picto })));
</script>

<template>
  <img :src="src" alt="" :width="size" :height="size" class="picto" :style="{ width: `${size}px`, height: `${size}px` }" draggable="false">
</template>

<style scoped>
.picto {
  flex: none;
  user-select: none;
  -webkit-user-drag: none;
}
</style>
