<script setup lang="ts">
/**
 * Tarif de la mission (Clients.dc.html l. 114 à 130) : valeur actuelle, historique daté avec ses pastilles, et le formulaire
 * d’un nouveau tarif. Le dernier tarif d’un client ne se supprime pas : la corbeille est absente quand `canDelete` est faux.
 */
defineProps<{ title: string; current: string; history: RateItem[]; newLabel: string }>();
const emit = defineEmits<{ add: [rate: { validFrom: string; amount: number }]; remove: [id: string] }>();

const toast = useToast();
const amount = ref<number | null>(null);
const from = ref<string | null>(null);

const BADGES = {
  CURRENT: { bg: 'var(--client-indigo)', fg: '#fff' },
  FUTURE: { bg: 'var(--sun)', fg: 'var(--ink)' },
  PAST: { bg: 'var(--border-soft)', fg: 'var(--muted)' },
} as const;

function submit(): void {
  if (!amount.value || amount.value <= 0 || !from.value) {
    toast.error('Indique le montant et la date de début du tarif.');
    return;
  }
  emit('add', { validFrom: from.value, amount: amount.value });
  amount.value = null;
  from.value = null;
}
</script>

<template>
  <div class="rates">
    <div class="current">
      <span class="current-title">{{ title }}</span>
      <span class="num current-value">{{ current }}</span>
    </div>
    <ul class="history" aria-label="Historique des tarifs">
      <li v-for="item in history" :key="item.id" class="item">
        <span class="dot" :style="{ background: item.status === 'PAST' ? '#D9D2C5' : BADGES[item.status].bg }" aria-hidden="true" />
        <div class="info">
          <span class="num value" :class="{ past: item.status === 'PAST' }">{{ item.value }}</span>
          <span class="when">{{ item.when }}</span>
        </div>
        <AppBadge class="rate-badge" :bg="BADGES[item.status].bg" :fg="BADGES[item.status].fg">{{ item.badge }}</AppBadge>
        <button v-if="item.canDelete" type="button" class="del" :aria-label="item.deleteLabel" :disabled="item.pending" @click="emit('remove', item.id)">
          <AppIcon name="trash" :size="18" />
        </button>
      </li>
    </ul>
    <form class="add" @submit.prevent="submit">
      <MoneyInput v-model="amount" :label="newLabel" :min="0" :step="10" />
      <DateInput v-model="from" label="À partir du" />
      <AppButton type="submit" variant="primary">Ajouter</AppButton>
    </form>
    <span class="note">Les anciens tarifs restent appliqués à leurs périodes : seuls les jours après la date changent.</span>
  </div>
</template>

<style scoped>
.rates { padding: 16px; border-radius: 20px; background: #F6F5FF; display: flex; flex-direction: column; gap: 12px; }
.current { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.current-title { font-weight: 700; color: #23237A; }
.current-value { font-size: 24px; }
.history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px; background: var(--surface); }
.dot { flex: none; width: 10px; height: 10px; border-radius: 999px; }
.info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.value { font-size: 16px; }
/* Tarif révolu : barré et estompé, et la pastille « Ancien » le dit aussi en toutes lettres. */
.value.past { color: var(--muted); text-decoration: line-through; }
.when { font-size: 13px; color: var(--muted); }
.item .rate-badge { flex: none; padding: 3px 10px; font-size: 12px; }
/* Cible de 44 px, sans agrandir la ligne : la marge négative rend la place prise. */
.del { flex: none; width: 44px; height: 44px; margin: -8px -6px -8px 0; border: 0; border-radius: 999px; background: transparent; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.del:hover:not(:disabled) { background: var(--border-soft); color: var(--danger); }
.del:disabled { opacity: .5; cursor: not-allowed; }
/* Deux champs côte à côte, puis le bouton sur toute la largeur : le panneau (≈ 350 px) est trop étroit pour les trois sur une ligne. */
.add { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: end; }
.add .btn { grid-column: 1 / -1; }
.add :deep(.field) { font-size: 13px; }
.add :deep(.field input) { min-height: 46px; padding-left: 12px; }
.add :deep(.field input[type='date']) { padding-right: 8px; }
.add .btn { min-height: 46px; }
.note { font-size: 13px; color: var(--muted); }
</style>
