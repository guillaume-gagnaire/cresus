<script setup lang="ts">
import type { AdminAccountDto, AdminStatsDto } from '@cresus/shared';
import { api, errorMessage } from '~/utils/api';
import { formatEuros, salesLabel } from '~/utils/format';

useHead({ title: 'Administration — Cresus' });

const stats = ref<AdminStatsDto | null>(null);
const accounts = ref<AdminAccountDto[]>([]);
const q = ref('');
const error = ref('');
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' });

async function load(): Promise<void> {
  try {
    const search = q.value.trim() ? `?q=${encodeURIComponent(q.value.trim())}` : '';
    accounts.value = await api.get<AdminAccountDto[]>(`/admin/accounts${search}`);
  } catch (e) {
    error.value = errorMessage(e);
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null;
watch(q, () => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void load(), 250);
});

onMounted(async () => {
  try {
    stats.value = await api.get<AdminStatsDto>('/admin/stats');
  } catch (e) {
    error.value = errorMessage(e);
  }
  await load();
});
</script>

<template>
  <div class="admin">
    <NuxtLink to="/" class="back"><AppIcon name="back" :size="20" /> Évènements</NuxtLink>
    <h1>Administration</h1>

    <p v-if="error" role="alert" class="card error">{{ error }}</p>

    <section v-if="stats" class="stats" aria-label="Chiffres de l’instance">
      <div class="card stat"><span class="value num" data-testid="stat-accounts">{{ stats.accounts }}</span><span class="label">assos</span></div>
      <div class="card stat"><span class="value num">{{ stats.events }}</span><span class="label">évènements</span></div>
      <div class="card stat"><span class="value num">{{ stats.salesCount }}</span><span class="label">ventes</span></div>
      <div class="card stat"><span class="value num">{{ formatEuros(stats.revenueCents) }}</span><span class="label">encaissés</span></div>
      <div class="card stat"><span class="value num">{{ stats.salesLast7Days }}</span><span class="label">ventes sur 7 jours</span></div>
    </section>

    <label class="search">
      <AppIcon name="search" :size="20" class="search-icon" />
      <input v-model="q" type="search" aria-label="Chercher un compte" placeholder="Chercher une asso : nom ou email" autocomplete="off">
    </label>

    <ul class="list">
      <li v-for="account in accounts" :key="account.id">
        <NuxtLink :to="`/admin/comptes/${account.id}`" class="card row">
          <span class="who">
            <span class="name">{{ account.name }}</span>
            <span class="email">{{ account.email }}</span>
            <span class="meta">
              {{ account.eventsCount }} évènement{{ account.eventsCount > 1 ? 's' : '' }} · inscrite le {{ shortDate.format(new Date(account.createdAt)) }}
              <template v-if="account.lastSaleAt"> · dernière vente le {{ shortDate.format(new Date(account.lastSaleAt)) }}</template>
            </span>
          </span>
          <span class="figures">
            <span class="money num">{{ formatEuros(account.revenueCents) }}</span>
            <span class="count num">{{ salesLabel(account.salesCount) }}</span>
          </span>
          <AppIcon name="next" :size="20" class="chev" />
        </NuxtLink>
      </li>
    </ul>
    <p v-if="accounts.length === 0 && !error" class="empty">Aucun compte{{ q ? ` pour « ${q} »` : '' }}.</p>
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
h1 {
  margin: 0 4px;
  font-size: 28px;
  letter-spacing: -0.01em;
}
.error {
  padding: 12px 14px;
  font-weight: 800;
  color: #8f2410;
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.stat {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
}
.stat:last-child {
  grid-column: 1 / -1;
}
.value {
  font-size: 26px;
  font-weight: 900;
  color: var(--ink);
}
.label {
  font-size: 14px;
  font-weight: 800;
  color: var(--muted);
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
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px 14px 16px;
  text-decoration: none;
  color: var(--ink);
}
.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.name {
  font-size: 17px;
  font-weight: 900;
}
.email {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  overflow-wrap: anywhere;
}
.meta,
.count {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}
.figures {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.money {
  font-size: 17px;
  font-weight: 900;
}
.chev {
  color: var(--muted);
  flex: none;
}
.empty {
  padding: 0 4px;
  font-weight: 600;
}
@media (min-width: 720px) {
  .stats {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .stat:last-child {
    grid-column: auto;
  }
}
</style>
