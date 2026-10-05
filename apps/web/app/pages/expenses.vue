<script setup lang="ts">
/** `/expenses` : sur desktop, la page complète ; sur mobile, la liste. */
const { isDesktop } = useBreakpoint();
</script>

<template>
  <ExpensesDesktop v-if="isDesktop" />
  <ExpensesMobile v-else />
</template>
