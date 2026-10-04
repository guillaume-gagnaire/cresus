import type { MeDto } from '@matreso/engine';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', () => {
  const me = ref<MeDto | null>(null);
  const ready = ref(false);

  async function fetchMe(): Promise<MeDto | null> {
    try {
      me.value = await api<MeDto>('/auth/me');
    } catch {
      me.value = null;
    }
    ready.value = true;
    return me.value;
  }

  async function login(email: string, password: string) {
    me.value = await api<MeDto>('/auth/login', { method: 'POST', body: { email, password } });
  }

  async function register(email: string, password: string, firstName: string) {
    me.value = await api<MeDto>('/auth/register', { method: 'POST', body: { email, password, firstName } });
  }

  async function loginWithPasskey() {
    const optionsJSON = await api<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/auth/passkeys/login/options', { method: 'POST' });
    const response = await startAuthentication({ optionsJSON });
    me.value = await api<MeDto>('/auth/passkeys/login/verify', { method: 'POST', body: response });
  }

  async function enablePasskey() {
    const optionsJSON = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>('/auth/passkeys/register/options', { method: 'POST' });
    const response = await startRegistration({ optionsJSON });
    me.value = await api<MeDto>('/auth/passkeys/register/verify', { method: 'POST', body: response });
  }

  async function disablePasskey() {
    await api('/auth/passkeys', { method: 'DELETE' });
    if (me.value) me.value = { ...me.value, hasPasskey: false };
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    me.value = null;
    useTresoStore().reset();
  }

  async function deleteAccount(password: string) {
    await api('/account', { method: 'DELETE', body: { password } });
    me.value = null;
    useTresoStore().reset();
  }

  return { me, ready, fetchMe, login, register, loginWithPasskey, enablePasskey, disablePasskey, changePassword, logout, deleteAccount };
});
