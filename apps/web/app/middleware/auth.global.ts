export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();
  const isLogin = to.path === '/login';
  // Sans session, la page demandée (requête comprise : `/oauth/consent?request=…`) est confiée à `redirect` pour y revenir après connexion.
  if (!auth.me && !isLogin) return navigateTo(to.fullPath === '/' ? '/login' : { path: '/login', query: { redirect: to.fullPath } });
  if (auth.me && isLogin) return navigateTo(safeRedirect(to.query.redirect) ?? '/');
});
