import { type ArticleDto, type EventDetailDto, LIVE_PATH, type LiveJoinAck, LIMITS, type PresenceDto, type SummaryDto, type SyncResponse } from '@cresus/shared';
import { defineStore } from 'pinia';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '~/stores/auth';
import { api, ApiError } from '~/utils/api';
import { applyPending, cacheKey, type QueuedOp, queueKey, type SaleRef, saleOp, toSyncOps, undoSale, voidOp } from '~/utils/sale-queue';
import { readJson, writeJson } from '~/utils/storage';

export type SyncState = 'ok' | 'offline' | 'auth';

export interface LastSale extends SaleRef {
  name: string;
  saleNo: number;
  at: number;
}

const SEND_DELAY_MS = 300;
const RETRY_MS = 10_000;

/**
 * La caisse ouverte : détail de l'évènement (gardé sur l'appareil), file des ventes (par compte), envoi au serveur et
 * temps réel. Les compteurs affichés sont ceux du serveur plus les ventes en attente : rien ne se perd hors ligne.
 */
export const useCaisseStore = defineStore('caisse', () => {
  const auth = useAuthStore();
  const toast = useToast();

  const eventId = ref<string | null>(null);
  const detail = ref<EventDetailDto | null>(null);
  const server = ref<SummaryDto | null>(null);
  const ops = ref<QueuedOp[]>([]);
  const state = ref<SyncState>('ok');
  const devices = ref(0);
  const connected = ref(false);
  const lastSale = ref<LastSale | null>(null);
  /** Incrémenté à chaque vente reçue ou faite : la colonne des dernières ventes (tablette) se recharge. */
  const tick = ref(0);

  const inFlight = new Set<string>();
  let flushing: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retry: ReturnType<typeof setInterval> | null = null;
  let socket: Socket | null = null;
  let accountId: string | null = null;

  // la file appartient au compte : elle n'est jamais envoyée sous un autre compte
  watch(
    () => auth.account?.id ?? null,
    (id) => {
      accountId = id;
      ops.value = id ? readJson<QueuedOp[]>(queueKey(id), []) : [];
      if (id && ops.value.length > 0) schedule(0);
    },
    { immediate: true },
  );
  watch(ops, (next) => accountId && writeJson(queueKey(accountId), next), { deep: true });

  // le cache suit les derniers compteurs connus (envoi, temps réel), pas seulement ceux de l'ouverture : hors ligne, un
  // changement d'écran ou un redémarrage de l'appli repart de là
  watch(server, (summary) => {
    const current = detail.value;
    if (summary && current && accountId && summary.eventId === current.event.id) writeJson(cacheKey(accountId, current.event.id), { ...current, summary });
  });

  const articles = computed<ArticleDto[]>(() => (detail.value?.articles ?? []).filter((a) => !a.archived));
  const onSale = computed(() => articles.value.filter((a) => a.onSale));
  const shown = computed<SummaryDto | null>(() => (server.value ? applyPending(server.value, ops.value) : null));
  const pendingCount = computed(() => ops.value.filter((op) => op.eventId === eventId.value).length);
  const countOf = (articleId: string): number => shown.value?.articles.find((a) => a.articleId === articleId)?.count ?? 0;

  function setDetail(next: EventDetailDto): void {
    detail.value = next;
    if (flushing !== next.event.id) server.value = next.summary;
    if (accountId) writeJson(cacheKey(accountId, next.event.id), next);
  }

  async function refresh(): Promise<void> {
    if (!eventId.value) return;
    try {
      setDetail(await api.get<EventDetailDto>(`/events/${eventId.value}`, { quiet401: true }));
      if (state.value === 'offline') state.value = 'ok';
    } catch (error) {
      handleError(eventId.value, error);
    }
  }

  /**
   * Ouvre la caisse d'un évènement : d'abord ce que l'appareil sait (en mémoire si on revient d'un autre écran du même
   * évènement, sinon le cache), puis le serveur et le temps réel.
   */
  async function open(id: string): Promise<void> {
    eventId.value = id;
    lastSale.value = null;
    if (detail.value?.event.id !== id) {
      const cached = accountId ? readJson<EventDetailDto | null>(cacheKey(accountId, id), null) : null;
      detail.value = cached;
      server.value = cached?.summary ?? null;
    }
    connectLive();
    retry ??= setInterval(() => {
      if (ops.value.length > 0) void flush();
      else if (!connected.value) void refresh();
    }, RETRY_MS);
    await refresh();
    await flush();
  }

  function close(): void {
    socket?.emit('leave');
    eventId.value = null;
    devices.value = 0;
  }

  function sell(article: ArticleDto): void {
    if (!eventId.value) return;
    const op = saleOp(eventId.value, article, crypto.randomUUID(), new Date().toISOString());
    ops.value = [...ops.value, op];
    lastSale.value = { eventId: eventId.value, id: op.id, articleId: article.id, priceCents: article.priceCents, name: article.name, saleNo: shown.value?.salesCount ?? 0, at: Date.now() };
    tick.value++;
    navigator.vibrate?.(15);
    schedule(SEND_DELAY_MS);
  }

  /** « Annuler » du bandeau : retire la dernière vente de ce téléphone. */
  function undoLast(): void {
    const sale = lastSale.value;
    if (!sale) return;
    ops.value = undoSale(ops.value, sale, inFlight);
    lastSale.value = null;
    schedule(0);
  }

  /** Suppression depuis l'historique (vente de n'importe quel téléphone, déjà reçue par le serveur). */
  async function voidSale(sale: SaleRef): Promise<void> {
    ops.value = [...ops.value, voidOp(sale)];
    await flush();
  }

  function schedule(ms: number): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), ms);
  }

  function handleError(id: string, error: unknown): void {
    if (!(error instanceof ApiError)) return;
    if (error.offline) state.value = 'offline';
    else if (error.status === 401) state.value = 'auth';
    else if (error.status === 404 && error.code === 'NOT_FOUND') {
      // évènement supprimé (depuis un autre appareil) : ses ventes en attente ne pourront jamais partir
      ops.value = ops.value.filter((op) => op.eventId !== id);
      if (eventId.value === id) {
        toast.error('Cet évènement n’existe plus.');
        void navigateTo('/');
      }
    }
  }

  /** Envoie la file, évènement par évènement, par lots ; un seul envoi à la fois. */
  async function flush(): Promise<void> {
    if (flushing || !accountId) return;
    const account = accountId;
    while (ops.value.length > 0 && accountId === account) {
      const target = ops.value.some((op) => op.eventId === eventId.value) ? eventId.value! : ops.value[0]!.eventId;
      const batch = ops.value.filter((op) => op.eventId === target).slice(0, LIMITS.syncBatch);
      flushing = target;
      for (const op of batch) inFlight.add(op.id);
      try {
        const res = await api.post<SyncResponse>(`/events/${target}/sync`, { ops: toSyncOps(batch) }, { quiet401: true });
        // ne retirer les ventes de la file que sur une vraie réponse de l'API
        if (!res?.summary) throw new ApiError(0, 'OFFLINE', 'Réponse inattendue du serveur.');
        const sent = new Set(batch);
        ops.value = ops.value.filter((op) => !sent.has(op));
        if (target === eventId.value) server.value = res.summary;
        state.value = 'ok';
      } catch (error) {
        handleError(target, error);
        if (!(error instanceof ApiError && error.status === 404)) break;
      } finally {
        inFlight.clear();
        flushing = null;
      }
    }
  }

  function connectLive(): void {
    if (socket) {
      if (socket.connected && eventId.value) join();
      return;
    }
    socket = io({ path: LIVE_PATH, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      connected.value = true;
      join();
      if (ops.value.length > 0) void flush();
    });
    socket.on('disconnect', () => {
      connected.value = false;
      devices.value = 0;
    });
    socket.on('summary', (summary: SummaryDto) => {
      // pendant notre propre envoi, la réponse HTTP fait foi (évite de compter deux fois nos ventes en vol)
      if (summary.eventId !== eventId.value || flushing === summary.eventId) return;
      server.value = summary;
      tick.value++;
    });
    socket.on('changed', ({ eventId: changed }: { eventId: string }) => {
      if (changed === eventId.value) void refresh();
    });
    socket.on('presence', (presence: PresenceDto) => {
      if (presence.eventId === eventId.value) devices.value = presence.devices;
    });
  }

  function join(): void {
    const id = eventId.value;
    if (!socket || !id) return;
    socket.emit('join', { eventId: id }, (ack: LiveJoinAck) => {
      if (!ack.ok || eventId.value !== id) return;
      devices.value = ack.devices;
      if (flushing !== id) server.value = ack.summary;
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => schedule(0));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && eventId.value) {
        if (ops.value.length > 0) schedule(0);
        else void refresh();
      }
    });
  }

  return { eventId, detail, articles, onSale, shown, ops, state, devices, connected, lastSale, tick, pendingCount, countOf, open, close, refresh, sell, undoLast, voidSale, flush };
});
