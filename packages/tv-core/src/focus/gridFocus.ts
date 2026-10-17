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

/** L'index de l'affiche d'une clé `<préfixe>:<index>`, ou `null` (une ligne, une autre clé). */
export function gridIndexOf(key: string, prefix: string = GRID_KEY_PREFIX): number | null {
  if (!key.startsWith(`${prefix}:`)) return null;
  const rest = key.slice(prefix.length + 1);
  return /^\d+$/.test(rest) ? Number(rest) : null;
}

/*
 * Comment la page montre une ligne focalisée (GR-2, 18/10) : TOUJOURS au même
 * endroit, juste sous la zone fixe de l'aperçu (`previewZoneLayout.ts`,
 * `BELOW_ZONE_REVEAL`) — la première comme les autres : la position
 * verticale du focus ne change jamais. L'en-tête (titre, filtres) ramène la
 * page tout en haut quand le focus y remonte (sa propre section).
 */

/** La section d'une ligne de grille : `<préfixe>:line:<n>` (`PosterGrid`). */
export const gridLineKey = (prefix: string, lineIndex: number): string => `${prefix}:line:${lineIndex}`;

/** Les entrées des deux lignes voisines de l'affiche focalisée (index d'affiches, `null` : pas de ligne). */
export interface GridLineEntries {
  /** La ligne du dessus et l'affiche par laquelle HAUT y entre. */
  above: { line: number; index: number } | null;
  /** La ligne du dessous et l'affiche par laquelle BAS y entre. */
  below: { line: number; index: number } | null;
}

/**
 * HAUT et BAS gardent la COLONNE (GR-7) : les lignes voisines déclarent leur
 * ENTRÉE à la colonne de l'affiche focalisée — sans écart de mise en page,
 * c'est déjà l'affiche au centre le plus proche (`sections.ts`), mais
 * l'entrée déclarée ne dépend ni de la règle de voisinage ni de ce que la
 * plateforme a monté. Une ligne du dessous plus courte (la dernière) entre
 * par sa dernière affiche.
 */
export function gridLineEntries(index: number, columns: number, count: number): GridLineEntries {
  const perLine = Math.max(1, Math.floor(columns));
  if (index < 0 || index >= count) return { above: null, below: null };
  const line = Math.floor(index / perLine);
  const column = index - line * perLine;
  const above = line > 0 ? { line: line - 1, index: (line - 1) * perLine + column } : null;
  const belowStart = (line + 1) * perLine;
  const below = belowStart < count ? { line: line + 1, index: Math.min(belowStart + column, count - 1) } : null;
  return { above, below };
}

/**
 * À combien d'écrans de la fin la page suivante est demandée (GR-4) : quand le
 * focus dévale (flèche maintenue, glisser vif), elle est là avant lui.
 */
export const GRID_END_REACHED_SCREENS = 3;

/**
 * L'entrée de Ma liste et des Favoris (CO-1) : « Réessayer » en erreur, la
 * sortie du vide (« Parcourir les bibliothèques »), sinon la première
 * affiche ; rien pendant le chargement. Un type qui ne garde aucun titre
 * (`noResults`, CO-4) : « Tout effacer », la même clé que la sortie du vide.
 */
export function collectionEntryKey(state: { failed: boolean; empty: boolean; cards: number; noResults?: boolean }): string | null {
  if (state.failed) return "status:primary";
  if (state.empty || (state.noResults && state.cards === 0)) return "empty:primary";
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
