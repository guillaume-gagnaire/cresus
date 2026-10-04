export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();
  const isLogin = to.path === '/login';
  if (!auth.me && !isLogin) return navigateTo('/login');
  if (auth.me && isLogin) return navigateTo('/');
});
