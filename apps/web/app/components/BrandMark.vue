<template>
  <span class="brand">
    <span class="mark" aria-hidden="true">+1</span>
    <span class="name">Cresus</span>
  </span>
</template>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mark {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--coral);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.02em;
}
.name {
  font-size: 38px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: -0.02em;
}
</style>
