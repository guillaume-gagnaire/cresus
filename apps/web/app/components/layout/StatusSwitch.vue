<script setup lang="ts">
/**
 * Société / Micro-entreprise (Main.dc.html l. 64, Mobile-Accueil.dc.html l. 57). Le mode vit dans le profil :
 * le changement l’enregistre (`setCompanyMode`) et la page affiche aussitôt l’autre tableau de bord.
 * Sur mobile, le second libellé est abrégé en « Micro », comme dans la maquette.
 */
const treso = useTresoStore();
const { isDesktop } = useBreakpoint();

type Mode = 'COMPANY' | 'MICRO';
const options = computed<readonly { value: Mode; label: string }[]>(() => [
  { value: 'COMPANY', label: 'Société' },
  { value: 'MICRO', label: isDesktop.value ? 'Micro-entreprise' : 'Micro' },
]);
const mode = computed<Mode>({
  get: () => (treso.isMicro ? 'MICRO' : 'COMPANY'),
  set: (value) => { if (value !== mode.value) void treso.setCompanyMode(value); },
});
</script>

<template>
  <SegmentedControl v-model="mode" class="status" ariaLabel="Statut" :options="options" />
</template>

<style scoped>
/* Desktop : chaque bouton garde la largeur de son libellé (maquette), sans retour à la ligne. */
@media (min-width: 1024px) {
  .status :deep(button) { flex: none; white-space: nowrap; }
}
/* Maquette mobile : libellés de 14 px (15 px sur desktop). */
@media (max-width: 1023.98px) {
  .status :deep(button) { font-size: 14px; }
}
</style>
