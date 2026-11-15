/**
 * Pictos des articles : une sélection d'icônes Fluent Emoji (Microsoft, licence MIT), chacune avec un libellé
 * et des mots-clés français. Les clés sont les noms Fluent Emoji : `apps/web/public/pictos/<clé>.svg`
 * (fichiers générés par `npm run pictos`).
 */
export type PictoCategory = 'sucre' | 'sale' | 'boisson' | 'fruit' | 'kermesse' | 'vente' | 'divers';

export interface Picto {
  key: string;
  label: string;
  category: PictoCategory;
  keywords: string[];
}

export const FALLBACK_PICTO = 'label';

const p = (key: string, label: string, category: PictoCategory, keywords: string[]): Picto => ({ key, label, category, keywords });

export const PICTOS: readonly Picto[] = [
  // Sucré
  p('pancakes', 'Crêpe', 'sucre', ['crêpe', 'galette', 'pancake', 'blini', 'nutella', 'crêpe party']),
  p('waffle', 'Gaufre', 'sucre', ['gaufre', 'waffle', 'gaufrette']),
  p('shortcake', 'Part de gâteau', 'sucre', ['gâteau', 'part de gâteau', 'cake', 'fraisier', 'quatre-quarts', 'bûche', 'bûche de Noël', 'cheesecake', 'pâtisserie']),
  p('birthday-cake', 'Gâteau d’anniversaire', 'sucre', ['gâteau d’anniversaire', 'anniversaire', 'gâteau entier']),
  p('cupcake', 'Muffin', 'sucre', ['muffin', 'cupcake', 'madeleine', 'financier']),
  p('cookie', 'Cookie', 'sucre', ['cookie', 'biscuit', 'sablé', 'palmier', 'macaron']),
  p('doughnut', 'Beignet', 'sucre', ['beignet', 'donut', 'doughnut', 'churros', 'chichi', 'boule de Berlin', 'bugne', 'merveille']),
  p('croissant', 'Viennoiserie', 'sucre', ['croissant', 'pain au chocolat', 'chocolatine', 'viennoiserie', 'pain au raisin', 'pain aux raisins', 'chausson aux pommes']),
  p('pie', 'Tarte', 'sucre', ['tarte', 'tartelette', 'quiche', 'tourte', 'clafoutis']),
  p('custard', 'Flan', 'sucre', ['flan', 'crème', 'dessert', 'panna cotta', 'crème brûlée', 'mousse au chocolat', 'yaourt', 'riz au lait']),
  p('candy', 'Bonbons', 'sucre', ['bonbon', 'confiserie', 'haribo', 'dragibus', 'carambar', 'fraise tagada', 'guimauve', 'chamallow', 'réglisse', 'sachet de bonbons']),
  p('lollipop', 'Sucette', 'sucre', ['sucette', 'barbe à papa', 'sucre d’orge', 'lollipop']),
  p('chocolate-bar', 'Chocolat', 'sucre', ['chocolat', 'barre chocolatée', 'kinder', 'mars', 'twix', 'brownie', 'tablette']),
  p('soft-ice-cream', 'Glace', 'sucre', ['glace', 'cornet', 'sorbet', 'esquimau', 'magnum', 'glace à l’italienne', 'cône', 'mister freeze']),
  p('ice-cream', 'Coupe glacée', 'sucre', ['coupe glacée', 'sundae', 'banana split']),
  p('shaved-ice', 'Granité', 'sucre', ['granité', 'granita', 'slush']),
  p('popcorn', 'Pop-corn', 'sucre', ['popcorn', 'pop-corn']),
  p('honey-pot', 'Miel', 'sucre', ['miel']),
  p('jar', 'Confiture', 'sucre', ['confiture', 'compote', 'pâte à tartiner', 'bocal']),
  p('moon-cake', 'Pâtisserie du monde', 'sucre', ['pâtisserie orientale', 'baklava', 'corne de gazelle']),

  // Salé
  p('hot-dog', 'Hot-dog', 'sale', ['hot-dog', 'hotdog', 'saucisse', 'merguez', 'chipolata', 'knack', 'saucisse frites']),
  p('sandwich', 'Sandwich', 'sale', ['sandwich', 'panini', 'jambon-beurre', 'croque', 'croque-monsieur', 'croque-madame', 'club', 'casse-croûte']),
  p('hamburger', 'Burger', 'sale', ['burger', 'hamburger', 'cheeseburger']),
  p('french-fries', 'Frites', 'sale', ['frite', 'potatoes', 'barquette de frites']),
  p('potato', 'Chips', 'sale', ['chips', 'pomme de terre', 'pommes de terre']),
  p('pizza', 'Pizza', 'sale', ['pizza', 'part de pizza', 'calzone', 'pissaladière']),
  p('baguette-bread', 'Baguette', 'sale', ['baguette', 'demi-baguette', 'flûte']),
  p('bread', 'Pain', 'sale', ['pain', 'brioche', 'pain de mie', 'pain d’épice', 'fougasse']),
  p('pretzel', 'Bretzel', 'sale', ['bretzel', 'pretzel']),
  p('bagel', 'Bagel', 'sale', ['bagel']),
  p('stuffed-flatbread', 'Kebab', 'sale', ['kebab', 'kebap', 'gyros', 'pita']),
  p('falafel', 'Falafel', 'sale', ['falafel', 'boulette']),
  p('taco', 'Tacos', 'sale', ['taco', 'nacho']),
  p('burrito', 'Wrap', 'sale', ['wrap', 'burrito', 'fajita']),
  p('cheese-wedge', 'Fromage', 'sale', ['fromage', 'raclette', 'plateau de fromages']),
  p('green-salad', 'Salade', 'sale', ['salade', 'taboulé', 'crudités']),
  p('egg', 'Œuf', 'sale', ['œuf', 'œuf dur', 'omelette']),
  p('spaghetti', 'Pâtes', 'sale', ['pâtes', 'spaghetti', 'lasagne', 'bolognaise', 'carbonara']),
  p('pot-of-food', 'Soupe', 'sale', ['soupe', 'velouté', 'potage', 'chili', 'chili con carne', 'pot-au-feu']),
  p('shallow-pan-of-food', 'Plat chaud', 'sale', ['paëlla', 'couscous', 'tartiflette', 'plat', 'plat du jour', 'jambalaya', 'choucroute', 'cassoulet']),
  p('curry-rice', 'Riz', 'sale', ['riz', 'curry', 'rougail', 'colombo', 'riz cantonais']),
  p('fork-and-knife-with-plate', 'Repas', 'sale', ['repas', 'menu', 'formule', 'plateau repas', 'dîner', 'déjeuner', 'buffet']),
  p('poultry-leg', 'Poulet', 'sale', ['poulet', 'nugget', 'aile de poulet', 'pilon']),
  p('meat-on-bone', 'Grillades', 'sale', ['grillade', 'barbecue', 'bbq', 'travers', 'ribs', 'côtelette']),
  p('cut-of-meat', 'Viande', 'sale', ['viande', 'steak', 'entrecôte', 'bavette']),
  p('oden', 'Brochette', 'sale', ['brochette']),
  p('sushi', 'Sushi', 'sale', ['sushi', 'maki']),
  p('peanuts', 'Cacahuètes', 'sale', ['cacahuète', 'arachide', 'apéricube', 'biscuit apéritif']),
  p('chestnut', 'Châtaignes', 'sale', ['châtaigne', 'marron', 'marrons chauds']),
  p('ear-of-corn', 'Maïs', 'sale', ['maïs', 'épi de maïs']),
  p('olive', 'Olives', 'sale', ['olive', 'tapenade']),
  p('tomato', 'Tomate', 'sale', ['tomate']),
  p('carrot', 'Légumes', 'sale', ['carotte', 'légume']),

  // Boissons
  p('droplet', 'Eau', 'boisson', ['eau', 'eau minérale', 'eau gazeuse', 'eau plate', 'cristaline', 'évian', 'vittel', 'perrier', 'badoit', 'volvic']),
  p('cup-with-straw', 'Soda', 'boisson', ['soda', 'coca', 'coca-cola', 'cola', 'pepsi', 'fanta', 'sprite', 'orangina', 'ice tea', 'thé glacé', 'limonade', 'schweppes', 'canette', 'boisson', 'boisson fraîche', 'sirop', 'diabolo', 'grenadine', 'citronnade', 'smoothie', 'menthe à l’eau']),
  p('beverage-box', 'Jus de fruits', 'boisson', ['jus', 'jus de fruits', 'capri-sun', 'caprisun', 'oasis', 'tropico', 'brique', 'pressé']),
  p('hot-beverage', 'Café', 'boisson', ['café', 'expresso', 'espresso', 'cappuccino', 'chocolat chaud', 'boisson chaude', 'mug', 'déca']),
  p('teacup-without-handle', 'Thé', 'boisson', ['thé', 'infusion', 'tisane']),
  p('glass-of-milk', 'Lait', 'boisson', ['lait', 'milkshake', 'lait fraise', 'lait chocolaté']),
  p('beer-mug', 'Bière', 'boisson', ['bière', 'pression', 'panaché', 'boisson alcoolisée', 'pinte', 'ipa']),
  p('wine-glass', 'Vin', 'boisson', ['vin', 'vin chaud', 'rosé', 'vin rouge', 'vin blanc', 'verre de vin', 'bordeaux']),
  p('bottle-with-popping-cork', 'Champagne', 'boisson', ['champagne', 'crémant', 'mousseux', 'prosecco', 'cidre', 'bulles']),
  p('tropical-drink', 'Cocktail', 'boisson', ['cocktail', 'punch', 'sangria', 'mojito', 'spritz', 'piña colada', 'cocktail sans alcool']),
  p('cocktail-glass', 'Apéritif', 'boisson', ['kir', 'apéritif', 'apéro', 'martini']),
  p('bubble-tea', 'Bubble tea', 'boisson', ['bubble tea']),
  p('ice', 'Glaçons', 'boisson', ['glaçon', 'sac de glaçons']),

  // Fruits
  p('red-apple', 'Pomme', 'fruit', ['pomme', 'pomme d’amour', 'pomme au caramel']),
  p('banana', 'Banane', 'fruit', ['banane']),
  p('tangerine', 'Clémentine', 'fruit', ['clémentine', 'mandarine', 'orange']),
  p('strawberry', 'Fraises', 'fruit', ['fraise', 'barquette de fraises']),
  p('watermelon', 'Pastèque', 'fruit', ['pastèque']),
  p('melon', 'Melon', 'fruit', ['melon']),
  p('grapes', 'Raisin', 'fruit', ['raisin']),
  p('pineapple', 'Ananas', 'fruit', ['ananas']),
  p('cherries', 'Fruits', 'fruit', ['cerise', 'fruit', 'salade de fruits', 'brochette de fruits', 'corbeille de fruits']),
  p('pear', 'Poire', 'fruit', ['poire']),
  p('peach', 'Pêche', 'fruit', ['pêche', 'nectarine', 'abricot', 'brugnon']),
  p('kiwi-fruit', 'Kiwi', 'fruit', ['kiwi']),
  p('lemon', 'Citron', 'fruit', ['citron']),
  p('coconut', 'Noix de coco', 'fruit', ['noix de coco', 'coco']),
  p('mango', 'Mangue', 'fruit', ['mangue']),

  // Kermesse et jeux
  p('admission-tickets', 'Tickets', 'kermesse', ['ticket', 'tombola', 'billet', 'loterie', 'carnet de tickets', 'grille', 'tirage']),
  p('ticket', 'Entrée', 'kermesse', ['entrée', 'ticket d’entrée', 'place', 'billet d’entrée', 'droit d’entrée']),
  p('coin', 'Jeton', 'kermesse', ['jeton', 'pièce', 'crédit', 'monnaie']),
  p('fishing-pole', 'Pêche à la ligne', 'kermesse', ['pêche à la ligne', 'pêche aux canards', 'canard']),
  p('bowling', 'Chamboule-tout', 'kermesse', ['chamboule-tout', 'quille', 'bowling', 'mölkky']),
  p('bullseye', 'Tir', 'kermesse', ['tir', 'fléchette', 'cible', 'tir à l’arc', 'carabine', 'chouchou']),
  p('artist-palette', 'Maquillage', 'kermesse', ['maquillage', 'grimage', 'tatouage', 'peinture']),
  p('nail-polish', 'Vernis', 'kermesse', ['vernis', 'manucure', 'ongle', 'paillettes']),
  p('balloon', 'Ballon', 'kermesse', ['ballon', 'ballon gonflable', 'sculpture de ballons', 'ballon à hélium']),
  p('wrapped-gift', 'Lot', 'kermesse', ['cadeau', 'pochette surprise', 'enveloppe surprise', 'surprise', 'gros lot']),
  p('teddy-bear', 'Peluche', 'kermesse', ['peluche', 'doudou', 'jouet', 'nounours']),
  p('camera', 'Photo', 'kermesse', ['photo', 'photobooth', 'photomaton', 'selfie', 'portrait']),
  p('game-die', 'Jeu', 'kermesse', ['jeu', 'partie', 'loto', 'bingo', 'jeu de société', 'roue']),
  p('video-game', 'Jeu vidéo', 'kermesse', ['jeu vidéo', 'console', 'manette']),
  p('carousel-horse', 'Manège', 'kermesse', ['manège', 'poney', 'tour de poney', 'carrousel', 'balade']),
  p('castle', 'Château gonflable', 'kermesse', ['château gonflable', 'structure gonflable', 'gonflable', 'trampoline']),
  p('soccer-ball', 'Foot', 'kermesse', ['foot', 'football', 'penalty', 'tir au but', 'ballon de foot', 'baby-foot']),
  p('kite', 'Cerf-volant', 'kermesse', ['cerf-volant']),
  p('yo-yo', 'Yo-yo', 'kermesse', ['yoyo', 'yo-yo', 'toupie']),
  p('puzzle-piece', 'Quiz', 'kermesse', ['quiz', 'puzzle', 'énigme', 'chasse au trésor', 'escape game']),
  p('performing-arts', 'Spectacle', 'kermesse', ['spectacle', 'déguisement', 'costume', 'masque', 'théâtre', 'marionnette']),
  p('microphone', 'Karaoké', 'kermesse', ['karaoké', 'chant', 'musique', 'concert', 'blind test']),
  p('party-popper', 'Fête', 'kermesse', ['fête', 'soirée', 'boum', 'bal', 'kermesse']),

  // Ventes diverses
  p('christmas-tree', 'Sapin', 'vente', ['sapin', 'sapin de Noël']),
  p('potted-plant', 'Plante', 'vente', ['plante', 'plant', 'semis', 'aromatique', 'pot de fleurs', 'jardinière']),
  p('bouquet', 'Fleurs', 'vente', ['fleur', 'bouquet', 'muguet', 'brin de muguet']),
  p('tulip', 'Tulipe', 'vente', ['tulipe', 'bulbe']),
  p('books', 'Livres', 'vente', ['livre', 'bd', 'bande dessinée', 'bouquin', 'roman', 'magazine']),
  p('t-shirt', 'T-shirt', 'vente', ['t-shirt', 'tee-shirt', 'tshirt', 'sweat', 'maillot', 'vêtement']),
  p('handbag', 'Sac', 'vente', ['sac', 'tote bag', 'sac en tissu', 'trousse']),
  p('calendar', 'Calendrier', 'vente', ['calendrier', 'agenda']),
  p('billed-cap', 'Casquette', 'vente', ['casquette', 'chapeau', 'bob']),
  p('socks', 'Chaussettes', 'vente', ['chaussette']),
  p('scarf', 'Écharpe', 'vente', ['écharpe', 'bonnet', 'tricot', 'tour de cou']),
  p('gloves', 'Gants', 'vente', ['gant', 'moufle']),
  p('sunglasses', 'Lunettes', 'vente', ['lunette']),
  p('framed-picture', 'Dessin', 'vente', ['dessin', 'tableau', 'affiche', 'poster', 'œuvre', 'photo de classe']),
  p('gem-stone', 'Bijou', 'vente', ['bijou', 'bracelet', 'collier', 'boucle d’oreille', 'perle']),
  p('candle', 'Bougie', 'vente', ['bougie', 'photophore']),
  p('soap', 'Savon', 'vente', ['savon', 'cosmétique']),
  p('key', 'Porte-clé', 'vente', ['porte-clé', 'porte-clés', 'clé']),
  p('jack-o-lantern', 'Citrouille', 'vente', ['citrouille', 'halloween', 'potiron']),
  p('crown', 'Galette des rois', 'vente', ['galette des rois', 'couronne', 'fève']),
  p('basket', 'Panier garni', 'vente', ['panier', 'panier garni', 'colis']),
  p('shopping-bags', 'Brocante', 'vente', ['brocante', 'vide-grenier', 'bourse aux jouets', 'occasion']),

  // Divers
  p('red-heart', 'Don', 'divers', ['don', 'adhésion', 'cotisation', 'participation', 'soutien', 'parrainage']),
  p('recycling-symbol', 'Consigne', 'divers', ['consigne', 'ecocup', 'gobelet', 'gobelet réutilisable', 'verre consigné']),
  p('money-bag', 'Caisse', 'divers', ['caisse', 'recette', 'fond de caisse']),
  p(FALLBACK_PICTO, 'Article', 'divers', ['article', 'divers', 'autre']),
];

