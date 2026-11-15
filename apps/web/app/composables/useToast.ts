export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

const toasts = ref<Toast[]>([]);
let nextId = 1;

/** Messages brefs en haut de l'écran (« Nom enregistré », erreurs). La caisse a son propre bandeau « +1 · Annuler ». */
export function useToast() {
  function show(text: string, tone: Toast['tone'] = 'info', ms = 3500): void {
    const id = nextId++;
    toasts.value = [...toasts.value, { id, text, tone }];
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, ms);
  }
  return { toasts, show, error: (text: string) => show(text, 'error', 5000) };
}
