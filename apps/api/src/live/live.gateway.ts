import type { IncomingHttpHeaders } from 'node:http';
import { Inject } from '@nestjs/common';
import { ConnectedSocket, MessageBody, type OnGatewayDisconnect, type OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { LIVE_PATH, type LiveJoinAck } from '@cresus/shared';
import type { Server, Socket } from 'socket.io';
import { SESSION_COOKIE } from '../auth/cookies.js';
import { SessionService } from '../auth/session.service.js';
import { type AppConfig, CONFIG } from '../config.js';
import { EventsService } from '../events/events.service.js';
import { SummaryService } from '../events/summary.service.js';
import { LiveBus, roomOf } from './live.bus.js';

interface LiveData {
  accountId: string;
  eventId?: string;
}

export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Un socket ne s'ouvre que depuis le site lui-même (même hôte que la requête) : une page d'un autre site ne peut pas
 * écouter les ventes d'une asso avec son cookie. Sans en-tête Origin (client hors navigateur), seule la session compte.
 * Hors production, les origines locales sont admises (le serveur Nuxt de dev relaie vers l'API sur un autre port).
 */
export function originAllowed(headers: IncomingHttpHeaders, production: boolean): boolean {
  const origin = headers.origin;
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.host === headers.host) return true;
  return !production && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
}

/** Temps réel : une salle par évènement ; compteurs, changements et nombre d'appareils diffusés à la salle. */
@WebSocketGateway({ path: LIVE_PATH, serveClient: false })
export class LiveGateway implements OnGatewayInit, OnGatewayDisconnect {
  constructor(
    private readonly bus: LiveBus,
    private readonly sessions: SessionService,
    private readonly events: EventsService,
    private readonly summaries: SummaryService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  afterInit(server: Server): void {
    this.bus.server = server;
    server.use((socket, next) => {
      void (async () => {
        if (!originAllowed(socket.request.headers, this.config.nodeEnv === 'production')) return next(new Error('FORBIDDEN_ORIGIN'));
        const token = readCookie(socket.request.headers.cookie, SESSION_COOKIE);
        const session = token ? await this.sessions.validate(token) : null;
        if (!session) return next(new Error('UNAUTHENTICATED'));
        (socket.data as LiveData) = { accountId: session.accountId };
        next();
      })().catch(() => next(new Error('UNAVAILABLE')));
    });
  }

  @SubscribeMessage('join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<LiveJoinAck> {
    const data = socket.data as LiveData;
    const eventId = typeof (body as { eventId?: unknown } | null)?.eventId === 'string' ? (body as { eventId: string }).eventId : '';
    let event;
    try {
      event = await this.events.requireEvent(data.accountId, eventId);
    } catch {
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (data.eventId && data.eventId !== event.id) await this.leaveRoom(socket);
    await socket.join(roomOf(event.id));
    data.eventId = event.id;
    const devices = this.bus.devices(event.id);
    socket.to(roomOf(event.id)).emit('presence', { eventId: event.id, devices });
    return { ok: true, summary: await this.summaries.summary(event.id), devices };
  }

  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() socket: Socket): Promise<{ ok: true }> {
    await this.leaveRoom(socket);
    return { ok: true };
  }

  handleDisconnect(socket: Socket): void {
    const { eventId } = socket.data as LiveData;
    if (eventId) this.bus.server?.to(roomOf(eventId)).emit('presence', { eventId, devices: this.bus.devices(eventId) });
  }

  private async leaveRoom(socket: Socket): Promise<void> {
    const data = socket.data as LiveData;
    if (!data.eventId) return;
    const eventId = data.eventId;
    await socket.leave(roomOf(eventId));
    data.eventId = undefined;
    this.bus.server?.to(roomOf(eventId)).emit('presence', { eventId, devices: this.bus.devices(eventId) });
  }
}
