<script setup lang="ts">
const { toasts } = useToast();
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <p v-for="t in toasts" :key="t.id" :role="t.tone === 'error' ? 'alert' : 'status'" class="toast" :class="t.tone">{{ t.text }}</p>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, calc(100% - 28px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 60;
  pointer-events: none;
}
.toast {
  padding: 14px 18px;
  border-radius: 18px;
  background: var(--ink);
  color: #fff;
  font-weight: 800;
  box-shadow: var(--shadow-toast);
}
.toast.error {
  background: #7a1d0c;
}
.toast-enter-active {
  transition: transform 320ms var(--ease-out), opacity 320ms var(--ease-out);
}
.toast-leave-active {
  transition: opacity 200ms ease-out;
}
.toast-enter-from {
  transform: translateY(-12px);
  opacity: 0;
}
.toast-leave-to {
  opacity: 0;
}
</style>
