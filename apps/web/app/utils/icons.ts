/**
 * Contenu SVG brut des icônes (grille de 24, trait de 2 px, bouts arrondis).
 * Les icônes de navigation, de mois, d'astuce, de mot de passe, de Face ID et de e-mail sont copiées des maquettes ;
 * les autres sont dessinées dans le même style.
 */
const CHEVRON_LEFT = '<path d="m15 6-6 6 6 6"></path>';

export const ICONS = {
  // Maquettes (Main.dc.html, Mobile-Accueil.dc.html, Calendrier.dc.html, Charges.dc.html, Mobile-Connexion.dc.html…)
  dashboard: '<path d="M4 19V5"></path><path d="M4 19h16"></path><path d="m8 15 4-4 3 3 5-6"></path>',
  clients: '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M18 14.8c1.9.7 3.1 2.6 3.5 5.2"></path>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"></rect><path d="M3.5 10h17M8 3v4M16 3v4"></path>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"></path><path d="M9 8h6M9 12h6"></path>',
  'chevron-left': CHEVRON_LEFT,
  'chevron-right': '<path d="m9 6 6 6-6 6"></path>',
  // Le bouton « retour » des maquettes mobiles est ce même chevron.
  'arrow-left': CHEVRON_LEFT,
  bulb: '<path d="M9 18h6M10 21h4"></path><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  'face-id': '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"></path><path d="M9 9v1M15 9v1M12 9v4h-1M9.5 16c1.5 1 3.5 1 5 0"></path>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m4 7 8 6 8-6"></path>',

  // Dessinées dans le même style (absentes des maquettes)
  home: '<path d="M3.5 11 12 4l8.5 7"></path><path d="M6 9.5V20h12V9.5"></path><path d="M10 20v-5.5h4V20"></path>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"></rect><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"></path><path d="M3 13h18"></path>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"></path><path d="M4 7.5V17a2.5 2.5 0 0 0 2.5 2.5H20V8H6.5A2.5 2.5 0 0 1 4 7.5z"></path><circle cx="16" cy="13.5" r="1"></circle>',
  'eye-off': '<path d="M3 3l18 18"></path><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4.1M6.5 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="3"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"></path><path d="M10 21h4"></path>',
  download: '<path d="M12 4v11"></path><path d="m7.5 11 4.5 4.5 4.5-4.5"></path><path d="M5 19h14"></path>',
  upload: '<path d="M12 16V5"></path><path d="m7.5 9 4.5-4.5L16.5 9"></path><path d="M5 19h14"></path>',
  logout: '<path d="M9 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H9"></path><path d="m16 8 4 4-4 4"></path><path d="M20 12H9"></path>',

  // Catégories de charges (Toi, Social, Impôts, Véhicule, Services, Outils, Banque, Assurance, Autre)
  'cat-toi': '<circle cx="12" cy="8" r="3.8"></circle><path d="M4.5 20c.9-3.8 3.7-6 7.5-6s6.6 2.2 7.5 6"></path>',
  'cat-social': '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10C19.5 15.6 12 20 12 20z"></path>',
  'cat-impots': '<path d="M19 5 5 19"></path><circle cx="7.5" cy="7.5" r="2.5"></circle><circle cx="16.5" cy="16.5" r="2.5"></circle>',
  'cat-vehicule': '<path d="M5 17h14a1 1 0 0 0 1-1v-3.5L18 7.5a2 2 0 0 0-1.8-1H7.8A2 2 0 0 0 6 7.5l-2 5V16a1 1 0 0 0 1 1z"></path><path d="M4 12.5h16"></path><path d="M7 17v2.5M17 17v2.5"></path>',
  'cat-services': '<path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v4h4"></path><path d="M10 12h5M10 16h5"></path>',
  'cat-outils': '<rect x="3" y="4" width="18" height="12" rx="2.5"></rect><path d="M8 20h8M12 16v4"></path>',
  'cat-banque': '<path d="M3.5 9.5 12 4l8.5 5.5"></path><path d="M6 10.5V18M10 10.5V18M14 10.5V18M18 10.5V18"></path><path d="M3.5 20.5h17"></path>',
  'cat-assurance': '<path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6z"></path><path d="m9 12 2.2 2.2L15 10"></path>',
  'cat-autre': '<circle cx="6" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="18" cy="12" r="1"></circle>',
} as const;

export type IconName = keyof typeof ICONS;

const CATEGORY_ICONS: Readonly<Record<string, IconName>> = {
  Toi: 'cat-toi',
  Social: 'cat-social',
  'Impôts': 'cat-impots',
  'Véhicule': 'cat-vehicule',
  Services: 'cat-services',
  Outils: 'cat-outils',
  Banque: 'cat-banque',
  Assurance: 'cat-assurance',
};

/** Icône d'une catégorie de charge (« Autre » pour une catégorie inconnue ou absente). */
export function categoryIcon(category: string | null): IconName {
  return (category && CATEGORY_ICONS[category]) || 'cat-autre';
}
