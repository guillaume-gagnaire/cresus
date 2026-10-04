<script setup lang="ts">
const { toasts } = useToast();
const { isDesktop } = useBreakpoint();
</script>

<template>
  <div class="toasts" :class="{ mobile: !isDesktop }" role="status" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.tone">{{ t.message }}</div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(20px + env(safe-area-inset-bottom));
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  pointer-events: none;
}
/* Sur mobile, au-dessus de la barre d’onglets (≈ 76 px). */
.toasts.mobile { bottom: calc(92px + env(safe-area-inset-bottom)); }
.toast {
  max-width: 480px;
  padding: 14px 20px;
  border-radius: 18px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  pointer-events: auto;
  box-shadow: 0 8px 24px rgba(31, 26, 46, .2);
}
.toast.info { background: var(--ink); color: #fff; }
.toast.error { background: var(--danger-bg); color: var(--danger-ink); }
</style>