/** Minuscules, sans accents ni ligatures (œ → oe, æ → ae), ponctuation et apostrophes remplacées par des espaces. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Pluriel simple ramené au singulier : « crêpes » → « crepe », « gâteaux » → « gateau » (les mots de 3 lettres ou moins restent tels quels). */
const singular = (word: string): string => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word);

const words = (text: string): string[] => {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(' ').map(singular) : [];
};

interface IndexEntry {
  words: string[];
  key: string;
  order: number;
}

let index: IndexEntry[] | null = null;
const byKey = new Map(PICTOS.map((picto) => [picto.key, picto]));

function keywordIndex(): IndexEntry[] {
  if (index) return index;
  index = PICTOS.flatMap((picto, order) => picto.keywords.map((keyword) => ({ words: words(keyword), key: picto.key, order })));
  return index;
}

function startsAt(haystack: string[], needle: string[], start: number): boolean {
  return needle.every((word, i) => haystack[start + i] === word);
}

/**
 * Picto déduit du nom d'un article. Parmi les mots-clés présents (suite de mots contiguë, au singulier), l'emporte
 * celui qui a le plus de mots (« pain au chocolat » plutôt que « pain »), puis celui qui commence le plus tôt dans le nom
 * (« jus de pomme » → jus), puis l'ordre du catalogue. Rien ne correspond : picto générique.
 */
