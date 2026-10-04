<script setup lang="ts">
/**
 * Confirmation dans un `<dialog>` natif ouvert par `showModal()` : le reste de la page devient inerte (focus piégé),
 * Échap déclenche `cancel`, et le focus retourne à l’élément qui avait ouvert la boîte. C’est le parent qui porte `open`.
 * Le premier élément focalisable reçoit le focus : le mot de passe s’il y en a un, sinon « Annuler » (choix prudent).
 */
const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  withPassword?: boolean;
}>();
const emit = defineEmits<{ confirm: [password?: string]; cancel: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const password = ref('');
const titleId = useId();
const messageId = useId();
let opener: HTMLElement | null = null;

function show(): void {
  const el = dialog.value;
  if (!el || el.open) return;
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  password.value = '';
  el.showModal();
}

function hide(): void {
  const el = dialog.value;
  password.value = '';
  if (!el?.open) return;
  el.close();
  opener?.focus();
  opener = null;
}

watch(() => props.open, (open) => (open ? show() : hide()), { flush: 'post' });
onMounted(() => { if (props.open) show(); });

/** Fermeture native sans passer par le parent (ex. seconde pression sur Échap) : on le prévient. */
function onClose(): void {
  if (props.open) emit('cancel');
}

function onSubmit(): void {
  if (props.withPassword) emit('confirm', password.value);
  else emit('confirm');
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** `showModal()` rend le reste de la page inerte, mais laisse Tab sortir vers l’interface du navigateur : on reboucle dans la boîte. */
function trapTab(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !dialog.value) return;
  const items = [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === dialog.value)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <dialog ref="dialog" :aria-labelledby="titleId" :aria-describedby="messageId" @cancel.prevent="emit('cancel')" @close="onClose" @keydown="trapTab">
    <form @submit.prevent="onSubmit">
      <h2 :id="titleId" class="title">{{ title }}</h2>
      <p :id="messageId" class="message">{{ message }}</p>
      <label v-if="withPassword" class="field">
        <span>Mot de passe</span>
        <input v-model="password" type="password" autocomplete="current-password" required>
      </label>
      <div class="actions">
        <AppButton @click="emit('cancel')">Annuler</AppButton>
        <AppButton type="submit" variant="primary" :class="{ danger }">{{ confirmLabel }}</AppButton>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
dialog {
  width: calc(100% - 32px);
  max-width: 440px;
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 0;
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 24px 60px rgba(31, 26, 46, .35);
  overflow: auto;
}
dialog::backdrop { background: rgba(31, 26, 46, .55); }
form { display: flex; flex-direction: column; gap: 16px; padding: 26px; }
.title { margin: 0; font-size: 24px; font-weight: 800; }
.message { margin: 0; color: var(--ink-2); line-height: 1.55; }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 12px; }
.btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.danger:hover:not(:disabled) { background: var(--danger-ink); border-color: var(--danger-ink); }
@media (max-width: 480px) {
  form { padding: 22px; }
  .actions { flex-direction: column-reverse; }
  .actions :deep(.btn) { width: 100%; }
}
</style>
