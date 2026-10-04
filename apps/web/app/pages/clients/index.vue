<script setup lang="ts">
/** `/clients` : sur desktop, la page complète avec la première mission choisie. Le mobile (Task 29) n’a ici qu’une liste simple. */
const treso = useTresoStore();
const { isDesktop } = useBreakpoint();
</script>

<template>
  <ClientsDesktop v-if="isDesktop" />
  <div v-else class="list">
    <h1>Tes clients</h1>
    <ul>
      <li v-for="client in treso.clients" :key="client.id"><NuxtLink :to="`/clients/${client.id}`">{{ client.name }}</NuxtLink></li>
    </ul>
    <NuxtLink to="/clients/new">Ajouter un client</NuxtLink>
  </div>
</template>

<style scoped>
h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; }
.list { display: flex; flex-direction: column; gap: 16px; }
ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
a { display: inline-flex; align-items: center; min-height: 44px; }
</style>
