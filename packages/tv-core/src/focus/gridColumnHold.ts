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
 * La règle SUIT les focus (`gridColumnHoldFocus`) et ne corrige qu'une fois
 * la grille POSÉE (`gridColumnHoldSettle` : ni focus ni défilement depuis
 * `GRID_PREVIEW_SETTLE_MS`) — jamais en plein mouvement, et sans dépendre de
 * la fin d'un maintien, que la Siri Remote n'annonce pas toujours (relevé du
 * testeur : une remise à zéro « au lâcher » tombait en plein maintien sur une
 * machine chargée, et la colonne se perdait). La correction tombe à l'arrêt,
 * d'un pas horizontal dans la ligne où l'on est :
 *
 * - la colonne retenue est celle du dernier pas DANS une ligne (GAUCHE,
 *   DROITE : la ligne ne change pas — ni l'ordre des évènements ni les
 *   intentions n'entrent en jeu, tvOS ne les livre pas toujours dans le même
 *   ordre), ou de l'entrée dans la grille ;
 * - un focus arrivé dans une AUTRE ligne est rendu, la grille posée, à SA
 *   ligne dans la colonne retenue (`correct`) ;
 * - la dernière ligne, plus courte, est entrée par sa dernière affiche
 *   (GR-3) : ce focus-là est juste, et sa colonne devient la retenue ;
 * - sorti de la grille (les filtres, le rail), la colonne reste retenue tant
 *   que le mouvement dure — HAUT tenu jusqu'en haut, tvOS traverse les
 *   filtres au bout de sa course et revient sur la première ligne (relevé du
 *   18/10 : grid:0 au lieu de grid:3) ; la grille posée avec le focus HORS
 *   d'elle, plus rien n'est retenu : on y reviendra au plus proche.
 *
 * Module pur : l'adaptateur dit les focus et la grille posée, puis réclame la
 * clé rendue.
 */

export interface GridColumnHoldState {
  /** La colonne retenue ; `null` : aucune (hors de la grille, ou pas encore entrée). */
  column: number | null;
  /** Le dernier focus de la grille (son index) : sa ligne, et ce qu'on corrige. */
  focused: number | null;
  /** Le focus est sorti de la grille depuis : le mouvement n'est peut-être pas fini. */
  outside: boolean;
}

export const GRID_COLUMN_HOLD_START: GridColumnHoldState = { column: null, focused: null, outside: false };

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

const perLineOf = (columns: number) => Math.max(1, Math.floor(columns));

/**
 * Le focus se pose : sur l'affiche `index` de la grille, ou hors d'elle
 * (`null`). `columns`, `count` : la grille telle qu'elle est. Rien ne se
 * corrige ici : la grille bouge encore.
 */
export function gridColumnHoldFocus(state: GridColumnHoldState, index: number | null, columns: number, count: number): GridColumnHoldState {
  if (index === null || index < 0 || index >= count) {
    return state.column === null ? GRID_COLUMN_HOLD_START : { ...state, focused: null, outside: true };
  }
  const perLine = perLineOf(columns);
  const column = index % perLine;
  // L'entrée dans la grille : la colonne voulue, c'est celle-ci.
  if (state.column === null) return { column, focused: index, outside: false };
  // De retour dans la grille au cours du même mouvement : la colonne reste celle d'avant.
  if (state.outside || state.focused === null) return { ...state, focused: index, outside: false };
  // Un pas dans la même ligne : la colonne voulue change.
  if (Math.floor(state.focused / perLine) === Math.floor(index / perLine)) return { column, focused: index, outside: false };
  return { ...state, focused: index };
}

/**
 * La grille est POSÉE (`gridPreviewSettleDelay`) : le dernier focus est rendu à
 * la colonne retenue s'il le faut ; posée avec le focus hors de la grille, on
 * oublie la colonne.
 */
export function gridColumnHoldSettle(state: GridColumnHoldState, columns: number, count: number): GridColumnHoldStep {
  if (state.outside) return { state: GRID_COLUMN_HOLD_START, correct: null };
  if (state.column === null || state.focused === null || state.focused >= count) return { state, correct: null };
  const perLine = perLineOf(columns);
  const target = inColumn(state.focused, state.column, perLine, count);
  // Dans la colonne, ou la dernière ligne plus courte entrée par sa dernière affiche : sa colonne devient la retenue.
  if (target === state.focused) return { state: { ...state, column: state.focused % perLine }, correct: null };
  return { state, correct: target };
}
