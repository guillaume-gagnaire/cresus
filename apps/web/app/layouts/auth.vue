<template>
  <div class="auth-shell">
    <main class="auth-card"><slot /></main>
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: calc(24px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left));
}
.auth-card { width: 100%; max-width: 440px; min-width: 0; display: flex; flex-direction: column; gap: 22px; }
</style>
