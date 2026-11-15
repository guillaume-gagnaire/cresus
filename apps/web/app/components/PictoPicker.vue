<script setup lang="ts">
import { matchPicto, type PictoCategory, pictoLabel, pictoUrl, searchPictos } from '@cresus/shared';

const props = defineProps<{ name: string; picto: string | null }>();
const emit = defineEmits<{ choose: [picto: string | null]; close: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const query = ref('');

const GROUPS: Array<[PictoCategory, string]> = [
  ['sucre', 'Sucré'],
  ['sale', 'Salé'],
  ['boisson', 'Boissons'],
  ['fruit', 'Fruits'],
  ['kermesse', 'Kermesse et jeux'],
  ['vente', 'Ventes'],
  ['divers', 'Divers'],
];

const auto = computed(() => matchPicto(props.name));
const groups = computed(() => {
  const found = searchPictos(query.value);
  return GROUPS.map(([category, title]) => ({ title, items: found.filter((p) => p.category === category) })).filter((g) => g.items.length > 0);
});

function open(): void {
  query.value = '';
  dialog.value?.showModal();
}

function choose(picto: string | null): void {
  dialog.value?.close();
  emit('choose', picto);
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="sheet picker" :aria-label="`Picto de « ${name || 'l’article'} »`" @close="emit('close')" @click.self="dialog?.close()">
    <span class="sheet-grip" aria-hidden="true" />
    <div class="sheet-head">
      <h2>Picto de « {{ name || 'l’article' }} »</h2>
      <button type="button" class="icon-button" aria-label="Fermer" @click="dialog?.close()"><AppIcon name="close" :size="20" /></button>
    </div>
    <label class="search">
      <AppIcon name="search" :size="20" class="search-icon" />
      <input v-model="query" type="search" aria-label="Chercher un picto" placeholder="Chercher : glace, jus, ticket…" autocomplete="off">
    </label>

    <button type="button" class="auto" :class="{ selected: picto === null }" @click="choose(null)">
      <img :src="pictoUrl(auto)" alt="" width="40" height="40">
      <span class="auto-text">
        <span class="auto-title">Automatique</span>
        <span class="auto-sub">D’après le nom : {{ pictoLabel(auto) }}</span>
      </span>
      <AppIcon v-if="picto === null" name="check" class="tick" />
    </button>

    <div class="groups">
      <section v-for="group in groups" :key="group.title">
        <h3>{{ group.title }}</h3>
        <div class="grid">
          <button
            v-for="p in group.items"
            :key="p.key"
            type="button"
            class="choice"
            :class="{ selected: picto === p.key }"
            :aria-label="`Choisir ${p.label}`"
            :aria-pressed="picto === p.key"
            @click="choose(p.key)"
          >
            <img :src="pictoUrl(p.key)" alt="" width="38" height="38" loading="lazy">
            <span>{{ p.label }}</span>
          </button>
        </div>
      </section>
      <p v-if="groups.length === 0" class="none">Aucun picto pour « {{ query }} ». Essayez un autre mot, ou gardez le choix automatique.</p>
    </div>
  </dialog>
</template>

<style scoped>
.picker {
  height: 86dvh;
  display: none;
  flex-direction: column;
}
.picker[open] {
  display: flex;
}
h2 {
  font-size: 20px;
}
.search {
  position: relative;
  display: block;
}
.search-icon {
  position: absolute;
  left: 14px;
  top: 14px;
  color: var(--muted);
}
.search input {
  width: 100%;
  min-height: 48px;
  padding: 0 14px 0 44px;
  border-radius: var(--radius-field);
  border: 2px solid var(--field);
  background: var(--card);
  color: var(--ink);
  font-size: 17px;
  font-weight: 700;
}
.search input:focus {
  outline: none;
  border-color: var(--coral);
}
.auto {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 18px;
  border: 3px solid transparent;
  background: var(--ground);
  color: var(--ink);
  text-align: left;
}
.auto.selected,
.choice.selected {
  border-color: var(--coral);
  background: var(--coral-tint);
}
.auto-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.auto-title {
  font-size: 16px;
  font-weight: 900;
}
.auto-sub {
  font-size: 14px;
  font-weight: 700;
  color: var(--muted);
}
.tick {
  color: var(--coral);
}
.groups {
  flex: 1;
  overflow-y: auto;
  margin-top: 6px;
  padding-bottom: 8px;
  overscroll-behavior: contain;
}
h3 {
  margin: 14px 2px 8px;
  font-size: 15px;
  color: var(--muted);
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.choice {
  min-height: 82px;
  padding: 6px 4px;
  border-radius: 16px;
  border: 3px solid transparent;
  background: var(--ground);
  color: var(--text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.1;
  text-align: center;
}
@media (min-width: 720px) {
  .grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
.none {
  padding: 16px 4px;
  font-size: 16px;
  font-weight: 600;
}
</style>
