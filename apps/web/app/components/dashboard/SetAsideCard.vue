<script setup lang="ts">
/**
 * « À mettre de côté » (Main-Micro.dc.html l. 84 à 94, Mobile-Accueil-Micro.dc.html l. 69 à 73) : ce qui, sur l’encaissement du
 * mois, n’est pas à toi (cotisations, impôt), et le réglage du versement libératoire. Sans versement libératoire, un curseur
 * règle la part à garder pour l’impôt ; il enregistre au relâchement, pas à chaque cran. `compact` : version mobile.
 */
const props = defineProps<{ setAside: MicroSetAside; compact?: boolean }>();

const treso = useTresoStore();
const sliderId = useId();

/** Valeur affichée pendant le glissement ; le profil (donc le calcul) ne change qu’au relâchement. */
const provision = ref(props.setAside.provisionPct);
watch(() => props.setAside.provisionPct, (saved) => { provision.value = saved; });

function onInput(event: Event): void {
  provision.value = Number((event.target as HTMLInputElement).value);
}
function onChange(event: Event): void {
  const pct = Number((event.target as HTMLInputElement).value);
  provision.value = pct;
  void treso.updateProfile({ microIncomeTaxProvisionPct: pct });
}
function setVersementLiberatoire(value: boolean): void {
  void treso.updateProfile({ microVersementLiberatoire: value });
}
</script>

<template>
  <section class="card aside" :class="{ 'is-compact': compact }">
    <h2>À mettre de côté</h2>
    <p v-if="!compact" class="intro">Sur ce que tu encaisses ce mois-ci, cet argent n’est pas à toi.</p>
    <div class="line contributions">
      <div class="text">
        <span class="name">{{ setAside.contributions.title }}</span>
        <span class="sub">{{ setAside.contributions.sub }}</span>
      </div>
      <span class="num amount">{{ setAside.contributions.amount }}</span>
    </div>
    <div class="line tax">
      <div class="text">
        <span class="name">{{ setAside.tax.title }}</span>
        <span class="sub">{{ setAside.tax.sub }}</span>
      </div>
      <span class="num amount">{{ setAside.tax.amount }}</span>
    </div>
    <ToggleSwitch :model-value="setAside.versementLiberatoire" :label="`Versement libératoire (${setAside.versementLiberatoireRate})`" @update:model-value="setVersementLiberatoire" />
    <div v-if="!setAside.versementLiberatoire" class="field">
      <label :for="sliderId" class="slider-label">
        <span>Part à garder pour l’impôt</span>
        <span class="num">{{ provision }}&#160;%</span>
      </label>
      <input :id="sliderId" type="range" min="0" max="30" step="1" :value="provision" @input="onInput" @change="onChange">
    </div>
  </section>
</template>

<style scoped>
.aside { min-width: 0; padding: 26px; display: flex; flex-direction: column; gap: 14px; }
h2 { margin: 0; font-size: 24px; font-weight: 800; }
.intro { margin: 0; font-size: 15px; color: var(--muted); }
.line { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 18px; }
.contributions { background: #FFEBDD; }
.tax { background: #F1EAFE; }
.text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.name { font-weight: 700; }
.sub { font-size: 14px; color: var(--ink-2); }
.amount { flex: none; font-size: 22px; }
.slider-label { display: flex; justify-content: space-between; gap: 12px; }

/* Version mobile : carte de 16 px de marge, sans phrase d’introduction, lignes de 12 × 14 px. */
.is-compact { padding: 16px; gap: 10px; }
.is-compact h2 { font-size: 18px; }
.is-compact .line { gap: 10px; padding: 12px 14px; border-radius: 16px; }
.is-compact .text { gap: 1px; }
.is-compact .name { font-size: 15px; }
.is-compact .sub { font-size: 13px; color: var(--muted); }
.is-compact .amount { font-size: 18px; }
.is-compact :deep(.switch-row) { font-size: 15px; }
</style>
