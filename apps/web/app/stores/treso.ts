import {
  type BalanceSnapshotDto, type Cents, type Client, type ClientInput, type ClientPatch, type ChargeInput, type ChargePatch,
  cycleWeekday as engineCycleWeekday, type EngineInput, groupLeaves, type ISODate, type LeaveDto, type LeavesInput,
  leavesCost, type LeaveTarget, localToday, matchesTarget, monthKey, monthResults, type ProfilePatch, type RateInput,
  resultsSummary, type StateDto, type UserProfileDto,
} from '@matreso/engine';
import { defineStore } from 'pinia';

type ChargeDto = StateDto['charges'][number];
const LAST_COMPANY_STATUS = 'matreso:lastCompanyStatus';
const tmpId = () => `tmp-${crypto.randomUUID()}`;
/** Au-delà, les données affichées sont rechargées quand l’app revient au premier plan (PWA reprise après une longue veille). */
const STALE_AFTER_MS = 5 * 60_000;
/** Laisse au navigateur (Safari iOS surtout) le temps de démarrer le téléchargement avant de libérer l’URL du blob. */
const REVOKE_DELAY_MS = 1000;

export const useTresoStore = defineStore('treso', () => {
  const data = ref<StateDto | null>(null);
  const today = ref<ISODate>(localToday());
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** Heure (ms) du dernier chargement réussi de l’état : sert à décider d’un rafraîchissement à la reprise. */
  const loadedAt = ref(0);
  let refreshing = false;
  const toast = useToast();

  const input = computed<EngineInput | null>(() =>
    data.value
      ? { today: today.value, profile: data.value.profile, clients: data.value.clients, leaves: data.value.leaves, charges: data.value.charges, balance: data.value.balance.latest }
      : null,
  );
  const profile = computed<UserProfileDto | null>(() => data.value?.profile ?? null);
  const allClients = computed<Client[]>(() => data.value?.clients ?? []);
  const clients = computed<Client[]>(() => allClients.value.filter((c) => c.archivedAt === null));
  const clientById = (id: string | null | undefined): Client | undefined => allClients.value.find((c) => c.id === id);
  const isMicro = computed(() => profile.value?.legalStatus === 'MICRO');
  const results = computed(() => (input.value ? monthResults(input.value) : []));
  const summary = computed(() => resultsSummary(results.value));
  const leavePeriods = computed(() => (input.value ? groupLeaves(input.value) : []));
  const currentMonth = computed(() => monthKey(today.value));
  const balance = computed<BalanceSnapshotDto | null>(() => data.value?.balance.latest ?? null);

  function reset(): void {
    data.value = null;
    status.value = 'idle';
    loadedAt.value = 0;
  }

  /** Session expirée en cours d’usage (R22) : on vide les deux stores et on renvoie vers /login, sans recharger. */
  function expireSession(): void {
    const auth = useAuthStore();
    const wasSignedIn = auth.me !== null;
    auth.reset();
    reset();
    if (!wasSignedIn) return; // plusieurs appels en vol : un seul message, une seule navigation
    toast.error('Ta session a expiré, reconnecte-toi.');
    void navigateTo('/login');
  }

  /** Message d’erreur de l’API ; un 401 déclenche plutôt la sortie de session. Renvoie true quand la session a expiré. */
  function fail(e: unknown, fallback: string): boolean {
    if (e instanceof ApiError && e.status === 401) {
      expireSession();
      return true;
    }
    toast.error(e instanceof ApiError ? e.message : fallback);
    return false;
  }

  /**
   * Charge l’état depuis le serveur ; renvoie true s’il a réussi. `quiet` : un échec (réseau, serveur) n’affiche aucun message
   * (rafraîchissement de rattrapage ou à la reprise) ; une session expirée, elle, est toujours signalée.
   */
  async function load(opts: { quiet?: boolean } = {}): Promise<boolean> {
    // Un rechargement de rattrapage garde l’écran en place : seul le tout premier chargement passe par « loading ».
    const refresh = data.value !== null;
    if (!refresh) status.value = 'loading';
    try {
      data.value = await api<StateDto>('/state');
      today.value = localToday();
      loadedAt.value = Date.now();
      status.value = 'ready';
      return true;
    } catch (e) {
      if (!refresh) status.value = 'error';
      if (opts.quiet && !(e instanceof ApiError && e.status === 401)) return false;
      fail(e, 'Impossible de charger tes données.');
      return false;
    }
  }

  /**
   * Reprise de l’app (retour au premier plan, focus) : un jour a passé (« aujourd’hui » et le mois affichés seraient faux) ou
   * les données ont plus de 5 minutes → rechargement discret, l’écran reste en place et un échec réseau ne dit rien.
   */
  async function refreshIfStale(now: number = Date.now()): Promise<void> {
    if (status.value !== 'ready' || refreshing) return;
    if (localToday() === today.value && now - loadedAt.value < STALE_AFTER_MS) return;
    refreshing = true;
    try {
      await load({ quiet: true });
    } finally {
      refreshing = false;
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (status.value === 'idle' || status.value === 'error') await load();
  }

  /**
   * Applique localement, appelle l'API, réconcilie ; en cas d'échec : message, puis rechargement depuis le serveur (sauf session expirée).
   * Hors ligne le rechargement échoue lui aussi : on restaure alors l'état d'avant la modification, qui sinon resterait affichée
   * comme si elle avait été enregistrée.
   */
  async function mutate<T>(apply: (s: StateDto) => void, call: () => Promise<T>, reconcile?: (s: StateDto, res: T) => void): Promise<T | null> {
    if (!data.value) return null;
    // Copie par JSON : l'état est un DTO JSON, et structuredClone échoue sur les proxys réactifs que les réconciliations
    // (ex. `s.leaves = [...s.leaves, …]`) laissent dans les tableaux bruts, même après toRaw.
    const snapshot = JSON.parse(JSON.stringify(data.value)) as StateDto;
    apply(data.value);
    try {
      const res = await call();
      if (reconcile && data.value) reconcile(data.value, res);
      return res;
    } catch (e) {
      if (!fail(e, 'Impossible d’enregistrer. Réessaie.') && !(await load({ quiet: true })) && data.value) data.value = snapshot;
      return null;
    }
  }

  const replaceClient = (s: StateDto, client: Client, oldId = client.id) => {
    const i = s.clients.findIndex((c) => c.id === oldId);
    if (i >= 0) s.clients[i] = client;
    else s.clients.push(client);
  };

  const updateProfile = (patch: ProfilePatch) =>
    mutate((s) => { s.profile = { ...s.profile, ...patch }; }, () => api<UserProfileDto>('/profile', { method: 'PATCH', body: patch }), (s, p) => { s.profile = p; });

  function setCompanyMode(mode: 'COMPANY' | 'MICRO') {
    const current = profile.value?.legalStatus;
    if (mode === 'MICRO') {
      if (current && current !== 'MICRO') localStorage.setItem(LAST_COMPANY_STATUS, current);
      return updateProfile({ legalStatus: 'MICRO' });
    }
    const last = localStorage.getItem(LAST_COMPANY_STATUS) as UserProfileDto['legalStatus'] | null;
    return updateProfile({ legalStatus: last && last !== 'MICRO' ? last : 'SASU' });
  }

  /** La date part du navigateur (R15) : le serveur peut tourner dans un autre fuseau horaire. */
  const setBalance = (amount: Cents) => {
    const date = localToday();
    const optimistic: BalanceSnapshotDto = { id: tmpId(), date, amount };
    return mutate(
      (s) => { s.balance = { latest: optimistic, history: [optimistic, ...s.balance.history] }; },
      () => api<BalanceSnapshotDto>('/balance', { method: 'POST', body: { amount, date } }),
      (s, snap) => { s.balance = { latest: snap, history: [snap, ...s.balance.history.filter((b) => b.id !== optimistic.id)] }; },
    );
  };

  const createClient = async (body: ClientInput): Promise<Client | null> => {
    const id = tmpId();
    const { rate, ...fields } = body;
    return mutate(
      (s) => { s.clients.push({ ...fields, id, archivedAt: null, rates: [rate] }); },
      () => api<Client>('/clients', { method: 'POST', body }),
      (s, created) => replaceClient(s, created, id),
    );
  };

  const updateClient = (id: string, patch: ClientPatch) =>
    mutate(
      (s) => {
        const c = s.clients.find((x) => x.id === id);
        if (!c) return;
        const { archived, ...fields } = patch;
        Object.assign(c, fields);
        if (fields.billingMode === 'FORFAIT') c.weekdays = [];
        if (archived !== undefined) c.archivedAt = archived ? new Date().toISOString() : null;
      },
      () => api<Client>(`/clients/${id}`, { method: 'PATCH', body: patch }),
      (s, updated) => replaceClient(s, updated),
    );

  const deleteClient = (id: string) =>
    mutate(
      (s) => { s.clients = s.clients.filter((c) => c.id !== id); s.leaves = s.leaves.filter((l) => l.clientId !== id); },
      () => api<void>(`/clients/${id}`, { method: 'DELETE' }),
    );

  const addRate = (clientId: string, rate: RateInput) =>
    mutate(
      (s) => {
        const c = s.clients.find((x) => x.id === clientId);
        if (c) c.rates = [...c.rates.filter((r) => r.validFrom !== rate.validFrom), { ...rate, id: tmpId() }];
      },
      () => api<Client>(`/clients/${clientId}/rates`, { method: 'POST', body: rate }),
      (s, updated) => replaceClient(s, updated),
    );

  const deleteRate = (clientId: string, rateId: string) =>
    mutate(
      (s) => {
        const c = s.clients.find((x) => x.id === clientId);
        if (c && c.rates.length > 1) c.rates = c.rates.filter((r) => r.id !== rateId);
      },
      () => api<Client>(`/clients/${clientId}/rates/${rateId}`, { method: 'DELETE' }),
      (s, updated) => replaceClient(s, updated),
    );

  /** `includeProspects` : les pistes comptent-elles dans le coût renvoyé ? Par défaut, comme le profil ; l’écran Calendrier passe son choix local. */
  async function addLeaves(body: LeavesInput, opts: { includeProspects?: boolean } = {}): Promise<{ created: number; cost: Cents } | null> {
    const res = await mutate(
      () => {},
      () => api<{ leaves: LeaveDto[]; created: number }>('/leaves', { method: 'POST', body }),
    );
    if (!res || !data.value) return null;
    const known = new Set(data.value.leaves.map((l) => l.id));
    const fresh = res.leaves.filter((l) => !known.has(l.id));
    data.value.leaves = [...data.value.leaves, ...fresh].sort((a, b) => a.date.localeCompare(b.date));
    return { created: res.created, cost: leavesCost(fresh, data.value.clients, opts.includeProspects ?? data.value.profile.includeProspects) };
  }

  const deleteLeaves = (ids: string[]) =>
    mutate(
      (s) => { s.leaves = s.leaves.filter((l) => !ids.includes(l.id)); },
      () => api<{ deleted: number }>('/leaves/delete', { method: 'POST', body: { ids } }),
    );

  async function toggleLeave(date: ISODate, target: LeaveTarget): Promise<void> {
    const existing = data.value?.leaves.find((l) => l.date === date && matchesTarget(l, target));
    if (existing) {
      await deleteLeaves([existing.id]);
      return;
    }
    const optimistic: LeaveDto = { id: tmpId(), date, scope: target.scope, clientId: target.scope === 'CLIENT' ? target.clientId : null };
    await mutate(
      (s) => { s.leaves.push(optimistic); },
      () => api<{ leaves: LeaveDto[]; created: number }>('/leaves', { method: 'POST', body: { from: date, scope: target.scope, clientId: optimistic.clientId } }),
      (s, res) => { s.leaves = [...s.leaves.filter((l) => l.id !== optimistic.id), ...res.leaves.filter((l) => !s.leaves.some((x) => x.id === l.id))]; },
    );
  }

  async function cycleWeekday(weekday: number): Promise<void> {
    if (!input.value) return;
    for (const patch of engineCycleWeekday(input.value.clients, today.value, weekday)) {
      await updateClient(patch.clientId, { weekdays: patch.weekdays });
    }
  }

  const addCharge = (body: ChargeInput) => {
    const id = tmpId();
    return mutate(
      (s) => { s.charges.push({ ...body, id }); },
      () => api<ChargeDto>('/charges', { method: 'POST', body }),
      (s, created) => { s.charges = s.charges.map((c) => (c.id === id ? created : c)); },
    );
  };

  const updateCharge = (id: string, patch: ChargePatch) =>
    mutate(
      (s) => {
        const c = s.charges.find((x) => x.id === id);
        if (c) Object.assign(c, patch, patch.frequency === 'MONTHLY' ? { month: null } : {});
      },
      () => api<ChargeDto>(`/charges/${id}`, { method: 'PATCH', body: patch }),
      (s, updated) => { s.charges = s.charges.map((c) => (c.id === id ? updated : c)); },
    );

  const deleteCharge = (id: string) =>
    mutate((s) => { s.charges = s.charges.filter((c) => c.id !== id); }, () => api<void>(`/charges/${id}`, { method: 'DELETE' }));

  async function exportData(): Promise<void> {
    let file: unknown;
    try {
      file = await api<unknown>('/export');
    } catch (e) {
      fail(e, 'Export impossible.');
      return;
    }
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ma-treso-${localToday()}.json`;
    a.click();
    // Safari iOS lit le blob après le retour de click() : libérer l’URL tout de suite annulerait le téléchargement
    setTimeout(() => URL.revokeObjectURL(a.href), REVOKE_DELAY_MS);
  }

  async function importData(file: File): Promise<boolean> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error('Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
      return false;
    }
    try {
      data.value = await api<StateDto>('/import', { method: 'POST', body: parsed });
      status.value = 'ready';
      toast.show('Sauvegarde importée.');
      return true;
    } catch (e) {
      fail(e, 'Import impossible.');
      return false;
    }
  }

  return {
    data, today, status, input, profile, allClients, clients, clientById, isMicro, results, summary, leavePeriods, currentMonth, balance,
    load, loadedAt, refreshIfStale, ensureLoaded, reset, updateProfile, setCompanyMode, setBalance, createClient, updateClient, deleteClient, addRate, deleteRate,
    addLeaves, deleteLeaves, toggleLeave, cycleWeekday, addCharge, updateCharge, deleteCharge, exportData, importData,
  };
});
