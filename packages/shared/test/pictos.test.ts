import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FALLBACK_PICTO, PICTOS, matchPicto, normalizeText, pictoCategory, pictoUrl, resolvePicto, searchPictos } from '../src/index.js';

const singular = (word: string) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word);
const phrase = (keyword: string) => normalizeText(keyword).split(' ').map(singular).join(' ');

describe('normalizeText', () => {
  it('retire accents, ligatures, ponctuation et majuscules', () => {
    expect(normalizeText("  Œuf à la COQUE, pomme d'amour !  ")).toBe('oeuf a la coque pomme d amour');
    expect(normalizeText('Hot-dog')).toBe('hot dog');
  });
});

describe('matchPicto', () => {
  it.each([
    ['Crêpe Nutella', 'pancakes'],
    ['crepes au sucre', 'pancakes'],
    ['Gaufre', 'waffle'],
    ['Jus de pomme', 'beverage-box'],
    ['Gâteau au chocolat', 'shortcake'],
    ['Pain au chocolat', 'croissant'],
    ['Chocolat chaud', 'hot-beverage'],
    ['Hot-dog', 'hot-dog'],
    ['hot dog', 'hot-dog'],
    ['Barquette de frites', 'french-fries'],
    ['Coca', 'cup-with-straw'],
    ['Bière', 'beer-mug'],
    ['Verre de rosé', 'wine-glass'],
    ['Café', 'hot-beverage'],
    ['Eau', 'droplet'],
    ['Ticket tombola', 'admission-tickets'],
    ['Pêche à la ligne', 'fishing-pole'],
    ['Pêches', 'peach'],
    ['Barbe à papa', 'lollipop'],
    ['Croque-monsieur', 'sandwich'],
    ['Œuf', 'egg'],
    ['Sachet de bonbons', 'candy'],
    ['Galette des rois', 'crown'],
    ['Brioche', 'bread'],
    ['Sapin de Noël', 'christmas-tree'],
    ['Truc inconnu', 'label'],
    ['', 'label'],
  ])('matchPicto(%j) = %s', (name, key) => {
    expect(matchPicto(name)).toBe(key);
  });
});

describe('catalogue', () => {
  it('a une centaine de pictos aux clés uniques, dont le générique', () => {
    const keys = PICTOS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(100);
    expect(keys).toContain(FALLBACK_PICTO);
  });

  it('aucun mot-clé (normalisé, au singulier) ne désigne deux pictos', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const picto of PICTOS) {
      for (const keyword of picto.keywords) {
        const key = phrase(keyword);
        const previous = owner.get(key);
        if (previous && previous !== picto.key) clashes.push(`${keyword} : ${previous} / ${picto.key}`);
        owner.set(key, picto.key);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('chaque picto a son fichier SVG dans apps/web/public/pictos', () => {
    const missing = PICTOS.filter((p) => !existsSync(fileURLToPath(new URL(`../../../apps/web/public/pictos/${p.key}.svg`, import.meta.url))));
    expect(missing.map((p) => p.key)).toEqual([]);
  });
});

describe('resolvePicto', () => {
  it('garde un picto choisi connu', () => {
    expect(resolvePicto({ name: 'Crêpe', picto: 'waffle' })).toBe('waffle');
  });
  it('ignore une clé inconnue et revient au choix automatique', () => {
    expect(resolvePicto({ name: 'Crêpe', picto: 'nimporte-quoi' })).toBe('pancakes');
  });
  it('choisit automatiquement sans picto', () => {
    expect(resolvePicto({ name: 'Soda', picto: null })).toBe('cup-with-straw');
  });
});

describe('searchPictos', () => {
  it('trouve par début de mot dans le libellé ou les mots-clés', () => {
    const keys = searchPictos('bois').map((p) => p.key);
    expect(keys).toContain('beer-mug');
    expect(keys).toContain('cup-with-straw');
  });
  it('renvoie tout pour une recherche vide', () => {
    expect(searchPictos('  ')).toHaveLength(PICTOS.length);
  });
});

describe('pictoCategory et pictoUrl', () => {
  it('donne la catégorie, divers si inconnue', () => {
    expect(pictoCategory('pancakes')).toBe('sucre');
    expect(pictoCategory('beer-mug')).toBe('boisson');
    expect(pictoCategory('inconnu')).toBe('divers');
  });
  it('construit l’URL du fichier', () => {
    expect(pictoUrl('pizza')).toBe('/pictos/pizza.svg');
  });
});
