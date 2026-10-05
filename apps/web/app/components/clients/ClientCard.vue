<script setup lang="ts">
/**
 * Fiche d’un client dans la liste mobile (Mobile-Missions.dc.html l. 67 à 81) : bandeau couleur (nom, sous-titre, tarif), jours
 * et montant par mois, période et délai de paiement. Toute la carte ouvre la mission : le lien « Modifier la mission » est étiré
 * sur la carte (`::after`), ce qui garde le texte de la carte lisible tel quel par un lecteur d’écran.
 * Tant que le client n’est pas confirmé par le serveur (identifiant `tmp-…`, R26), la carte n’ouvre rien.
 */
const props = defineProps<{ row: MissionRow }>();

const pending = computed(() => props.row.id.startsWith('tmp-'));
/** Une piste est dite en toutes lettres (la couleur ne suffit pas), puis le sous-titre et les jours. */
const sub = computed(() => [props.row.prospect ? 'Piste' : '', props.row.subtitle, props.row.days].filter(Boolean).join(' · '));
const link = computed(() => `Modifier la mission ${props.row.name}`);
/** « 30 jours · + 10 j de retard en moyenne » : le délai du contrat, puis le retard constaté. */
const payment = computed(() => `${props.row.term} · ${props.row.delay}`);
</script>

<template>
  <article class="card client">
    <div class="band" :style="{ background: row.color.base, color: row.color.fg }">
      <div class="who">
        <h2>{{ row.name }}</h2>
        <span class="sub">{{ sub }}</span>
      </div>
      <span class="num rate">{{ row.rate }}</span>
    </div>
    <div class="figures">
      <span class="num figure">{{ row.daysPerMonth.value }} <span v-if="row.daysPerMonth.unit" class="unit">{{ row.daysPerMonth.unit }}</span></span>
      <span class="num figure">{{ row.monthly }}<span class="unit"> / mois</span></span>
    </div>
    <dl class="facts">
      <div class="fact"><dt>Période</dt><dd>{{ row.period }}</dd></div>
      <div class="fact"><dt>Paie à</dt><dd>{{ payment }}</dd></div>
    </dl>
    <NuxtLink v-if="!pending" :to="`/clients/${row.id}`" class="open" :aria-label="link">
      Modifier la mission<AppIcon name="chevron-right" :size="18" />
    </NuxtLink>
    <span v-else class="open is-pending">Création en cours…</span>
  </article>
</template>

<style scoped>
.client { position: relative; overflow: hidden; }
.band { padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
h2 { margin: 0; font-size: 22px; font-weight: 800; overflow-wrap: anywhere; }
.sub { font-size: 14px; opacity: .85; }
.rate { flex: none; font-size: 20px; }
.figures { padding: 16px 18px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
.figure { font-size: 22px; }
.unit { font-family: var(--font-text); font-size: 13px; font-weight: 600; color: var(--muted); }
.facts { margin: 0; padding: 0 18px 8px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.fact { display: flex; justify-content: space-between; gap: 10px; }
dt { color: var(--muted); }
dd { margin: 0; font-weight: 600; text-align: right; }
/* Cible de 44 px au moins, sur toute la largeur ; le pseudo-élément étend la zone tactile à la carte entière. */
.open { margin: 0 18px; min-height: 48px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-soft); color: var(--link); font-weight: 700; text-decoration: none; }
a.open::after { content: ''; position: absolute; inset: 0; }
.open.is-pending { color: var(--muted); }
</style>
