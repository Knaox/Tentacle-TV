/**
 * Le focus des pages en GRILLE d'affiches — bibliothèque, Ma liste, Favoris,
 * Parcourir : la clé d'une affiche, la révélation d'une ligne, le moment où la
 * page suivante est demandée, et l'entrée des pages sans barre de filtres.
 * Module pur : la plateforme pose le focus et fait défiler la page.
 *
 * Chaque LIGNE est une section (`sections.ts`) : HAUT / BAS d'une ligne à la
 * voisine, au plus proche ; aux bords, rien — la dernière ligne n'a rien sous
 * elle, le bout droit d'une ligne non plus, le bord gauche mène à la
 * navigation (ses ponts).
 */

/** Le préfixe des affiches d'une grille : `grid:<index>`. */
export const GRID_KEY_PREFIX = "grid";

/** La première affiche. */
export const GRID_FIRST_KEY = `${GRID_KEY_PREFIX}:0`;

export const gridKey = (index: number): string => `${GRID_KEY_PREFIX}:${index}`;

export const isGridKey = (key: string): boolean => key.startsWith(`${GRID_KEY_PREFIX}:`);

/**
 * Comment la page montre une ligne focalisée (GR-2) : la PREMIÈRE ramène la
 * page tout en haut, son titre et ses filtres avec elle — revenir sur la
 * première ligne, c'est revenir en haut, y compris au bout d'une remontée
 * maintenue ou d'un glisser vif, où la plateforme pose la page où son
 * défilement rapide s'arrête ; les autres viennent au plus près.
 */
export function gridLineReveal(lineIndex: number): "start" | "nearest" {
  return lineIndex === 0 ? "start" : "nearest";
}

/**
 * À combien d'écrans de la fin la page suivante est demandée (GR-4) : quand le
 * focus dévale (flèche maintenue, glisser vif), elle est là avant lui.
 */
export const GRID_END_REACHED_SCREENS = 3;

/**
 * L'entrée de Ma liste et des Favoris (CO-1) : « Réessayer » en erreur, la
 * sortie du vide (« Parcourir les bibliothèques »), sinon la première
 * affiche ; rien pendant le chargement.
 */
export function collectionEntryKey(state: { failed: boolean; empty: boolean; cards: number }): string | null {
  if (state.failed) return "status:primary";
  if (state.empty) return "empty:primary";
  return state.cards > 0 ? GRID_FIRST_KEY : null;
}

/** La croix Retour de Parcourir, et l'en-tête qui y mène par HAUT. */
export const BROWSE_BACK_KEY = "browse:back";
export const BROWSE_HEADER_KEY = "browse:header";

/**
 * L'entrée de Parcourir (PA-1) : « Réessayer » en erreur, la première affiche,
 * sinon — chargement, page vide — la croix, seule action.
 */
export function browseEntryKey(state: { failed: boolean; items: number }): string {
  if (state.failed) return "status:primary";
  return state.items > 0 ? GRID_FIRST_KEY : BROWSE_BACK_KEY;
}

/**
 * La reprise de Parcourir (PA-3) : la croix a tenu le focus pendant le
 * chargement ; les affiches arrivées, la première le reprend — tant qu'aucune
 * affiche ne l'a eu et que la croix l'a encore. `null` : rien à réclamer.
 */
export function browseClaimOnItems(state: { items: number; posterSeen: boolean; focusedKey: string | null }): string | null {
  if (state.items === 0 || state.posterSeen || state.focusedKey !== BROWSE_BACK_KEY) return null;
  return GRID_FIRST_KEY;
}

/** L'erreur arrivée après un chargement : « Réessayer » reprend le focus à la croix (PA-3). */
export function browseClaimOnError(state: { failed: boolean; posterSeen: boolean; focusedKey: string | null }): string | null {
  if (!state.failed || state.posterSeen || state.focusedKey !== BROWSE_BACK_KEY) return null;
  return "status:primary";
}
