const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** 250 → « 2,50 € » (fr-FR : espace insécable avant €, espace fine insécable pour les milliers). */
export function formatEuros(cents: number): string {
  return euros.format(cents / 100);
}

/** Prix saisi (« 2,5 », « 2.50 », « 2 € ») → centimes ; vide, négatif, plus de 2 décimales ou au-delà de 999,99 € → null. */
export function parseEuros(input: string): number | null {
  const cleaned = input.replace(/€/g, '').replace(/\s+/g, '').replace(',', '.');
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
