const query = '(min-width: 1024px)';
const isDesktop = ref(typeof window !== 'undefined' ? window.matchMedia(query).matches : true);
let bound = false;

export function useBreakpoint() {
  if (!bound && typeof window !== 'undefined') {
    bound = true;
    const media = window.matchMedia(query);
    // la fenêtre a pu changer de taille entre l’évaluation du module et ce premier appel (démarrage de l’app) : aucun
    // événement n’était encore écouté, la valeur lue plus haut serait restée périmée (barre latérale sur un écran étroit)
    isDesktop.value = media.matches;
    media.addEventListener('change', (e) => { isDesktop.value = e.matches; });
  }
  return { isDesktop };
}
