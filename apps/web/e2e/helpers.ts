import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'kermesse2027';

/** Typographie française des montants : « 7,50 € » avec une espace insécable. */
export const euros = (text: string): string => text.replace(/ €/g, '\u00a0€');

/** Asso neuve et isolée, connectée dans la page ; renvoie son email. */
export async function freshAccount(page: Page, name = 'APE Jules Ferry'): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@cresus.test`;
  const res = await page.request.post('/api/auth/signup', { data: { name, email, password: PASSWORD } });
  expect(res.ok(), `signup ${res.status()}`).toBe(true);
  return email;
}

/** Évènement avec ses articles (nom, prix en centimes), créé par l'API ; renvoie les identifiants. */
export async function eventWithArticles(page: Page, articles: Array<[string, number]>, name = 'Kermesse 2027', date = '2026-06-20') {
  const event = await (await page.request.post('/api/events', { data: { name, date } })).json();
  const ids: string[] = [];
  for (const [articleName, priceCents] of articles) {
    const article = await (await page.request.post(`/api/events/${event.id}/articles`, { data: { name: articleName, priceCents } })).json();
    ids.push(article.id);
  }
  return { eventId: event.id as string, articleIds: ids };
}
