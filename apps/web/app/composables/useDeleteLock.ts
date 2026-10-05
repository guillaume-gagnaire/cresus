/** Durée minimale pendant laquelle les corbeilles restent désactivées après une suppression. */
const DELETE_LOCK_MS = 400;

/**
 * Verrou des corbeilles d’une liste (R33). La suppression est optimiste et revient presque aussitôt, mais la liste se resserre
 * tout de suite : le second clic d’un double appui tomberait sur la corbeille de la ligne suivante, remontée à sa place.
 * `run` n’exécute qu’une suppression à la fois ; `locked` reste vrai jusqu’à la fin de l’appel ET pendant au moins
 * `DELETE_LOCK_MS`, et sert à désactiver toutes les corbeilles.
 */
export function useDeleteLock() {
  const locked = ref(false);

  async function run(deletion: () => Promise<unknown>): Promise<void> {
    if (locked.value) return;
    locked.value = true;
    try {
      await Promise.all([deletion(), new Promise<void>((resolve) => setTimeout(resolve, DELETE_LOCK_MS))]);
    } finally {
      locked.value = false;
    }
  }

  return { locked, run };
}
