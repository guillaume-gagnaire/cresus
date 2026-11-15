const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
let listening = false;

/** Réseau du navigateur (indicatif : la vérité est la réponse du serveur). */
export function useOnline() {
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('online', () => (online.value = true));
    window.addEventListener('offline', () => (online.value = false));
  }
  return online;
}
