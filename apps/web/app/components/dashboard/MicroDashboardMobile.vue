<script setup lang="ts">
/** Emplacement du tableau de bord micro-entreprise mobile (Task 27) : en attendant, on garde le sélecteur de statut pour pouvoir revenir. */
</script>

<template>
  <div class="soon">
    <StatusSwitch />
    <p>Bientôt</p>
  </div>
</template>

<style scoped>
.soon { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
p { margin: 0; font-family: var(--font-display); font-size: 32px; font-weight: 800; }
</style>
