<script setup lang="ts">
import { euros, shortDate, yearOf, type Cents, type ISODate } from '@matreso/engine';

const auth = useAuthStore();
const route = useRoute();

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
  { to: '/clients', label: 'Clients & missions', icon: 'clients' },
  { to: '/calendar', label: 'Calendrier & congés', icon: 'calendar' },
  { to: '/expenses', label: 'Charges', icon: 'receipt' },
] as const satisfies ReadonlyArray<{ to: string; label: string; icon: IconName }>;

/** `/` exact, les autres sections avec leurs sous-pages (`/clients/new`, `/clients/:id`). */
function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`);
}

const name = computed(() => auth.me?.user.firstName ?? '');
const companyName = computed(() => auth.me?.user.companyName ?? null);
const badge = computed(() => initials(companyName.value, name.value));
const subtitle = computed(() => companyName.value?.trim() || name.value);

// Task 24 : lira le dernier solde du store de projection (montant et date).
const latest = computed<{ amount: Cents; date: ISODate } | null>(() => null);
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo" aria-hidden="true">{{ badge }}</div>
      <div class="brand-text">
        <span class="brand-name">Ma Tréso</span>
        <span class="brand-sub">{{ subtitle }}</span>
      </div>
    </div>

    <nav class="nav" aria-label="Navigation principale">
      <NuxtLink
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        :class="{ on: isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <AppIcon :name="item.icon" :size="20" />{{ item.label }}
      </NuxtLink>
    </nav>

    <div class="bottom">
      <NuxtLink to="/" class="balance" aria-current="false">
        <span class="balance-label">Sur le compte</span>
        <span class="num balance-amount">{{ latest ? euros(latest.amount) : '—' }}</span>
        <span v-if="latest" class="balance-date">Mis à jour le {{ shortDate(latest.date) }} {{ yearOf(latest.date) }}</span>
      </NuxtLink>

      <NuxtLink to="/profile" class="profile" :class="{ on: isActive('/profile') }" :aria-current="isActive('/profile') ? 'page' : undefined">
        <span class="profile-badge" aria-hidden="true">{{ badge }}</span>
        <span class="profile-name">{{ name }}</span>
      </NuxtLink>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  flex: none;
  width: 260px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 28px 18px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  background: var(--ink);
  color: #fff;
}
.brand { display: flex; align-items: center; gap: 12px; padding: 0 6px; }
.logo {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--sun);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
  transform: rotate(-6deg);
}
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-name { font-family: var(--font-display); font-weight: 800; font-size: 24px; }
.brand-sub { font-size: 14px; color: var(--on-night-muted); overflow-wrap: anywhere; }
.nav { display: flex; flex-direction: column; gap: 4px; }
.bottom { margin-top: auto; display: flex; flex-direction: column; gap: 12px; }
.balance {
  padding: 18px;
  border-radius: 22px;
  background: var(--night-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #fff;
  text-decoration: none;
  font-weight: 400;
}
.balance:hover { background: var(--night-hover); color: #fff; }
.balance-label { font-size: 14px; color: var(--on-night-muted); font-weight: 600; }
.balance-amount { font-size: 30px; }
.balance-date { font-size: 13px; color: var(--on-night-muted); }
.profile {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 16px;
  border-radius: var(--radius-pill);
  color: var(--on-night);
  text-decoration: none;
  font-size: 16px;
  font-weight: 600;
}
.profile:hover { background: var(--night-hover); color: #fff; }
.profile.on { background: var(--night-2); color: #fff; }
.profile-badge {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--sun);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 14px;
  transform: rotate(-6deg);
}
.profile-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
