import type { HoldKey, HoldPhase } from "../remote/intents";

/**
 * La COLONNE TENUE d'une grille d'affiches (GR-7 bis, 18/10) : HAUT et BAS ne
 * changent jamais de colonne, même au DÉFILEMENT ACCÉLÉRÉ.
 *
 * Pas à pas, la règle des sections et l'entrée déclarée des lignes voisines
 * (`gridLineEntries`) gardent déjà la colonne. Mais quand une flèche est
 * tenue, tvOS passe en défilement accéléré : c'est lui qui déplace le focus,
 * sans consulter ni guides ni entrées, et l'app n'en apprend qu'un focus de
 * temps en temps (`trailerPreviewGrid.ts`) — relevé du testeur (18/10) :
 * colonne 3, BAS tenu 6 s, arrivée en colonne 1 ; HAUT tenu, de même.
 *
 * La règle retient la colonne du focus et la met à jour à chaque pas DANS une
 * ligne (GAUCHE, DROITE : la ligne ne change pas — ni l'ordre des évènements
 * ni les intentions n'entrent en jeu, tvOS ne les livre pas toujours dans le
 * même ordre). Un focus arrivé dans une AUTRE ligne et une autre colonne est
 * rendu à SA ligne, dans la colonne retenue (`correct`). Pendant le maintien de
 * HAUT ou BAS, elle attend que la touche soit lâchée (`held`), ou que la
 * grille se pose (`gridColumnHoldRelease`) : on ne dispute jamais le focus à
 * tvOS en plein défilement, la correction tombe à l'arrêt, d'un pas
 * horizontal dans la ligne où l'on est.
 *
 * Exceptions, celles de la règle des sections (GR-3) : la dernière ligne,
 * plus courte, est entrée par sa dernière affiche — ce focus-là est juste, et
 * la colonne retenue devient la sienne, comme avant. Hors de la grille (les
 * filtres, le rail), plus rien n'est retenu : on y revient au plus proche.
 *
 * Module pur : l'adaptateur dit les focus et les maintiens, puis réclame la
 * clé rendue.
 */

export interface GridColumnHoldState {
  /** La colonne retenue ; `null` : aucune (hors de la grille, ou pas encore entrée). */
  column: number | null;
  /** HAUT ou BAS est tenu : la correction attend qu'il soit lâché. */
  held: boolean;
  /** Le dernier focus de la grille (son index) : sa ligne, et ce qu'on corrige au lâcher. */
  focused: number | null;
}

export const GRID_COLUMN_HOLD_START: GridColumnHoldState = { column: null, held: false, focused: null };

export interface GridColumnHoldStep {
  state: GridColumnHoldState;
  /** L'affiche (son index) où rendre le focus, dans sa ligne ; `null` : rien à faire. */
  correct: number | null;
}

/** Dans la ligne de `index`, l'affiche de la colonne `column` (la dernière de la ligne au plus). */
function inColumn(index: number, column: number, perLine: number, count: number): number {
  const start = Math.floor(index / perLine) * perLine;
  return Math.min(start + column, start + perLine - 1, count - 1);
}

/**
 * Le focus se pose : sur l'affiche `index` de la grille, ou hors d'elle
 * (`null`). `columns`, `count` : la grille telle qu'elle est.
 */
export function gridColumnHoldFocus(state: GridColumnHoldState, index: number | null, columns: number, count: number): GridColumnHoldStep {
  if (index === null || index < 0 || index >= count) return { state: { ...GRID_COLUMN_HOLD_START, held: state.held }, correct: null };
  const perLine = Math.max(1, Math.floor(columns));
  const column = index % perLine;
  const accept = { state: { ...state, column, focused: index }, correct: null };
  // L'entrée dans la grille, ou un pas dans la même ligne : la colonne voulue, c'est celle-ci.
  if (state.column === null || state.focused === null || Math.floor(state.focused / perLine) === Math.floor(index / perLine)) return accept;
  const target = inColumn(index, state.column, perLine, count);
  // Dans la colonne retenue, ou la dernière ligne plus courte entrée par sa dernière affiche.
  if (target === index) return accept;
  return { state: { ...state, focused: index }, correct: state.held ? null : target };
}

/**
 * La correction au LÂCHER, ou quand la grille se POSE (rien n'a bougé depuis
 * `GRID_PREVIEW_SETTLE_MS` : `gridPreviewSettleDelay`) — la Siri Remote
 * n'annonce pas toujours la fin d'une flèche tenue : la grille posée la vaut.
 * Le dernier focus est rendu à sa colonne s'il le faut.
 */
export function gridColumnHoldRelease(state: GridColumnHoldState, columns: number, count: number): GridColumnHoldStep {
  const released = state.held ? { ...state, held: false } : state;
  if (released.column === null || released.focused === null || released.focused >= count) return { state: released, correct: null };
  const target = inColumn(released.focused, released.column, Math.max(1, Math.floor(columns)), count);
  return { state: released, correct: target === released.focused ? null : target };
}

/** Une touche tenue commence ou finit : au lâcher de HAUT ou BAS, la correction (`gridColumnHoldRelease`). */
export function gridColumnHoldKey(state: GridColumnHoldState, key: HoldKey, phase: HoldPhase, columns: number, count: number): GridColumnHoldStep {
  if (key !== "haut" && key !== "bas") return { state, correct: null };
  if (phase !== "end") return { state: state.held ? state : { ...state, held: true }, correct: null };
  return gridColumnHoldRelease(state, columns, count);
}
