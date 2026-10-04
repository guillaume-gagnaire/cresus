<script setup lang="ts">
/**
 * Montant saisi en euros, exposé en centimes (`null` = champ vide).
 * `type="text" inputmode="decimal"` plutôt que `type="number"` pour accepter la virgule française.
 */
const props = withDefaults(defineProps<{ label: string; min?: number; max?: number; step?: number; hideLabel?: boolean }>(), { step: 1 });
const model = defineModel<number | null>({ required: true });

const toText = (cents: number | null): string => (cents === null ? '' : String(cents / 100).replace('.', ','));
const text = ref(toText(model.value));
watch(model, (v) => { text.value = toText(v); });

const bound = (euros: number): number => Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, euros));
const toCents = (euros: number): number => Math.round(euros * 100) || 0; // `|| 0` : jamais de −0

/** Applique la saisie et renvoie la valeur retenue. `model.value` ne se relit pas juste après une écriture : le parent n’a pas encore réagi. */
function commit(): number | null {
  // Espaces (dont U+202F et U+00A0), « € » et signe moins typographique tolérés, virgule ou point décimal.
  const normalized = text.value.replace(/[\s€]/g, '').replace(/−/g, '-').replace(',', '.');
  let next = model.value;
  if (normalized === '') next = null;
  else if (/^-?(\d+(\.\d*)?|\.\d+)$/.test(normalized) && Number.isSafeInteger(toCents(Number(normalized)))) next = toCents(bound(Number(normalized)));
  // Saisie invalide : la valeur précédente est conservée. Dans tous les cas, le texte reprend la forme canonique (valeur bornée comprise).
  if (next !== model.value) model.value = next;
  text.value = toText(next);
  return next;
}

/** Flèches haut et bas : un pas de `step` euros, comme le faisait la roulette d’un champ numérique. */
function nudge(direction: 1 | -1): void {
  const current = commit();
  const next = toCents(bound((current === null ? 0 : current / 100) + direction * props.step));
  model.value = next;
  text.value = toText(next);
}
</script>

<template>
  <label class="field">
    <span :class="{ 'visually-hidden': hideLabel }">{{ label }}</span>
    <span class="wrap">
      <input
        v-model="text"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :aria-label="label"
        @change="commit"
        @blur="commit"
        @keydown.enter="commit"
        @keydown.up.prevent="nudge(1)"
        @keydown.down.prevent="nudge(-1)"
      >
      <span class="suffix" aria-hidden="true">€</span>
    </span>
  </label>
</template>

<style scoped>
.wrap { position: relative; display: flex; }
.wrap input { flex: 1; padding-right: 36px; min-width: 0; }
.suffix { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 600; }
</style>
