import { readJson, STORAGE, writeJson } from '~/utils/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'prompt' | 'ios' | 'manual';

const deferred = shallowRef<BeforeInstallPromptEvent | null>(null);
const installed = ref(false);
const dismissed = ref(false);
/** Fenêtre d'invitation ouverte (au premier lancement, ou depuis le bouton de la page de connexion). */
const dialogOpen = ref(false);
let started = false;

function standalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Installation de la PWA. Chrome, Edge et Android donnent un évènement `beforeinstallprompt` (bouton natif) ;
 * Safari sur iPhone n'en a pas : on montre les étapes (Partager › Sur l'écran d'accueil). « Plus tard » est mémorisé ;
 * l'appli est considérée installée quand elle tourne en plein écran (standalone) ou après `appinstalled`.
 */
export function useInstall() {
  if (!started && typeof window !== 'undefined') {
    started = true;
    installed.value = standalone() || readJson<boolean>(STORAGE.installed, false);
    dismissed.value = readJson<boolean>(STORAGE.installDismissed, false);
    // annoncé avant le démarrage de l'appli : capté par le script du <head> (nuxt.config.ts)
    const early = (window as Window & { __cresusInstallPrompt?: BeforeInstallPromptEvent }).__cresusInstallPrompt;
    if (early) {
      deferred.value = early;
      installed.value = standalone();
    }
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferred.value = event as BeforeInstallPromptEvent;
      // le navigateur propose l'installation : elle n'a donc pas (ou plus) eu lieu sur cet appareil
      installed.value = standalone();
      writeJson(STORAGE.installed, installed.value || null);
    });
    window.addEventListener('appinstalled', () => {
      installed.value = true;
      deferred.value = null;
      writeJson(STORAGE.installed, true);
    });
  }

  const mode = computed<InstallMode>(() => (deferred.value ? 'prompt' : isIos() ? 'ios' : 'manual'));

  /** Ouvre la fenêtre native d'installation quand le navigateur la fournit ; renvoie true si l'appli a été installée. */
  async function install(): Promise<boolean> {
    const event = deferred.value;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred.value = null;
    if (outcome === 'accepted') {
      installed.value = true;
      writeJson(STORAGE.installed, true);
    }
    return outcome === 'accepted';
  }

  function dismiss(): void {
    dismissed.value = true;
    dialogOpen.value = false;
    writeJson(STORAGE.installDismissed, true);
  }

  /** Bouton « Installer l'appli » : fenêtre native si le navigateur la fournit, sinon les étapes à suivre. */
  async function start(): Promise<void> {
    if (mode.value === 'prompt') await install();
    else dialogOpen.value = true;
  }

  return { installed: readonly(installed), dismissed: readonly(dismissed), dialogOpen, mode, install, dismiss, start };
}
