<script setup lang="ts">
/**
 * Pastille d’initiales du compte (société ou prénom), penchée de 6° : logo et ligne de profil de la barre latérale
 * (`lg`, `sm`, décoratifs), pastille de l’en-tête mobile (`md`, avec `link` : lien vers le profil),
 * identité de l’écran Profil (`xl`).
 */
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' | 'xl'; link?: boolean }>(), { size: 'md' });

const auth = useAuthStore();
const treso = useTresoStore();
const text = computed(() => initials(auth.me?.user.companyName ?? null, auth.me?.user.firstName ?? treso.profile?.firstName ?? ''));
</script>

<template>
  <NuxtLink v-if="link" to="/profile" class="badge" :class="`is-${size}`" aria-label="Ton profil">{{ text }}</NuxtLink>
  <span v-else class="badge" :class="`is-${size}`" aria-hidden="true">{{ text }}</span>
</template>

<style scoped>
.badge {
  flex: none;
  background: var(--sun);
  color: var(--ink);
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  transform: rotate(-6deg);
}
.badge:hover { color: var(--ink); }
.is-sm { width: 36px; height: 36px; border-radius: 12px; font-size: 14px; }
.is-md { width: 44px; height: 44px; border-radius: 15px; font-size: 16px; }
.is-lg { width: 48px; height: 48px; border-radius: 16px; font-size: 18px; }
.is-xl { width: 72px; height: 72px; border-radius: 24px; font-size: 26px; }
</style>
