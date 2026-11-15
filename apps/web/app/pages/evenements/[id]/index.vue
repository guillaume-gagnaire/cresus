<script setup lang="ts">
import type { SalesPageDto, SaleDto } from '@cresus/shared';
import { useAuthStore } from '~/stores/auth';
import { useCaisseStore } from '~/stores/caisse';
import { api } from '~/utils/api';
import { formatEuros, formatTime, salesLabel } from '~/utils/format';

definePageMeta({ layout: false });

const route = useRoute();
const caisse = useCaisseStore();
const auth = useAuthStore();
const wide = useWide();
const eventId = computed(() => String(route.params.id));

useHead(() => ({ title: `${caisse.detail?.event.name ?? 'Caisse'} — Cresus` }));

const showToast = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => caisse.lastSale?.at,
  (at) => {
    if (toastTimer) clearTimeout(toastTimer);
    showToast.value = !!at;
    if (at) toastTimer = setTimeout(() => (showToast.value = false), 5000);
  },
);

const recent = ref<SaleDto[]>([]);
let recentTimer: ReturnType<typeof setTimeout> | null = null;
async function loadRecent(): Promise<void> {
  try {
    recent.value = (await api.get<SalesPageDto>(`/events/${eventId.value}/sales?limit=8`, { quiet401: true })).sales;
  } catch {
    // hors ligne : la liste garde ce qu'elle avait
  }
}
watch(
  () => [caisse.tick, caisse.ops.length, wide.value] as const,
  () => {
    if (!wide.value) return;
    if (recentTimer) clearTimeout(recentTimer);
    recentTimer = setTimeout(() => void loadRecent(), 700);
  },
);

let wakeLock: { release(): Promise<void> } | null = null;
async function keepAwake(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (document.visibilityState === 'visible' && nav.wakeLock) wakeLock = await nav.wakeLock.request('screen');
  } catch {
    // refusé (économie d'énergie) : l'écran s'éteindra comme d'habitude
  }
}
const onVisible = () => void keepAwake();

onMounted(() => {
  void caisse.open(eventId.value);
  void keepAwake();
  document.addEventListener('visibilitychange', onVisible);
  if (wide.value) void loadRecent();
});
onBeforeUnmount(() => {
  caisse.close();
  document.removeEventListener('visibilitychange', onVisible);
  void wakeLock?.release().catch(() => undefined);
  if (toastTimer) clearTimeout(toastTimer);
});

function undo(): void {
  caisse.undoLast();
  showToast.value = false;
}

async function reconnect(): Promise<void> {
  auth.expire();
  await navigateTo({ path: '/login', query: { redirect: route.fullPath } });
}

const total = computed(() => formatEuros(caisse.shown?.revenueCents ?? 0));
const sales = computed(() => salesLabel(caisse.shown?.salesCount ?? 0));
</script>

