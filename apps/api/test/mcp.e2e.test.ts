import { demoExportFile } from '@matreso/engine';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/common/app-error.js';
import { toCents, toEuros } from '../src/mcp/money.js';
import { agentFor, issueAccessToken, resetDb, setupTestApp } from './helpers.js';

const TOOLS = [
  'get_overview', 'get_month', 'get_profile', 'update_profile', 'set_balance',
  'list_clients', 'create_client', 'update_client', 'delete_client', 'add_rate', 'delete_rate',
  'list_leaves', 'add_leaves', 'delete_leaves',
  'list_charges', 'create_charge', 'update_charge', 'delete_charge',
  'export_data',
];
const NOT_A_WORKING_DAY = 'Ce jour n’est pas ouvré';
const creds = { email: 'guillaume@example.com', password: 'motdepasse1', firstName: 'Guillaume' };

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structuredContent?: Record<string, any>;
}

describe('toCents / toEuros', () => {
  it('rounds to the nearest cent, without binary floating-point surprises', () => {
    expect(toCents(600)).toBe(60_000);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(-1234.565)).toBe(-123_457);
    expect(toCents(-0.001)).toBe(0);
    expect(Object.is(toCents(-0.001), 0)).toBe(true);
    expect(toEuros(46_006)).toBe(460.06);
    expect(toEuros(-231_400)).toBe(-2314);
  });

  it('refuses values that are not finite (or too large to be exact)', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e307, '12' as unknown as number]) {
      expect(() => toCents(bad), String(bad)).toThrow(AppError);
    }
  });
});

