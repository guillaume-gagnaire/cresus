<template>
  <div class="page">
    <slot />
  </div>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: max(14px, env(safe-area-inset-top)) 14px calc(28px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
