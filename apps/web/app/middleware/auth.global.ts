import { useAuthStore } from '~/stores/auth';

/** Pages réservées à une asso connectée ; /admin réservé à l'administrateur ; /login renvoie vers l'accueil si connecté. */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.init();
  if (to.path === '/login') return auth.account ? navigateTo(String(to.query.redirect ?? '/')) : undefined;
  if (!auth.account) return navigateTo({ path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } });
  if (to.path.startsWith('/admin') && !auth.account.isAdmin) return navigateTo('/');
  return undefined;
});
