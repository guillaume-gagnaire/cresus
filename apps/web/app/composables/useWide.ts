const wide = ref(false);
let started = false;

/** Tablette posée sur le comptoir (ou grand écran) : caisse sur 4 colonnes avec une colonne de résumé. */
export function useWide() {
  if (!started && typeof window !== 'undefined') {
    started = true;
    const query = window.matchMedia('(min-width: 900px)');
    wide.value = query.matches;
    query.addEventListener('change', (event) => (wide.value = event.matches));
  }
  return wide;
}
