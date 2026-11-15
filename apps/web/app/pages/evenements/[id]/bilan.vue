<script setup lang="ts">
import type { SaleDto, SalesPageDto } from '@cresus/shared';
import { useCaisseStore } from '~/stores/caisse';
import { api, errorMessage } from '~/utils/api';
import { formatEuros, formatTime } from '~/utils/format';

definePageMeta({ layout: false });

const route = useRoute();
const caisse = useCaisseStore();
const toast = useToast();
const online = useOnline();
const eventId = computed(() => String(route.params.id));

useHead(() => ({ title: `Bilan — ${caisse.detail?.event.name ?? 'Cresus'}` }));

const sales = ref<SaleDto[]>([]);
const next = ref<string | null>(null);
const loading = ref(false);

async function loadSales(reset: boolean): Promise<void> {
  loading.value = true;
  try {
    const cursor = !reset && next.value ? `&cursor=${encodeURIComponent(next.value)}` : '';
    const page = await api.get<SalesPageDto>(`/events/${eventId.value}/sales?limit=50${cursor}`);
    sales.value = reset ? page.sales : [...sales.value, ...page.sales];
    next.value = page.next;
  } catch (e) {
    if (reset) sales.value = [];
    toast.error(errorMessage(e));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void caisse.open(eventId.value);
  void loadSales(true);
});
onBeforeUnmount(() => caisse.close());

// les ventes des autres téléphones arrivent en direct : l'historique suit (au plus une fois par seconde)
let reload: ReturnType<typeof setTimeout> | null = null;
watch(
  () => caisse.tick,
  () => {
    if (reload) clearTimeout(reload);
    reload = setTimeout(() => void loadSales(true), 1000);
  },
);

const confirm = ref<HTMLDialogElement | null>(null);
const target = ref<SaleDto | null>(null);
function askRemove(sale: SaleDto): void {
  target.value = sale;
  confirm.value?.showModal();
}
async function remove(): Promise<void> {
  const sale = target.value;
  if (!sale) return;
  confirm.value?.close();
  sales.value = sales.value.filter((s) => s.id !== sale.id);
  await caisse.voidSale({ eventId: eventId.value, id: sale.id, articleId: sale.articleId, priceCents: sale.priceCents });
  await loadSales(true);
}

const pictoOf = (articleId: string) => caisse.detail?.articles.find((a) => a.id === articleId)?.picto ?? null;
</script>

<template>
  <NuxtLayout name="event">
    <p v-if="!online" role="note" class="card offline"><AppIcon name="offline" /> Connexion nécessaire pour le bilan à jour.</p>

    <BilanView
      v-if="caisse.detail && caisse.shown"
      :event="caisse.detail.event"
      :articles="caisse.detail.articles"
      :summary="caisse.shown"
      :export-href="`/api/events/${eventId}/export`"
    >
      <section class="card block" aria-labelledby="history">
        <h2 id="history">Dernières ventes</h2>
        <p class="hint">Une erreur ? Supprimez la vente, depuis n’importe quel téléphone.</p>
        <ul v-if="sales.length > 0" class="history">
          <li v-for="sale in sales" :key="sale.id">
            <span class="time num">{{ formatTime(sale.soldAt) }}</span>
            <PictoImg :name="sale.articleName" :picto="pictoOf(sale.articleId)" :size="26" />
            <span class="what">{{ sale.articleName }}</span>
            <span class="num price">{{ formatEuros(sale.priceCents) }}</span>
            <button type="button" class="btn btn-text" :aria-label="`Supprimer la vente ${sale.articleName} de ${formatTime(sale.soldAt)}`" @click="askRemove(sale)">Supprimer</button>
          </li>
        </ul>
        <p v-else-if="!loading" class="hint">Aucune vente pour l’instant.</p>
        <button v-if="next" type="button" class="btn btn-quiet btn-block" :disabled="loading" @click="loadSales(false)">Voir plus</button>
      </section>
    </BilanView>

    <dialog ref="confirm" class="sheet" aria-labelledby="remove-title">
      <span class="sheet-grip" aria-hidden="true" />
      <div v-if="target" class="confirm">
        <h2 id="remove-title">Supprimer cette vente ?</h2>
        <p>{{ target.articleName }}, {{ formatEuros(target.priceCents) }}, à {{ formatTime(target.soldAt) }}. Elle sera retirée du total sur tous les appareils.</p>
        <button type="button" class="btn btn-primary btn-block" @click="remove">Supprimer la vente</button>
        <button type="button" class="btn btn-quiet btn-block" @click="confirm?.close()">Garder</button>
      </div>
    </dialog>
  </NuxtLayout>
</template>

<style scoped>
.offline {
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 700;
  color: var(--wait);
}
.block {
  padding: 16px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h2 {
  font-size: 18px;
}
.hint {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
}
.history {
  list-style: none;
  margin: 0;
  padding: 0;
}
.history li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  border-top: 1px solid var(--rule);
}
.time {
  width: 46px;
  font-size: 15px;
  font-weight: 800;
  color: var(--muted);
}
.what {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.price {
  font-size: 15px;
  font-weight: 800;
}
.confirm {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.confirm p {
  font-size: 16px;
  font-weight: 600;
}
</style>