describe('MCP server (Streamable HTTP, stateless)', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  const clients: Client[] = [];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await setupTestApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await resetDb(app);
    // la date du jour est celle du serveur : figée sur celle de la démo (seule Date est simulée, les minuteries et le réseau restent réels)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T10:00:00'));
  });
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
    vi.useRealTimers();
  });
  afterAll(async () => { await app.close(); });

  /** Nouvel utilisateur avec les données de la démo, et un jeton d'accès OAuth à son nom. */
  const signUp = async (email = creds.email) => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ ...creds, email }).expect(201);
    await agent.post('/api/import').send(demoExportFile()).expect(201);
    return { agent, token: await issueAccessToken(app, agent) };
  };
  const connect = async (token: string): Promise<Client> => {
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    clients.push(client);
    return client;
  };
  const connectedUser = async (email?: string) => connect((await signUp(email)).token);
  const call = (client: Client, name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args }) as Promise<ToolResult>;
  /** Appel qui doit réussir : renvoie la sortie structurée. */
  const ok = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
    const result = await call(client, name, args);
    expect(result.isError, result.content[0]?.text).toBeFalsy();
    expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);
    return result.structuredContent!;
  };
  /** Appel qui doit échouer : renvoie le message d'erreur. */
  const fails = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
    const result = await call(client, name, args);
    expect(result.isError, JSON.stringify(result)).toBe(true);
    return result.content[0]!.text;
  };

  describe('protection par jeton Bearer', () => {
    const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1.0.0' } } };
    const MCP_HEADERS = { Accept: 'application/json, text/event-stream' };

    it('answers 401 with a resource_metadata hint when there is no token', async () => {
      const res = await http().post('/mcp').set(MCP_HEADERS).send(initialize).expect(401);
      const challenge = res.headers['www-authenticate'] as string;
      expect(challenge).toMatch(/^Bearer /);
      expect(challenge).toContain('resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"');
      expect(challenge).toContain('scope="cresus"');
      expect(res.body.error).toBe('invalid_token');
      // l'URL annoncée existe bel et bien
      await http().get('/.well-known/oauth-protected-resource/mcp').expect(200);
    });

    it('answers 401 for an unknown token, and for another authorization scheme', async () => {
      const unknown = await http().post('/mcp').set(MCP_HEADERS).set('Authorization', 'Bearer nope').send(initialize).expect(401);
      expect(unknown.headers['www-authenticate']).toContain('error="invalid_token"');
      await http().post('/mcp').set(MCP_HEADERS).set('Authorization', 'Basic abc').send(initialize).expect(401);
    });

    it('does not read the body of an anonymous request', async () => {
      // le jeton est vérifié avant l'analyse du corps : un corps invalide ou énorme reçoit 401, pas 400 ni 413
      await http().post('/mcp').set('Content-Type', 'application/json').send('{ pas du json').expect(401);
      await http().post('/mcp').set('Content-Type', 'application/json').send(JSON.stringify({ filler: 'x'.repeat(2 * 1024 * 1024) })).expect(401);
    });

    it('accepts a valid token, and is stateless (no session identifier)', async () => {
      const { token } = await signUp();
      const res = await http().post('/mcp').set(MCP_HEADERS).set('Authorization', `Bearer ${token}`).send(initialize).expect(200);
      expect(res.headers['mcp-session-id']).toBeUndefined();
      expect(res.text).toContain('"name":"ma-treso"');
      expect(res.text).toMatch(/"version":"\d+\.\d+\.\d+/);
    });

    it('answers 405 to GET and DELETE (no server-initiated stream in stateless mode), after authentication', async () => {
      await http().get('/mcp').set('Accept', 'text/event-stream').expect(401);
      await http().delete('/mcp').expect(401);
      const { token } = await signUp();
      for (const method of ['get', 'delete'] as const) {
        const res = await http()[method]('/mcp').set('Accept', 'text/event-stream').set('Authorization', `Bearer ${token}`).expect(405);
        expect(res.headers.allow).toBe('POST');
        expect(res.body.error.message).toMatch(/Method not allowed/i);
      }
    });

    it('answers a JSON-RPC error to a malformed body, and rejects an oversized one', async () => {
      const { token } = await signUp();
      const authed = () => http().post('/mcp').set(MCP_HEADERS).set('Authorization', `Bearer ${token}`).set('Content-Type', 'application/json');
      const malformed = await authed().send('{ pas du json').expect(400);
      expect(malformed.body).toMatchObject({ jsonrpc: '2.0', error: { code: -32700 }, id: null });
      const tooLarge = await authed().send(JSON.stringify({ filler: 'x'.repeat(2 * 1024 * 1024) })).expect(413);
      expect(tooLarge.body).toMatchObject({ jsonrpc: '2.0', id: null });
    });

    it('only serves /mcp itself', async () => {
      const { token } = await signUp();
      await http().post('/mcp/other').set(MCP_HEADERS).set('Authorization', `Bearer ${token}`).send(initialize).expect(404);
    });
  });

  it('lists the 19 tools, each with a French description and an object input schema', async () => {
    const client = await connectedUser();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOLS].sort());
    // les outils qui portent des montants disent à quelle unité (export_data, lui, rend le fichier de sauvegarde en centimes)
    const withAmounts = ['get_overview', 'get_month', 'get_profile', 'update_profile', 'set_balance', 'list_clients', 'create_client', 'add_rate', 'list_leaves', 'list_charges', 'create_charge', 'update_charge'];
    for (const tool of tools) {
      expect(tool.description!.length, tool.name).toBeGreaterThan(40);
      expect(tool.inputSchema.type, tool.name).toBe('object');
      expect(tool.annotations?.title, tool.name).toEqual(expect.any(String));
      if (withAmounts.includes(tool.name)) expect(tool.description, tool.name).toMatch(/euros/);
    }
    expect(tools.find((t) => t.name === 'export_data')!.description).toMatch(/CENTIMES/);
    for (const name of ['get_overview', 'get_month', 'get_profile', 'list_clients', 'list_leaves', 'list_charges', 'export_data']) {
      expect(tools.find((t) => t.name === name)!.annotations?.readOnlyHint, name).toBe(true);
    }
    for (const name of ['delete_client', 'delete_rate', 'delete_leaves', 'delete_charge']) {
      expect(tools.find((t) => t.name === name)!.annotations?.destructiveHint, name).toBe(true);
    }
    const amountOf = (name: string, field: string) => (tools.find((t) => t.name === name)!.inputSchema.properties as Record<string, { description?: string }>)[field]?.description;
    expect(amountOf('set_balance', 'amount')).toMatch(/euros/);
    expect(amountOf('create_charge', 'amount')).toMatch(/euros/);
    expect(client.getInstructions()).toMatch(/euros/);
  });

  describe('get_overview', () => {
    it('projects the next 15 months, in euros, from the server date', async () => {
      const client = await connectedUser();
      const overview = await ok(client, 'get_overview');
      expect(overview).toMatchObject({ today: '2026-10-04', balance: 48_320, balanceDate: '2026-10-04', mode: 'societe' });
      expect(overview.months).toHaveLength(15);
      expect(overview.months[0]).toMatchObject({ month: '2026-10', result: -2314, balance: 46_006, state: 'RED' });
      expect(Object.keys(overview.months[0]).sort()).toEqual(['balance', 'charges', 'income', 'incomeWithoutLeaves', 'month', 'result', 'state']);
      expect(overview.months[14].month).toBe('2027-12');
      expect(overview.micro).toBeUndefined();
      expect(overview.summary).toMatchObject({ redCount: expect.any(Number), overdraftCount: 0, text: expect.any(String), lowestBalanceMonth: expect.any(String) });
      expect(overview.summary.lowestBalance).toBe(Math.min(...overview.months.map((m: { balance: number }) => m.balance)));
    });

    it('can count the prospects', async () => {
      const client = await connectedUser();
      const total = (overview: Record<string, any>) => overview.months.reduce((sum: number, m: { income: number }) => sum + m.income, 0);
      const without = total(await ok(client, 'get_overview'));
      const withProspects = total(await ok(client, 'get_overview', { includeProspects: true }));
      expect(withProspects).toBeGreaterThan(without);
    });

    it('adds the micro-enterprise view (« pour toi », ceiling gauge, smoothed income) in micro mode', async () => {
      const client = await connectedUser();
      await ok(client, 'update_profile', { legalStatus: 'MICRO' });
      const overview = await ok(client, 'get_overview');
      expect(overview.mode).toBe('micro');
      expect(overview.micro.months).toHaveLength(15);
      expect(overview.micro.months[0]).toEqual({ month: '2026-10', income: expect.any(Number), forYou: expect.any(Number) });
      expect(overview.micro.gauge).toEqual({
        year: 2026, total: 70_900, ceiling: 83_600, pct: 85, level: 'OK', overMonth: null, vatMonth: '2026-10',
      });
      expect(overview.micro.smoothedAverage).toEqual(expect.any(Number));
    });
  });

  describe('get_month', () => {
    it('details a month dans le rouge à cause des congés', async () => {
      const client = await connectedUser();
      const month = await ok(client, 'get_month', { month: '2027-02' });
      expect(month).toMatchObject({ month: '2027-02', state: 'RED_DUE_TO_LEAVES' });
      expect(month.income).toBeGreaterThan(0);
      expect(month.chargesTotal).toBe(month.charges.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0));
      expect(month.result).toBeCloseTo(month.income - month.chargesTotal, 2);
    });

    it('lists the entries (client, billed month, cash date, amount, leave cost) and the charges', async () => {
      const client = await connectedUser();
      const month = await ok(client, 'get_month', { month: '2026-12' });
      expect(month.entries.length).toBeGreaterThan(0);
      for (const entry of month.entries) {
        expect(entry).toEqual({ client: expect.stringMatching(/^Client [A-D]$/), workMonth: expect.stringMatching(/^\d{4}-\d{2}$/), cashDate: expect.stringMatching(/^2026-12-\d{2}$/), amount: expect.any(Number), leaveCost: expect.any(Number) });
      }
      expect(month.entries.some((e: { leaveCost: number }) => e.leaveCost > 0)).toBe(false);
      for (const charge of month.charges) expect(charge).toEqual({ name: expect.any(String), amount: expect.any(Number), frequency: expect.stringMatching(/^(MONTHLY|YEARLY)$/), computed: expect.any(Boolean) });
      expect(month.charges.find((c: { name: string }) => c.name === 'Salaire (net)')).toMatchObject({ amount: 4000, computed: true });
      expect(month.charges.find((c: { name: string }) => c.name === 'CFE')).toMatchObject({ amount: 600, computed: false });
    });

    it('refuses a month outside the projection horizon, or a malformed one', async () => {
      const client = await connectedUser();
      expect(await fails(client, 'get_month', { month: '2026-09' })).toMatch(/horizon/);
      expect(await fails(client, 'get_month', { month: '2028-01' })).toMatch(/horizon/);
      expect(await fails(client, 'get_month', { month: '2027-13' })).toBe('Mois invalide : utilise le format AAAA-MM.');
      expect(await fails(client, 'get_month', { month: 'octobre' })).toBe('Mois invalide : utilise le format AAAA-MM.');
    });
  });

  describe('profile and balance', () => {
    it('returns the profile without its id, with the role, in euros', async () => {
      const client = await connectedUser();
      const profile = await ok(client, 'get_profile');
      expect(profile).toEqual({
        email: creds.email, role: 'ADMIN', firstName: 'Guillaume', companyName: 'Gagnaire Développement', legalStatus: 'SASU', netPayMonthly: 4000,
        microVersementLiberatoire: false, microIncomeTaxProvisionPct: 10, microProExpensesMonthly: 180, includeProspects: false, alertRedMonth: true, alertLatePayment: true,
      });
    });

    it('changes the legal status: the computed social contributions follow', async () => {
      const client = await connectedUser();
      const updated = await ok(client, 'update_profile', { legalStatus: 'EURL_IS' });
      expect(updated).toMatchObject({ legalStatus: 'EURL_IS', netPayMonthly: 4000 });
      const month = await ok(client, 'get_month', { month: '2026-11' });
      expect(month.charges.find((c: { name: string }) => c.name === 'Cotisations sociales')).toMatchObject({ amount: 1800, computed: true });
    });

    it('takes the amounts in euros, validates them like the API, and never changes the role', async () => {
      const client = await connectedUser();
      const updated = await ok(client, 'update_profile', { netPayMonthly: 3500.5, microProExpensesMonthly: 99.99, alertRedMonth: false });
      expect(updated).toMatchObject({ netPayMonthly: 3500.5, microProExpensesMonthly: 99.99, alertRedMonth: false, role: 'ADMIN' });
      expect(await ok(client, 'update_profile', {})).toMatchObject({ netPayMonthly: 3500.5 });
      expect(await fails(client, 'update_profile', { netPayMonthly: 200_000 })).toBe('Rémunération trop élevée.');
      expect(await fails(client, 'update_profile', { netPayMonthly: -1 })).toBe('Montant invalide.');
      expect(await fails(client, 'update_profile', { firstName: '   ' })).toMatch(/prénom/);
      expect(await fails(client, 'update_profile', { role: 'USER' })).toMatch(/role/);
      expect(await fails(client, 'update_profile', { email: 'x@example.com' })).toMatch(/email/);
      expect((await ok(client, 'get_profile')).role).toBe('ADMIN');
    });

    it('records a new balance, in euros (negative allowed), dated today by default', async () => {
      const client = await connectedUser();
      // l'horloge est figée : le solde de la démo et le nouveau auraient le même created_at, qui départage les soldes d'un même jour
      vi.setSystemTime(new Date('2026-10-04T10:00:05'));
      expect(await ok(client, 'set_balance', { amount: 51_234.56 })).toMatchObject({ amount: 51_234.56, date: '2026-10-04', id: expect.any(String) });
      expect(await ok(client, 'get_overview')).toMatchObject({ balance: 51_234.56, balanceDate: '2026-10-04' });
      expect(await ok(client, 'set_balance', { amount: -120.5, date: '2026-10-03' })).toMatchObject({ amount: -120.5, date: '2026-10-03' });
      expect(await fails(client, 'set_balance', { amount: 10, date: '2026-02-30' })).toBe('Date invalide.');
      // la date du jour est celle (figée) du serveur : le lendemain est dans le futur
      expect(await fails(client, 'set_balance', { amount: 10, date: '2026-10-05' })).toBe('La date du solde ne peut pas être dans le futur.');
      expect(await ok(client, 'set_balance', { amount: 12, date: '2026-10-04' })).toMatchObject({ amount: 12, date: '2026-10-04' });
      expect(await fails(client, 'set_balance', { amount: 2e7 })).toBe('Données invalides.');
    });
  });

  describe('clients and rates', () => {
    it('creates a client from a rate in euros, then lists it', async () => {
      const client = await connectedUser();
      const created = await ok(client, 'create_client', { name: 'Client E', billingMode: 'TJM', weekdays: [0, 1], startDate: '2026-11-02', paymentTerm: 'NET_30', rate: { validFrom: '2026-11-02', amount: 600 } });
      expect(created).toMatchObject({
        name: 'Client E', subtitle: null, color: 'indigo', billingMode: 'TJM', weekdays: [0, 1], startDate: '2026-11-02', endDate: null, paymentTerm: 'NET_30',
        averageDelayDays: 0, isProspect: false, archivedAt: null, rates: [{ validFrom: '2026-11-02', amount: 600 }],
      });
      const listed = await ok(client, 'list_clients');
      expect(listed.clients).toHaveLength(5);
      const found = listed.clients.find((c: { name: string }) => c.name === 'Client E');
      expect(found.id).toBe(created.id);
      expect(found.rates[0].amount).toBe(600);
      // les tarifs de la démo sont en euros eux aussi
      expect(listed.clients.find((c: { name: string }) => c.name === 'Client A').rates.map((r: { amount: number }) => r.amount)).toEqual([650, 700]);
    });

    it('rounds amounts to the cent and applies the API validation rules', async () => {
      const client = await connectedUser();
      const base = { name: 'Client F', billingMode: 'FORFAIT', startDate: '2026-11-02', paymentTerm: 'RECEPTION', weekdays: [2], color: 'teal', subtitle: 'Mission', averageDelayDays: 3, isProspect: true };
      const created = await ok(client, 'create_client', { ...base, rate: { validFrom: '2026-11-02', amount: 1234.565 } });
      expect(created).toMatchObject({ billingMode: 'FORFAIT', weekdays: [], color: 'teal', subtitle: 'Mission', averageDelayDays: 3, isProspect: true });
      expect(created.rates[0].amount).toBe(1234.57);
      expect(await fails(client, 'create_client', { ...base, rate: { validFrom: '2026-11-02', amount: 0 } })).toBe('Le tarif doit être supérieur à 0 €.');
      expect(await fails(client, 'create_client', { ...base, rate: { validFrom: '2026-11-02', amount: -5 } })).toBe('Montant invalide.');
      expect(await fails(client, 'create_client', { ...base, endDate: '2026-10-01', rate: { validFrom: '2026-11-02', amount: 5 } })).toBe('La date de fin doit être après la date de début.');
      expect(await fails(client, 'create_client', { ...base, name: '', rate: { validFrom: '2026-11-02', amount: 5 } })).toContain('Donne un nom à ce client.');
      expect(await fails(client, 'create_client', { ...base, startDate: '2026-13-01', rate: { validFrom: '2026-11-02', amount: 5 } })).toBe('Date invalide.');
      expect(await fails(client, 'create_client', { ...base, rate: { validFrom: '2026-11-02', amount: 5, extra: 1 } })).toMatch(/extra/);
    });

    it('updates a client, archives it, and hides archived clients by default', async () => {
      const client = await connectedUser();
      const { clients: before } = await ok(client, 'list_clients');
      const clientA = before.find((c: { name: string }) => c.name === 'Client A');
      const renamed = await ok(client, 'update_client', { id: clientA.id, name: 'Client A+', paymentTerm: 'NET_60', averageDelayDays: 12 });
      expect(renamed).toMatchObject({ name: 'Client A+', paymentTerm: 'NET_60', averageDelayDays: 12, weekdays: [0, 4] });
      expect(renamed.rates.map((r: { amount: number }) => r.amount)).toEqual([650, 700]);
      expect(await fails(client, 'update_client', { id: clientA.id, endDate: '2026-09-01' })).toBe('La date de fin doit être après la date de début.');
      expect(await ok(client, 'update_client', { id: clientA.id, archived: true })).toMatchObject({ archivedAt: expect.any(String) });
      expect((await ok(client, 'list_clients')).clients.map((c: { name: string }) => c.name)).not.toContain('Client A+');
      expect((await ok(client, 'list_clients', { includeArchived: true })).clients.map((c: { name: string }) => c.name)).toContain('Client A+');
      expect(await ok(client, 'update_client', { id: clientA.id, archived: false })).toMatchObject({ archivedAt: null });
      expect(await fails(client, 'update_client', { id: '00000000-0000-4000-8000-000000000000', name: 'x' })).toBe('Client introuvable.');
      expect(await fails(client, 'update_client', { id: 'pas-un-uuid', name: 'x' })).toBe('Client introuvable.');
    });

    it('adds, replaces and deletes rates, and protects the last one', async () => {
      const client = await connectedUser();
      const { clients: list } = await ok(client, 'list_clients');
      const clientD = list.find((c: { name: string }) => c.name === 'Client D');
      expect(clientD.rates.map((r: { amount: number }) => r.amount)).toEqual([1200, 1350]);
      const added = await ok(client, 'add_rate', { clientId: clientD.id, validFrom: '2027-09-01', amount: 1500.5 });
      expect(added.rates.map((r: { validFrom: string; amount: number }) => [r.validFrom, r.amount])).toEqual([['2026-11-01', 1200], ['2027-04-01', 1350], ['2027-09-01', 1500.5]]);
      // une date existante remplace le tarif
      const replaced = await ok(client, 'add_rate', { clientId: clientD.id, validFrom: '2027-09-01', amount: 1600 });
      expect(replaced.rates).toHaveLength(3);
      expect(replaced.rates[2].amount).toBe(1600);
      expect(await fails(client, 'add_rate', { clientId: clientD.id, validFrom: '2027-09-01', amount: 0 })).toBe('Le tarif doit être supérieur à 0 €.');
      let current = replaced;
      for (const rate of replaced.rates.slice(1)) current = await ok(client, 'delete_rate', { clientId: clientD.id, rateId: rate.id });
      expect(current.rates).toHaveLength(1);
      const lastRate = await call(client, 'delete_rate', { clientId: clientD.id, rateId: current.rates[0].id });
      expect(lastRate.isError).toBe(true);
      expect(lastRate.content[0]!.text).toBe('Un client garde toujours au moins un tarif.');
      expect(lastRate.structuredContent).toEqual({ error: { code: 'LAST_RATE', message: 'Un client garde toujours au moins un tarif.' } });
      expect(await fails(client, 'delete_rate', { clientId: clientD.id, rateId: '00000000-0000-4000-8000-000000000000' })).toBe('Tarif introuvable.');
    });

    it('deletes a client, once', async () => {
      const client = await connectedUser();
      const { clients: list } = await ok(client, 'list_clients');
      const clientB = list.find((c: { name: string }) => c.name === 'Client B');
      expect(await ok(client, 'delete_client', { id: clientB.id })).toEqual({ deleted: true });
      expect((await ok(client, 'list_clients')).clients).toHaveLength(3);
      expect(await fails(client, 'delete_client', { id: clientB.id })).toBe('Client introuvable.');
    });
  });

  describe('leaves', () => {
    it('refuses a leave on a day that is not worked', async () => {
      const client = await connectedUser();
      const message = await fails(client, 'add_leaves', { from: '2026-12-26', scope: 'ALL' });
      expect(message).toContain(NOT_A_WORKING_DAY);
      expect(await fails(client, 'add_leaves', { from: '2026-12-26', to: '2026-12-27', scope: 'ALL' })).toBe('Aucun jour ouvré sur cette période.');
    });

    it('lists the leave periods, with cost and impact months in euros', async () => {
      const client = await connectedUser();
      const { periods } = await ok(client, 'list_leaves');
      expect(periods).toHaveLength(3);
      expect(periods[0]).toEqual({
        from: '2026-12-24', to: '2026-12-31', dayCount: 5, scope: 'ALL', client: null, cost: expect.any(Number), impacts: expect.any(Array), leaveIds: expect.any(Array),
      });
      expect(periods[0].cost).toBeGreaterThan(0);
      expect(periods[0].leaveIds).toHaveLength(5);
      expect(periods[0].impacts.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0)).toBeCloseTo(periods[0].cost, 2);
      expect(periods[0].impacts[0]).toEqual({ cashMonth: expect.stringMatching(/^\d{4}-\d{2}$/), amount: expect.any(Number) });
      expect(periods[1]).toMatchObject({ from: '2027-05-07', to: '2027-05-07', dayCount: 1, scope: 'CLIENT', client: 'Client A' });
    });

    it('adds leaves over a period (working days only), then deletes them', async () => {
      const client = await connectedUser();
      const added = await ok(client, 'add_leaves', { from: '2026-11-02', to: '2026-11-06', scope: 'ALL' });
      expect(added.created).toBe(5);
      expect(added.leaves.map((l: { date: string }) => l.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
      expect(added.leaves[0]).toEqual({ id: expect.any(String), date: '2026-11-02', scope: 'ALL', clientId: null });
      // rejouer la même période ne crée rien
      expect(await ok(client, 'add_leaves', { from: '2026-11-02', to: '2026-11-06', scope: 'ALL' })).toMatchObject({ created: 0 });
      const { periods } = await ok(client, 'list_leaves');
      const period = periods.find((p: { from: string }) => p.from === '2026-11-02');
      expect(period).toMatchObject({ to: '2026-11-06', dayCount: 5 });
      expect(await ok(client, 'delete_leaves', { ids: period.leaveIds })).toEqual({ deleted: 5 });
      expect(await ok(client, 'delete_leaves', { ids: period.leaveIds })).toEqual({ deleted: 0 });
    });

    it('adds a leave for one client, and applies the API validation', async () => {
      const client = await connectedUser();
      const { clients: list } = await ok(client, 'list_clients');
      const clientB = list.find((c: { name: string }) => c.name === 'Client B');
      const added = await ok(client, 'add_leaves', { from: '2026-11-03', scope: 'CLIENT', clientId: clientB.id });
      expect(added).toMatchObject({ created: 1, leaves: [{ date: '2026-11-03', scope: 'CLIENT', clientId: clientB.id }] });
      expect((await ok(client, 'list_leaves')).periods.find((p: { from: string }) => p.from === '2026-11-03')).toMatchObject({ scope: 'CLIENT', client: 'Client B', dayCount: 1 });
      expect(await fails(client, 'add_leaves', { from: '2026-11-03', scope: 'CLIENT' })).toBe('Choisis chez quel client poser ce congé.');
      expect(await fails(client, 'add_leaves', { from: '2026-11-03', scope: 'CLIENT', clientId: '00000000-0000-4000-8000-000000000000' })).toBe('Client introuvable.');
      expect(await fails(client, 'add_leaves', { from: '2026-11-05', to: '2026-11-03', scope: 'ALL' })).toBe('La date de fin doit être après la date de début.');
      expect(await fails(client, 'add_leaves', { from: '2026-11-05', scope: 'EVERYONE' })).toMatch(/scope/);
    });
  });

  describe('charges', () => {
    it('creates, lists, updates and deletes charges, in euros', async () => {
      const client = await connectedUser();
      const { charges: before } = await ok(client, 'list_charges');
      expect(before).toHaveLength(8);
      expect(before.find((c: { name: string }) => c.name === 'Logiciels')).toMatchObject({ amount: 95, frequency: 'MONTHLY', month: null, category: 'Outils' });
      const monthly = await ok(client, 'create_charge', { name: 'Coworking', amount: 189.9, frequency: 'MONTHLY' });
      expect(monthly).toEqual({ id: expect.any(String), name: 'Coworking', amount: 189.9, frequency: 'MONTHLY', month: null, category: null });
      const yearly = await ok(client, 'create_charge', { name: 'Taxe', amount: 450, frequency: 'YEARLY', month: 5, category: 'Impôts' });
      expect(yearly).toMatchObject({ amount: 450, frequency: 'YEARLY', month: 5, category: 'Impôts' });
      expect((await ok(client, 'list_charges')).charges).toHaveLength(10);
      // le mois de juin (index 5) porte la charge annuelle
      const june = await ok(client, 'get_month', { month: '2027-06' });
      expect(june.charges.find((c: { name: string }) => c.name === 'Taxe')).toMatchObject({ amount: 450, frequency: 'YEARLY' });
      const updated = await ok(client, 'update_charge', { id: monthly.id, amount: 200.25, name: 'Coworking Paris' });
      expect(updated).toMatchObject({ id: monthly.id, name: 'Coworking Paris', amount: 200.25, frequency: 'MONTHLY' });
      expect(await ok(client, 'update_charge', { id: yearly.id, frequency: 'MONTHLY' })).toMatchObject({ frequency: 'MONTHLY', month: null });
      expect(await ok(client, 'delete_charge', { id: monthly.id })).toEqual({ deleted: true });
      expect(await ok(client, 'delete_charge', { id: yearly.id })).toEqual({ deleted: true });
      expect((await ok(client, 'list_charges')).charges).toHaveLength(8);
      expect(await fails(client, 'delete_charge', { id: monthly.id })).toBe('Charge introuvable.');
    });

    it('applies the API validation rules', async () => {
      const client = await connectedUser();
      expect(await fails(client, 'create_charge', { name: 'Taxe', amount: 450, frequency: 'YEARLY' })).toBe('Choisis le mois du prélèvement.');
      expect(await fails(client, 'create_charge', { name: '', amount: 10, frequency: 'MONTHLY' })).toContain('Donne un nom à cette charge.');
      expect(await fails(client, 'create_charge', { name: 'Négative', amount: -10, frequency: 'MONTHLY' })).toBe('Montant invalide.');
      expect(await fails(client, 'create_charge', { name: 'Mois', amount: 10, frequency: 'YEARLY', month: 12 })).toMatch(/month/);
      const { charges } = await ok(client, 'list_charges');
      const insurance = charges.find((c: { name: string }) => c.name === 'Assurance RC Pro');
      expect(await fails(client, 'update_charge', { id: insurance.id, month: null })).toBe('Choisis le mois du prélèvement.');
      expect(await fails(client, 'update_charge', { id: '00000000-0000-4000-8000-000000000000', name: 'x' })).toBe('Charge introuvable.');
    });
  });

  describe('export_data', () => {
    it('returns the whole backup file, in the format of the application (amounts in cents, re-importable)', async () => {
      const { agent, token } = await signUp();
      const client = await connect(token);
      const file = await ok(client, 'export_data');
      const { exportedAt: _a, ...exported } = file;
      const { exportedAt: _b, ...demo } = demoExportFile();
      // les références des clients deviennent leurs identifiants à l'export
      const ids = new Map(exported.clients.map((c: { ref: string; name: string }) => [c.name, c.ref]));
      const demoRefs = new Map(demo.clients.map((c) => [c.ref, ids.get(c.name)]));
      const withRefs = { ...demo, clients: demo.clients.map((c) => ({ ...c, ref: demoRefs.get(c.ref) })), leaves: demo.leaves.map((l) => ({ ...l, clientRef: l.clientRef === null ? null : demoRefs.get(l.clientRef) })) };
      expect(exported.clients).toEqual(withRefs.clients);
      expect(exported.leaves).toHaveLength(withRefs.leaves.length);
      expect(exported.profile).toEqual(withRefs.profile);
      expect(exported.balanceSnapshots).toEqual(withRefs.balanceSnapshots);
      const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
      expect([...exported.charges].sort(byName)).toEqual([...withRefs.charges].sort(byName));
      expect(file.balanceSnapshots[0].amount).toBe(4_832_000);
      await agent.post('/api/import').send(file).expect(201);
      const result = await call(client, 'export_data');
      expect(result.isError).toBeFalsy();
    });
  });

  describe('isolation between users', () => {
    it('never shows the clients, charges or leaves of another user', async () => {
      const a = await signUp('a@example.com');
      const b = await signUp('b@example.com');
      const clientA = await connect(a.token);
      const clientB = await connect(b.token);
      const createdByB = await ok(clientB, 'create_client', { name: 'Client secret de B', billingMode: 'TJM', weekdays: [1], startDate: '2026-11-02', paymentTerm: 'NET_30', rate: { validFrom: '2026-11-02', amount: 777 } });
      await ok(clientB, 'create_charge', { name: 'Charge secrète de B', amount: 123, frequency: 'MONTHLY' });
      const addedByB = await ok(clientB, 'add_leaves', { from: '2026-11-03', scope: 'ALL' });

      expect(JSON.stringify(await ok(clientA, 'list_clients'))).not.toContain('Client secret de B');
      expect(JSON.stringify(await ok(clientA, 'list_charges'))).not.toContain('Charge secrète de B');
      expect((await ok(clientA, 'list_leaves')).periods).toHaveLength(3);
      expect((await ok(clientB, 'list_clients')).clients).toHaveLength(5);

      // et ne peut pas y toucher : ces identifiants n'existent pas pour A
      expect(await fails(clientA, 'update_client', { id: createdByB.id, name: 'piraté' })).toBe('Client introuvable.');
      expect(await fails(clientA, 'delete_client', { id: createdByB.id })).toBe('Client introuvable.');
      expect(await fails(clientA, 'add_rate', { clientId: createdByB.id, validFrom: '2026-12-01', amount: 1 })).toBe('Client introuvable.');
      expect(await fails(clientA, 'add_leaves', { from: '2026-11-03', scope: 'CLIENT', clientId: createdByB.id })).toBe('Client introuvable.');
      expect(await ok(clientA, 'delete_leaves', { ids: addedByB.leaves.map((l: { id: string }) => l.id) })).toEqual({ deleted: 0 });
      expect((await ok(clientB, 'list_clients')).clients.find((c: { id: string }) => c.id === createdByB.id)).toMatchObject({ name: 'Client secret de B' });
      expect((await ok(clientB, 'list_leaves')).periods.find((p: { from: string }) => p.from === '2026-11-03')).toMatchObject({ dayCount: 1 });

      // le profil, le solde et l'export sont ceux de A
      await ok(clientA, 'update_profile', { firstName: 'Alice' });
      expect((await ok(clientB, 'get_profile')).firstName).toBe('Guillaume');
      expect((await ok(clientA, 'get_profile')).email).toBe('a@example.com');
      expect((await ok(clientB, 'get_profile')).role).toBe('USER');
      expect((await ok(clientB, 'export_data')).clients).toHaveLength(5);
    });

    it('stops working once the access token has expired', async () => {
      const { token } = await signUp();
      const client = await connect(token);
      expect(await ok(client, 'get_profile')).toMatchObject({ firstName: 'Guillaume' });
      // 2 h plus tard : le jeton d'accès (1 h) a expiré
      vi.setSystemTime(new Date('2026-10-04T12:30:00'));
      await expect(call(client, 'get_profile')).rejects.toThrow();
    });
  });

  it('turns an unexpected failure into a generic, French tool error (no leak)', async () => {
    const client = await connectedUser();
    const state = app.get((await import('../src/data/state.service.js')).StateService);
    vi.spyOn(state, 'getState').mockRejectedValueOnce(new Error('Failed query: select secret from users'));
    const message = await fails(client, 'get_overview');
    expect(message).toBe('Une erreur est survenue. Réessaie dans un instant.');
    vi.restoreAllMocks();
  });
});
