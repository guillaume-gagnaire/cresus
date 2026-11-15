import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { LiveJoinAck, PresenceDto, SummaryDto } from '@cresus/shared';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, agentFor, eventWithArticles, resetDb, setupTestApp } from './helpers.js';

/** Inscrit une asso et renvoie l'agent HTTP et son cookie de session (pour le socket). */
async function account(app: NestExpressApplication, email: string): Promise<{ agent: Agent; cookie: string }> {
  const agent = agentFor(app);
  const res = await agent.post('/api/auth/signup').send({ name: `APE ${email}`, email, password: 'kermesse2027' }).expect(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  return { agent, cookie };
}

function once<T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`pas de « ${event} » reçu`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('temps réel (socket.io)', () => {
  let app: NestExpressApplication;
  let url: string;
  const sockets: Socket[] = [];

  const connect = (cookie?: string, origin?: string): Socket => {
    const headers: Record<string, string> = {};
    if (cookie) headers.cookie = cookie;
    if (origin) headers.origin = origin;
    const socket = io(url, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: headers, reconnection: false, forceNew: true });
    sockets.push(socket);
    return socket;
  };
  const connected = (socket: Socket) => (socket.connected ? Promise.resolve() : once<void>(socket, 'connect'));
  const join = (socket: Socket, eventId: string) => socket.timeout(3000).emitWithAck('join', { eventId }) as Promise<LiveJoinAck>;

  beforeAll(async () => {
    app = await setupTestApp();
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });
  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  it('refuse un appareil sans session', async () => {
    const error = await once<Error>(connect(), 'connect_error');
    expect(error.message).toBe('UNAUTHENTICATED');
  });

  it('refuse une connexion venue d’un autre site', async () => {
    const { cookie } = await account(app, 'ape@ecole.fr');
    const error = await once<Error>(connect(cookie, 'https://pirate.example'), 'connect_error');
    expect(error.message).toBe('FORBIDDEN_ORIGIN');
  });

  it('rejoint la salle d’un évènement de l’asso, pas celle d’une autre asso', async () => {
    const ape = await account(app, 'ape@ecole.fr');
    const { eventId } = await eventWithArticles(ape.agent, [['Crêpe', 250]]);
    const other = await account(app, 'autre@ecole.fr');

    const mine = connect(ape.cookie);
    await connected(mine);
    const ack = await join(mine, eventId);
    expect(ack).toMatchObject({ ok: true, devices: 1, summary: { eventId, salesCount: 0 } });

    const intruder = connect(other.cookie);
    await connected(intruder);
    expect(await join(intruder, eventId)).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await join(intruder, 'pas-un-uuid')).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('diffuse les compteurs à tous les appareils de l’évènement après chaque envoi', async () => {
    const ape = await account(app, 'ape@ecole.fr');
    const { eventId, articleIds } = await eventWithArticles(ape.agent, [['Crêpe', 250]]);
    const phoneA = connect(ape.cookie);
    const phoneB = connect(ape.cookie);
    await Promise.all([connected(phoneA), connected(phoneB)]);
    await join(phoneA, eventId);
    await join(phoneB, eventId);

    const other = await account(app, 'autre@ecole.fr');
    const otherEvent = await eventWithArticles(other.agent, [['Gaufre', 300]]);
    const stranger = connect(other.cookie);
    await connected(stranger);
    await join(stranger, otherEvent.eventId);
    let strangerSaw = false;
    stranger.on('summary', () => {
      strangerSaw = true;
    });

    const gotA = once<SummaryDto>(phoneA, 'summary');
    const gotB = once<SummaryDto>(phoneB, 'summary');
    await ape.agent
      .post(`/api/events/${eventId}/sync`)
      .send({ ops: [{ op: 'sale', id: randomUUID(), articleId: articleIds[0], priceCents: 250, soldAt: new Date().toISOString() }] })
      .expect(200);
    expect((await gotA).salesCount).toBe(1);
    expect((await gotB).revenueCents).toBe(250);
    expect(strangerSaw).toBe(false);
  });

  it('compte les appareils connectés à l’évènement', async () => {
    const ape = await account(app, 'ape@ecole.fr');
    const { eventId } = await eventWithArticles(ape.agent, [['Crêpe', 250]]);
    const phoneA = connect(ape.cookie);
    await connected(phoneA);
    await join(phoneA, eventId);

    const more = once<PresenceDto>(phoneA, 'presence');
    const phoneB = connect(ape.cookie);
    await connected(phoneB);
    expect(await join(phoneB, eventId)).toMatchObject({ ok: true, devices: 2 });
    expect(await more).toEqual({ eventId, devices: 2 });

    const fewer = once<PresenceDto>(phoneA, 'presence');
    phoneB.disconnect();
    expect(await fewer).toEqual({ eventId, devices: 1 });
  });

  it('prévient les appareils quand les articles ou l’évènement changent', async () => {
    const ape = await account(app, 'ape@ecole.fr');
    const { eventId } = await eventWithArticles(ape.agent, [['Crêpe', 250]]);
    const phone = connect(ape.cookie);
    await connected(phone);
    await join(phone, eventId);

    const added = once<{ eventId: string }>(phone, 'changed');
    await ape.agent.post(`/api/events/${eventId}/articles`).send({ name: 'Soda', priceCents: 150 }).expect(201);
    expect(await added).toEqual({ eventId });

    const renamed = once<{ eventId: string }>(phone, 'changed');
    await ape.agent.patch(`/api/events/${eventId}`).send({ name: 'Fête' }).expect(200);
    expect(await renamed).toEqual({ eventId });
  });

  it('reste joignable en HTTP pendant ce temps', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});
