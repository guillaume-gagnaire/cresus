<script setup lang="ts">
const { installed, dismissed, dialogOpen, mode, install, dismiss } = useInstall();
const dialog = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  // un court délai laisse au navigateur le temps d'annoncer s'il sait installer (beforeinstallprompt)
  setTimeout(() => {
    if (!installed.value && !dismissed.value) dialogOpen.value = true;
  }, 700);
});

watch(dialogOpen, (open) => {
  if (open && !dialog.value?.open) dialog.value?.showModal();
  if (!open && dialog.value?.open) dialog.value.close();
});

watch(installed, (yes) => {
  if (yes) dialogOpen.value = false;
});

async function installNow(): Promise<void> {
  if (await install()) dialogOpen.value = false;
}

/** Échap ou clic sur le fond : comme « Plus tard ». */
function onCancel(event: Event): void {
  event.preventDefault();
  dismiss();
}
</script>

<template>
  <dialog ref="dialog" class="sheet" aria-labelledby="install-title" @cancel="onCancel" @click.self="dismiss">
    <span class="sheet-grip" aria-hidden="true" />
    <div class="body">
      <span class="badge" aria-hidden="true"><img src="/favicon.svg" alt="" width="64" height="64"></span>
      <h2 id="install-title">Installer Cresus</h2>
      <p class="lead">Cresus s’ouvre alors comme une appli, en plein écran, et la caisse marche même sans réseau.</p>

      <ol v-if="mode === 'ios'" class="steps">
        <li><span class="n">1</span> Touchez <strong class="inline"><AppIcon name="share" :size="18" /> Partager</strong> en bas de Safari.</li>
        <li><span class="n">2</span> Choisissez <strong>« Sur l’écran d’accueil »</strong>.</li>
        <li><span class="n">3</span> Touchez <strong>« Ajouter »</strong>.</li>
      </ol>
      <p v-else-if="mode === 'manual'" class="steps-text">
        Dans le menu du navigateur, choisissez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.
      </p>

      <div class="actions">
        <button v-if="mode === 'prompt'" type="button" class="btn btn-primary btn-big btn-block" @click="installNow">
          <AppIcon name="install" /> Installer
        </button>
        <button type="button" class="btn btn-quiet btn-block" @click="dismiss">{{ mode === 'prompt' ? 'Plus tard' : 'Compris, plus tard' }}</button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: stretch;
}
.badge {
  align-self: center;
  width: 84px;
  height: 84px;
  border-radius: 24px;
  background: var(--ground);
  display: flex;
  align-items: center;
  justify-content: center;
}
h2 {
  font-size: 24px;
  text-align: center;
}
.lead {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
}
.steps {
  list-style: none;
  margin: 0;
  padding: 14px;
  border-radius: 18px;
  background: var(--ground);
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.n {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  background: var(--card);
  color: var(--ink);
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.steps-text {
  padding: 14px;
  border-radius: 18px;
  background: var(--ground);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
}
strong {
  color: var(--ink);
  font-weight: 900;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}
</style>
