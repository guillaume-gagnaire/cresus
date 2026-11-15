import type { AccountDto } from '@cresus/shared';
import { defineStore } from 'pinia';
import { api, ApiError, UNAUTHENTICATED_EVENT } from '~/utils/api';
import { readJson, STORAGE, writeJson } from '~/utils/storage';

const KEEP_ALIVE_MS = 5 * 60 * 1000;

/**
 * Le compte de l'asso connecté. Il est gardé sur l'appareil pour que la caisse s'ouvre hors ligne : sans réseau au
 * démarrage, on reprend le dernier compte connu ; seule une réponse 401 du serveur déconnecte.
 */
export const useAuthStore = defineStore('auth', () => {
  const account = ref<AccountDto | null>(readJson<AccountDto | null>(STORAGE.account, null));
  const ready = ref(false);
  let initPromise: Promise<void> | null = null;

  function set(next: AccountDto | null): void {
    account.value = next;
    writeJson(STORAGE.account, next);
  }

  /**
   * La session dure 24 h et le serveur la prolonge à chaque usage (au plus toutes les 5 minutes) : tant que l'appli est
   * ouverte et visible, on la rappelle toutes les 5 minutes, et dès qu'on y revient. Un refus est géré ailleurs
   * (la caisse affiche « Reconnexion », les autres écrans renvoient à la connexion à la prochaine action).
   */
  function keepAlive(): void {
    const ping = () => {
      if (account.value && document.visibilityState === 'visible') void api.get('/auth/me', { quiet401: true }).catch(() => undefined);
    };
    setInterval(ping, KEEP_ALIVE_MS);
    document.addEventListener('visibilitychange', ping);
  }

  async function init(): Promise<void> {
    initPromise ??= (async () => {
      keepAlive();
      window.addEventListener(UNAUTHENTICATED_EVENT, () => {
        if (!account.value) return;
        set(null);
        void navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } });
      });
      try {
        set(await api.get<AccountDto>('/auth/me'));
      } catch (error) {
        if (error instanceof ApiError && !error.offline) set(null);
      } finally {
        ready.value = true;
      }
    })();
    return initPromise;
  }

  async function login(email: string, password: string): Promise<void> {
    set(await api.post<AccountDto>('/auth/login', { email, password }));
  }

  async function signup(name: string, email: string, password: string): Promise<void> {
    set(await api.post<AccountDto>('/auth/signup', { name, email, password }));
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      set(null);
    }
  }

  async function rename(name: string): Promise<void> {
    set(await api.patch<AccountDto>('/account', { name }));
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/account/password', { currentPassword, newPassword });
  }

  async function deleteAccount(password: string): Promise<void> {
    await api.del('/account', { password });
    set(null);
  }

  /** Session refusée par le serveur pendant la caisse : on oublie le compte localement (les ventes en attente restent). */
  function expire(): void {
    set(null);
  }

  return { account, ready, init, login, signup, logout, rename, changePassword, deleteAccount, expire };
});
