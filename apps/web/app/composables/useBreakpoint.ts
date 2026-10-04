const query = '(min-width: 1024px)';
const isDesktop = ref(typeof window !== 'undefined' ? window.matchMedia(query).matches : true);
let bound = false;

export function useBreakpoint() {
  if (!bound && typeof window !== 'undefined') {
    bound = true;
    window.matchMedia(query).addEventListener('change', (e) => { isDesktop.value = e.matches; });
  }
  return { isDesktop };
}
