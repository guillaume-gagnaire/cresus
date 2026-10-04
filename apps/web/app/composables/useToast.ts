export interface Toast { id: number; message: string; tone: 'info' | 'error' }

const toasts = ref<Toast[]>([]);
let seq = 0;

export function useToast() {
  const show = (message: string, tone: Toast['tone'] = 'info') => {
    const id = ++seq;
    toasts.value.push({ id, message, tone });
    setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id); }, 5000);
  };
  return { toasts, show, error: (message: string) => show(message, 'error') };
}
