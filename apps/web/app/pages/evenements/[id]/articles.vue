<script setup lang="ts">
import { type ArticleDto, type EventDto, LIMITS, matchPicto, parseEuros, pictoLabel } from '@cresus/shared';
import { useCaisseStore } from '~/stores/caisse';
import { api, errorMessage } from '~/utils/api';
import { formatEuros } from '~/utils/format';

definePageMeta({ layout: false });

const route = useRoute();
const caisse = useCaisseStore();
const toast = useToast();
const online = useOnline();
const eventId = computed(() => String(route.params.id));

useHead(() => ({ title: `Articles — ${caisse.detail?.event.name ?? 'Cresus'}` }));

onMounted(() => void caisse.open(eventId.value));
onBeforeUnmount(() => caisse.close());

// Ajout
const newName = ref('');
const newPrice = ref('');
const newPicto = ref<string | null>(null);
const addError = ref('');
const busy = ref(false);
const autoLabel = computed(() => pictoLabel(matchPicto(newName.value)));

async function add(): Promise<void> {
  addError.value = '';
  const priceCents = parseEuros(newPrice.value);
  if (!newName.value.trim()) return void (addError.value = 'Indiquez le nom de l’article.');
  if (priceCents === null) return void (addError.value = 'Prix invalide : par exemple 2,50.');
  busy.value = true;
  try {
    await api.post(`/events/${eventId.value}/articles`, { name: newName.value, priceCents, picto: newPicto.value });
    newName.value = '';
    newPrice.value = '';
    newPicto.value = null;
    await caisse.refresh();
  } catch (e) {
    addError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function patch(article: ArticleDto, values: Partial<Pick<ArticleDto, 'name' | 'priceCents' | 'picto' | 'onSale'>>): Promise<boolean> {
  try {
    await api.patch(`/events/${eventId.value}/articles/${article.id}`, values);
    await caisse.refresh();
    return true;
  } catch (e) {
    toast.error(errorMessage(e));
    await caisse.refresh();
    return false;
  }
}

// Picto (ajout ou article existant)
const picker = ref<{ open(): void } | null>(null);
const pickerFor = ref<ArticleDto | 'new'>('new');
const pickerName = computed(() => (pickerFor.value === 'new' ? newName.value : pickerFor.value.name));
const pickerPicto = computed(() => (pickerFor.value === 'new' ? newPicto.value : pickerFor.value.picto));
function openPicker(target: ArticleDto | 'new'): void {
  pickerFor.value = target;
  picker.value?.open();
}
async function onPicked(picto: string | null): Promise<void> {
  if (pickerFor.value === 'new') newPicto.value = picto;
  else await patch(pickerFor.value, { picto });
}

// Ordre
const reordering = ref(false);
async function move(article: ArticleDto, delta: -1 | 1): Promise<void> {
  const ids = caisse.articles.map((a) => a.id);
  const from = ids.indexOf(article.id);
  const to = from + delta;
  if (to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  try {
    await api.put(`/events/${eventId.value}/articles/order`, { ids });
  } catch (e) {
    toast.error(errorMessage(e));
  }
  await caisse.refresh();
}

// Modifier / supprimer un article
const editDialog = ref<HTMLDialogElement | null>(null);
const editing = ref<ArticleDto | null>(null);
const editName = ref('');
const editPrice = ref('');
const editError = ref('');
function edit(article: ArticleDto): void {
  editing.value = article;
  editName.value = article.name;
  editPrice.value = formatEuros(article.priceCents);
  editError.value = '';
  editDialog.value?.showModal();
}
async function saveEdit(): Promise<void> {
  if (!editing.value) return;
  const priceCents = parseEuros(editPrice.value);
  if (priceCents === null) return void (editError.value = 'Prix invalide : par exemple 2,50.');
  if (await patch(editing.value, { name: editName.value, priceCents })) editDialog.value?.close();
}
async function removeArticle(): Promise<void> {
  if (!editing.value) return;
  try {
    await api.del(`/events/${eventId.value}/articles/${editing.value.id}`);
    editDialog.value?.close();
    await caisse.refresh();
  } catch (e) {
    editError.value = errorMessage(e);
  }
}

// L'évènement
const eventName = ref('');
const eventDate = ref('');
watch(
  () => caisse.detail?.event,
  (event) => {
    if (!event) return;
    eventName.value = event.name;
    eventDate.value = event.date;
  },
  { immediate: true },
);
async function saveEvent(): Promise<void> {
  try {
    await api.patch<EventDto>(`/events/${eventId.value}`, { name: eventName.value, date: eventDate.value });
    await caisse.refresh();
    toast.show('Évènement enregistré');
  } catch (e) {
    toast.error(errorMessage(e));
  }
}
const deleteDialog = ref<HTMLDialogElement | null>(null);
async function removeEvent(): Promise<void> {
  try {
    await api.del(`/events/${eventId.value}`);
    deleteDialog.value?.close();
    caisse.close();
    await navigateTo('/');
  } catch (e) {
    toast.error(errorMessage(e));
  }
}
</script>

<template>
  <NuxtLayout name="event">
    <div class="articles">
      <header class="head">
        <h1>Articles</h1>
        <p class="event-name">{{ caisse.detail?.event.name ?? '…' }}</p>
      </header>

      <p v-if="!online" role="note" class="card notice"><AppIcon name="offline" /> Connexion nécessaire pour modifier les articles. La caisse, elle, continue de marcher.</p>

      <form class="card add" aria-label="Ajouter un article" novalidate @submit.prevent="add">
        <div class="row">
          <button type="button" class="picto-button" :aria-label="`Changer le picto (${newPicto ? pictoLabel(newPicto) : `automatique : ${autoLabel}`})`" @click="openPicker('new')">
            <PictoImg :name="newName" :picto="newPicto" :size="48" />
            <span class="pen" aria-hidden="true"><AppIcon name="pencil" :size="15" /></span>
          </button>
          <label class="field grow">
            Nom
            <input v-model="newName" type="text" :maxlength="LIMITS.articleName" placeholder="Crêpe nutella" autocomplete="off">
          </label>
        </div>
        <div class="row end">
          <label class="field price">
            Prix
            <input v-model="newPrice" type="text" inputmode="decimal" placeholder="2,50" autocomplete="off">
          </label>
          <button type="submit" class="btn btn-primary grow" :disabled="busy || !online">Ajouter</button>
        </div>
        <p v-if="addError" role="alert" class="error">{{ addError }}</p>
        <p class="hint">Picto choisi d’après le nom. Touchez-le pour en changer.</p>
      </form>

      <div v-if="caisse.articles.length > 0" class="list-head">
        <h2>En caisse, dans cet ordre</h2>
        <button type="button" class="btn btn-secondary small" @click="reordering = !reordering">{{ reordering ? 'Terminé' : 'Réordonner' }}</button>
      </div>

      <ul v-if="caisse.articles.length > 0" class="card list">
        <li v-for="(article, index) in caisse.articles" :key="article.id" :class="{ off: !article.onSale }">
          <button type="button" class="row-picto" :aria-label="`Changer le picto de ${article.name}`" @click="openPicker(article)">
            <PictoImg :name="article.name" :picto="article.picto" :size="40" />
          </button>
          <button type="button" class="row-main" :aria-label="`Modifier ${article.name}`" @click="edit(article)">
            <span class="row-name">{{ article.name }}</span>
            <span class="row-sub num">{{ article.onSale ? formatEuros(article.priceCents) : `Épuisé · masqué de la caisse` }}</span>
          </button>
          <template v-if="reordering">
            <button type="button" class="icon-button" :aria-label="`Monter ${article.name}`" :disabled="index === 0" @click="move(article, -1)"><AppIcon name="up" /></button>
            <button type="button" class="icon-button" :aria-label="`Descendre ${article.name}`" :disabled="index === caisse.articles.length - 1" @click="move(article, 1)"><AppIcon name="down" /></button>
          </template>
          <label v-else class="switch">
            <input type="checkbox" role="switch" :checked="article.onSale" :aria-label="`${article.name} en vente`" @change="patch(article, { onSale: !article.onSale })">
            <span class="track" aria-hidden="true"><span class="knob" /></span>
          </label>
        </li>
      </ul>

      <form class="card block" @submit.prevent="saveEvent">
        <h2>L’évènement</h2>
        <label class="field">
          Nom de l’évènement
          <input v-model="eventName" type="text" :maxlength="LIMITS.eventName" required>
        </label>
        <label class="field">
          Date
          <input v-model="eventDate" type="date" required>
        </label>
        <button type="submit" class="btn btn-primary">Enregistrer l’évènement</button>
        <button type="button" class="btn btn-text" @click="deleteDialog?.showModal()">Supprimer l’évènement</button>
      </form>
    </div>

    <PictoPicker ref="picker" :name="pickerName" :picto="pickerPicto" @choose="onPicked" />

    <dialog ref="editDialog" class="sheet" aria-labelledby="edit-title">
      <span class="sheet-grip" aria-hidden="true" />
      <form v-if="editing" class="sheet-form" @submit.prevent="saveEdit">
        <div class="sheet-head">
          <h2 id="edit-title">Modifier l’article</h2>
          <button type="button" class="icon-button" aria-label="Fermer" @click="editDialog?.close()"><AppIcon name="close" :size="20" /></button>
        </div>
        <label class="field">
          Nom
          <input v-model="editName" type="text" :maxlength="LIMITS.articleName" required>
        </label>
        <label class="field">
          Prix
          <input v-model="editPrice" type="text" inputmode="decimal" required>
          <span class="hint">Les ventes déjà faites gardent leur prix.</span>
        </label>
        <p v-if="editError" role="alert" class="error">{{ editError }}</p>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        <button type="button" class="btn btn-text" @click="removeArticle">Supprimer l’article</button>
        <p class="hint">Un article déjà vendu reste dans le bilan et l’export.</p>
      </form>
    </dialog>

    <dialog ref="deleteDialog" class="sheet" aria-labelledby="delete-title">
      <span class="sheet-grip" aria-hidden="true" />
      <div class="sheet-form">
        <h2 id="delete-title">Supprimer « {{ caisse.detail?.event.name }} » ?</h2>
        <p>Ses articles et toutes ses ventes seront effacés, sur tous les appareils. C’est définitif.</p>
        <button type="button" class="btn btn-primary btn-block" @click="removeEvent">Supprimer définitivement</button>
        <button type="button" class="btn btn-quiet btn-block" @click="deleteDialog?.close()">Annuler</button>
      </div>
    </dialog>
  </NuxtLayout>
</template>

<style scoped>
.articles {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
}
.head {
  padding: 0 4px;
}
.event-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--muted);
}
h1 {
  font-size: 28px;
  letter-spacing: -0.01em;
}
h2 {
  font-size: 18px;
}
.notice {
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 700;
  color: var(--wait);
}
.add {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.grow {
  flex: 1;
  min-width: 0;
}
.field.price {
  width: 120px;
}
.add .field input {
  min-height: 48px;
}
.add .btn {
  min-height: 48px;
}
.picto-button {
  position: relative;
  flex: none;
  width: 72px;
  height: 72px;
  border: 0;
  border-radius: 20px;
  background: var(--ground);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pen {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--card);
  box-shadow: 0 2px 6px rgba(59, 42, 38, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
}
.hint {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
}
.error {
  font-weight: 800;
  color: #8f2410;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  margin-top: 2px;
}
.btn.small {
  min-height: 44px;
  padding: 0 14px;
  font-size: 14px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 8px;
}
.list li + li {
  border-top: 1px solid var(--rule);
}
.row-picto {
  width: 52px;
  height: 52px;
  flex: none;
  border: 0;
  border-radius: 14px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}
.off .row-picto :deep(img) {
  opacity: 0.45;
}
.row-main {
  flex: 1;
  min-width: 0;
  min-height: 48px;
  border: 0;
  background: transparent;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.row-name {
  font-size: 17px;
  font-weight: 800;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.row-sub {
  font-size: 14px;
  font-weight: 700;
  color: var(--muted);
}
.off .row-sub {
  color: var(--wait);
}
.switch {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 44px;
  cursor: pointer;
}
.switch input {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}
.track {
  width: 52px;
  height: 32px;
  border-radius: 999px;
  padding: 3px;
  background: var(--track-off);
  display: flex;
  transition: background-color 160ms ease-out;
}
.knob {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(31, 21, 18, 0.25);
  transition: transform 240ms var(--spring);
}
.switch input:checked + .track {
  background: var(--ok);
}
.switch input:checked + .track .knob {
  transform: translateX(20px);
}
.switch input:focus-visible + .track {
  outline: 3px solid var(--coral);
  outline-offset: 2px;
}
.icon-button:disabled {
  opacity: 0.35;
}
.block {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 8px;
}
.sheet-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sheet-form p {
  font-size: 16px;
  font-weight: 600;
}
</style>
