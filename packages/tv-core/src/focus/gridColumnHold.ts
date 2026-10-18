import type { Direction } from "../input/keys";

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
 * - sorti de la grille (les filtres, le rail), la colonne reste retenue au
 *   RETOUR de tvOS : HAUT tenu jusqu'en haut, tvOS traverse les filtres au
 *   bout de sa course, peut y rester tant que la flèche est tenue, et revient
 *   sur la première ligne au lâcher (relevés du 18/10 : grid:0 au lieu de
 *   grid:3, même après plus de 1,5 s dehors). Ce retour-là n'a ni pas de côté
 *   ni appui BAS. Une entrée VOULUE depuis les filtres est au plus proche
 *   (GR-3) : après un pas GAUCHE ou DROITE dehors (d'un filtre à l'autre, même
 *   vite : HAUT, DROITE, BAS), ou un appui BAS après un séjour de plus de
 *   `GRID_COLUMN_RETURN_MS` ; un HAUT puis BAS aussitôt rend la colonne d'avant.
 *   L'ordre des évènements n'y gêne pas : tvOS livre l'appui à son
 *   relâchement, après le focus — mais avant que la grille se pose, et c'est
 *   là seulement qu'on corrige (`gridColumnHoldMove`, `gridColumnHoldSettle`).
 *
 * Module pur : l'adaptateur dit les focus et la grille posée, puis réclame la
 * clé rendue.
 */

export interface GridColumnHoldState {
  /** La colonne retenue ; `null` : aucune (pas encore entrée). */
  column: number | null;
  /** Le dernier focus de la grille (son index) : sa ligne, et ce qu'on corrige ; `null` : hors d'elle. */
  focused: number | null;
  /** Quand le focus est sorti de la grille ; `null` : il y est. */
  leftAt: number | null;
  /** Un pas GAUCHE ou DROITE depuis la sortie (d'un filtre à l'autre) : la traversée d'un HAUT tenu n'en fait aucun. */
  sideways: boolean;
  /** Revenu dans la grille après un long séjour dehors : un appui BAS dira une entrée voulue. */
  returnedLate: boolean;
  /** Une entrée voulue, dite après coup (l'appui BAS) : la grille posée, sa colonne devient la retenue. */
  deliberate: boolean;
}

export const GRID_COLUMN_HOLD_START: GridColumnHoldState = { column: null, focused: null, leftAt: null, sideways: false, returnedLate: false, deliberate: false };

/**
 * Revenu dans la grille par un appui BAS moins de tant après en être sorti
 * (HAUT puis BAS aussitôt) : la colonne d'avant tient. Plus tard, BAS depuis
 * une pastille est une entrée voulue, au plus proche. Le retour de tvOS au
 * bout d'un HAUT tenu, sans appui BAS, garde la colonne quelle que soit sa durée.
 */
export const GRID_COLUMN_RETURN_MS = 1_500;

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
 * Le focus se pose, à `at` : sur l'affiche `index` de la grille, ou hors
 * d'elle (`null`). `columns`, `count` : la grille telle qu'elle est. Rien ne se
 * corrige ici : la grille bouge encore.
 */
export function gridColumnHoldFocus(state: GridColumnHoldState, index: number | null, columns: number, count: number, at: number): GridColumnHoldState {
  if (index === null || index < 0 || index >= count) {
    return { ...state, focused: null, leftAt: state.leftAt ?? at };
  }
  const perLine = perLineOf(columns);
  const column = index % perLine;
  const entry = { ...GRID_COLUMN_HOLD_START, column, focused: index };
  // L'entrée dans la grille, ou le retour après un vrai séjour dehors : la colonne voulue, c'est celle-ci.
  if (state.column === null) return entry;
  if (state.leftAt !== null) {
    // Un pas de côté dehors (HAUT, DROITE, BAS : on a changé de filtre) : une entrée voulue, au plus proche.
    if (state.sideways) return entry;
    // Sinon la colonne reste retenue ; après un long séjour, l'appui BAS (s'il vient) dira une entrée voulue.
    return { ...state, focused: index, leftAt: null, returnedLate: at - state.leftAt > GRID_COLUMN_RETURN_MS };
  }
  if (state.focused === null) return entry;
  // Un pas dans la même ligne : la colonne voulue change.
  if (Math.floor(state.focused / perLine) === Math.floor(index / perLine)) return entry;
  return { ...state, focused: index };
}

/**
 * Un pas (ou un glisser) vers `direction` : GAUCHE ou DROITE HORS de la grille,
 * c'est un passage voulu par les filtres ; BAS après un retour tardif dans la
 * grille, c'est une entrée voulue — le retour de tvOS au bout d'un HAUT tenu
 * n'a pas d'appui BAS.
 */
export function gridColumnHoldMove(state: GridColumnHoldState, direction: Direction): GridColumnHoldState {
  if (state.leftAt !== null && (direction === "gauche" || direction === "droite")) return { ...state, sideways: true };
  if (state.returnedLate && direction === "bas") return { ...state, returnedLate: false, deliberate: true };
  return state;
}

/** Les lignes de la grille à l'écran (`gridVisibleLines`, `trailerPreviewGrid.ts`). */
export interface GridLineRange {
  first: number;
  last: number;
}

/**
 * La grille est POSÉE (`gridPreviewSettleDelay`), ou elle RALENTIT au bout
 * d'un défilement (`gridScrollSlow` — tvOS a posé le focus, la page finit sa
 * course : la colonne arrive ~1 s plus tôt, mesuré au banc de fluidité) : le
 * dernier focus est rendu à la colonne retenue s'il le faut ; hors de la
 * grille, rien (le retour en décidera, `gridColumnHoldFocus`). `visible` (au
 * ralenti seulement) : les lignes à l'écran — un focus connu HORS d'elles est
 * périmé (tvOS ne prévient l'app que de loin en loin pendant un défilement
 * accéléré) : on attend la grille posée, jamais une réclamation loin de
 * l'écran.
 */
export function gridColumnHoldSettle(state: GridColumnHoldState, columns: number, count: number, visible?: GridLineRange): GridColumnHoldStep {
  if (state.column === null || state.focused === null || state.focused >= count) return { state, correct: null };
  const perLine = perLineOf(columns);
  // Une entrée voulue depuis les filtres : au plus proche, sa colonne devient la retenue.
  if (state.deliberate) return { state: { ...state, column: state.focused % perLine, deliberate: false, returnedLate: false }, correct: null };
  const line = Math.floor(state.focused / perLine);
  if (visible && (line < visible.first || line > visible.last)) return { state, correct: null };
  const target = inColumn(state.focused, state.column, perLine, count);
  // Dans la colonne, ou la dernière ligne plus courte entrée par sa dernière affiche : sa colonne devient la retenue.
  if (target === state.focused) return { state: { ...state, column: state.focused % perLine, returnedLate: false }, correct: null };
  return { state: { ...state, returnedLate: false }, correct: target };
}