export function matchPicto(name: string): string {
  const tokens = words(name);
  let best: { length: number; start: number; order: number; key: string } | null = null;
  for (const entry of keywordIndex()) {
    const length = entry.words.length;
    if (length === 0) continue;
    for (let start = 0; start + length <= tokens.length; start++) {
      if (!startsAt(tokens, entry.words, start)) continue;
      const better =
        !best ||
        length > best.length ||
        (length === best.length && (start < best.start || (start === best.start && entry.order < best.order)));
      if (better) best = { length, start, order: entry.order, key: entry.key };
      break;
    }
  }
  return best?.key ?? FALLBACK_PICTO;
}

/** Pictos dont chaque mot de la recherche est le début d'un mot du libellé ou d'un mot-clé ; recherche vide : tous. */
export function searchPictos(query: string): Picto[] {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [...PICTOS];
  return PICTOS.filter((picto) => {
    const vocabulary = normalizeText([picto.label, ...picto.keywords].join(' ')).split(' ');
    return terms.every((term) => vocabulary.some((word) => word.startsWith(term) || word.startsWith(singular(term))));
  });
}

/** Le picto choisi s'il existe au catalogue, sinon le choix automatique d'après le nom. */
export function resolvePicto(article: { name: string; picto: string | null }): string {
  if (article.picto && byKey.has(article.picto)) return article.picto;
  return matchPicto(article.name);
}

export function pictoCategory(key: string): PictoCategory {
  return byKey.get(key)?.category ?? 'divers';
}

export function pictoLabel(key: string): string {
  return byKey.get(key)?.label ?? 'Article';
}

export const pictoUrl = (key: string): string => `/pictos/${key}.svg`;