<template>
  <NuxtLayout name="event">
    <template #status>
      <SyncPill v-if="!wide" :state="caisse.state" :pending="caisse.pendingCount" :devices="caisse.devices" @reconnect="reconnect" />
    </template>

    <div class="caisse" :class="{ wide }">
      <section class="main">
        <header v-if="!wide" class="head">
          <h1>{{ caisse.detail?.event.name ?? '…' }}</h1>
          <p class="figures">
            <span class="total num" data-testid="total">{{ total }}</span>
            <span class="sales num">{{ sales }}</span>
          </p>
        </header>

        <div v-if="caisse.detail && caisse.onSale.length === 0" class="card empty">
          <h2>Ajoutez vos articles</h2>
          <p>Crêpes, boissons, tickets de tombola… Chaque article devient un gros bouton : un appui, une vente.</p>
          <NuxtLink :to="`/evenements/${eventId}/articles`" class="btn btn-primary">Ajouter des articles</NuxtLink>
        </div>

        <div v-else class="grid">
          <CaisseTile
            v-for="article in caisse.onSale"
            :key="article.id"
            :article="article"
            :count="caisse.countOf(article.id)"
            :touched="caisse.lastSale?.articleId === article.id"
            :bump="caisse.lastSale?.at ?? 0"
            @sell="caisse.sell(article)"
          />
        </div>
      </section>

      <aside v-if="wide" class="aside" aria-label="Résumé de la caisse">
        <div class="aside-head">
          <h1>{{ caisse.detail?.event.name ?? '…' }}</h1>
          <SyncPill :state="caisse.state" :pending="caisse.pendingCount" :devices="caisse.devices" @reconnect="reconnect" />
        </div>
        <p class="figures column">
          <span class="total big num" data-testid="total">{{ total }}</span>
          <span class="sales num">{{ sales }}</span>
        </p>
        <div v-if="showToast && caisse.lastSale" role="status" class="toast inline">
          <span class="toast-text">
            <span class="toast-no num">Vente n°{{ caisse.lastSale.saleNo }}</span>
            <span class="toast-what">{{ caisse.lastSale.name }} +1</span>
          </span>
          <button type="button" class="toast-undo" @click="undo">Annuler</button>
        </div>
        <div class="recent">
          <h2>Dernières ventes, tous appareils</h2>
          <ul>
            <li v-for="sale in recent" :key="sale.id">
              <span class="time num">{{ formatTime(sale.soldAt) }}</span>
              <PictoImg :name="sale.articleName" :picto="caisse.detail?.articles.find((a) => a.id === sale.articleId)?.picto ?? null" :size="24" />
              <span class="what">{{ sale.articleName }}</span>
              <span class="num">{{ formatEuros(sale.priceCents) }}</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <Transition name="rise">
      <div v-if="!wide && showToast && caisse.lastSale" role="status" class="toast floating">
        <span class="toast-text">
          <span class="toast-no num">Vente n°{{ caisse.lastSale.saleNo }}</span>
          <span class="toast-what">{{ caisse.lastSale.name }} +1</span>
        </span>
        <button type="button" class="toast-undo" @click="undo">Annuler</button>
      </div>
    </Transition>
  </NuxtLayout>
</template>

<style scoped>
.caisse {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}
h1 {
  font-size: 22px;
  line-height: 1.15;
}
.figures {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.figures.column {
  flex-direction: column;
  gap: 2px;
}
.total {
  font-size: 44px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.total.big {
  font-size: 60px;
  line-height: 1;
}
.sales {
  font-size: 16px;
  font-weight: 800;
  color: var(--muted);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-bottom: 80px;
}
.empty {
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.empty p {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
}

.toast {
  min-height: 64px;
  padding: 8px 8px 8px 18px;
  border-radius: 20px;
  background: var(--ink);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.toast.floating {
  position: fixed;
  left: 14px;
  right: 14px;
  bottom: calc(var(--tabbar-h) + 14px + env(safe-area-inset-bottom));
  z-index: 25;
  max-width: 612px;
  margin: 0 auto;
  box-shadow: var(--shadow-toast);
}
.toast-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.toast-no {
  font-size: 13px;
  font-weight: 700;
  color: #e9cfc6;
}
.toast-what {
  font-size: 17px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toast-undo {
  min-height: 48px;
  padding: 0 20px;
  border: 0;
  border-radius: 14px;
  background: #fff;
  color: var(--ink);
  font-size: 16px;
  font-weight: 900;
  flex: none;
}
.rise-enter-active {
  transition: transform 320ms var(--ease-out), opacity 320ms var(--ease-out);
}
.rise-leave-active {
  transition: opacity 180ms ease-out;
}
.rise-enter-from {
  transform: translateY(14px);
  opacity: 0;
}
.rise-leave-to {
  opacity: 0;
}

/* Tablette : 4 colonnes et une colonne de résumé */
.caisse.wide {
  flex-direction: row;
  align-items: flex-start;
  gap: 20px;
}
.wide .main {
  flex: 1;
  min-width: 0;
}
.wide .grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding-bottom: 0;
}
.aside {
  width: 340px;
  flex: none;
  position: sticky;
  top: 18px;
  padding: 22px 20px;
  border-radius: var(--radius-big);
  background: var(--card);
  box-shadow: var(--shadow-raised);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.aside-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.aside h1 {
  font-size: 24px;
}
.aside :deep(.pill) {
  background: var(--ground);
}
.recent h2 {
  font-size: 16px;
  margin-bottom: 4px;
}
.recent ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.recent li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid var(--rule);
  font-size: 15px;
  font-weight: 800;
}
.recent .time {
  width: 44px;
  font-size: 14px;
  color: var(--muted);
}
.recent .what {
  flex: 1;
  min-width: 0;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
