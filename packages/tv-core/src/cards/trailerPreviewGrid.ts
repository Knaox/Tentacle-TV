import { TRAILER_PREVIEW_TILE_ASPECT, type TrailerPreviewRect, type TrailerPreviewTile } from "./trailerPreviewTile";

/**
 * La GRANDE CARTE de l'aperçu au focus dans une GRILLE d'affiches (Apple TV,
 * Android TV) — géométrie pure, en points de la scène.
 *
 * Dans une rangée, la carte grandit et la rangée défile pour lui faire place
 * (`trailerPreviewTile.ts`). Une grille ne défile pas en largeur, et faire
 * descendre les lignes du dessous ferait tout bouger (et relayer la liste
 * recyclée à chaque image). La grande carte d'une grille prend donc TROIS
 * COLONNES, en 16:9 (`GRID_PREVIEW_SPAN`) — la taille de celle des rangées
 * (804 points en taille normale, contre 806), et à peu près la hauteur d'une
 * affiche et de sa légende : elle reste dans la BANDE de sa ligne
 * (`gridTrailerPreviewPlace`). Rien ne bouge en hauteur, la page n'a pas à
 * suivre.
 *
 * Dans la ligne, les autres affiches glissent par COLONNES ENTIÈRES
 * (`gridTrailerPreviewSpread`) : la grille garde ses colonnes. La grande
 * carte s'étend à droite de la carte focalisée ; près du bord droit, elle
 * s'arrête à la dernière colonne, et ce qui est à gauche glisse d'autant à
 * gauche. Rien ne se pose sur une voisine : elles s'écartent, au même rythme
 * que la carte grandit. Une affiche qui sortirait par la gauche (sous la
 * navigation) s'efface — jamais une voisine immédiate : la flèche y mène
 * depuis la grande carte.
 *
 * La CIBLE du focus garde la place de l'affiche : la grande carte déborde de
 * sa cellule. HAUT et BAS restent dans sa colonne.
 */

/** Les colonnes que la grande carte d'une grille couvre. */
export const GRID_PREVIEW_SPAN = 3;

export interface GridPreviewSpread {
  /** La première colonne que la grande carte couvre. */
  first: number;
  /** Pour chaque colonne de la ligne : de combien de colonnes son affiche glisse
   *  (< 0 : à gauche) ; 0 pour celle qui grandit. */
  offsets: number[];
  /** Pour chaque colonne : son affiche sort par la gauche et s'efface. */
  hidden: boolean[];
}

export interface GridPreviewSpreadInput {
  /** La colonne de la carte qui grandit (0 : la première). */
  column: number;
  /** Les colonnes de la grille. */
  columns: number;
  /** Les colonnes que la grande carte couvre (`GRID_PREVIEW_SPAN` par défaut). */
  span?: number;
}

/** La place que la ligne fait à sa grande carte : où elle commence, et où glissent ses voisines. */
export function gridTrailerPreviewSpread(input: GridPreviewSpreadInput): GridPreviewSpread {
  const columns = Math.max(1, Math.floor(input.columns));
  const span = Math.max(1, Math.min(columns, Math.floor(input.span ?? GRID_PREVIEW_SPAN)));
  const column = Math.max(0, Math.min(columns - 1, Math.floor(input.column)));
  const first = Math.min(column, columns - span);
  const before = first - column;
  const after = first + span - 1 - column;
  const offsets: number[] = [];
  const hidden: boolean[] = [];
  for (let at = 0; at < columns; at += 1) {
    const offset = at < column ? before : at > column ? after : 0;
    offsets.push(offset);
    hidden.push(at + offset < 0 && Math.abs(at - column) > 1);
  }
  return { first, offsets, hidden };
}

export interface GridPreviewPlace {
  tile: TrailerPreviewTile;
  /** Où la grande carte part : l'affiche telle qu'elle se dessine au focus (dans sa cellule). */
  from: TrailerPreviewRect;
  /** Où elle arrive, dans la cellule de l'affiche (elle en déborde). */
  to: TrailerPreviewRect;
}

export interface GridPreviewPlaceInput {
  column: number;
  columns: number;
  cardWidth: number;
  cardHeight: number;
  /** L'écart entre deux colonnes. */
  gap: number;
  /** L'agrandissement de l'affiche focalisée, depuis son CENTRE (1 : aucun). */
  focusScale: number;
  /** Ce que l'affiche focalisée se soulève (0 : rien). */
  lift: number;
  /** Le bas de sa légende au focus, sous le haut de la cellule : la grande
   *  carte s'y arrête, l'indication de l'appui maintenu reste visible dessous. */
  captionBottom: number;
  span?: number;
}

/**
 * La grande carte d'une affiche de grille : large de `span` colonnes, en
 * 16:9 ; elle part de l'affiche telle qu'elle se dessine au focus (agrandie
 * depuis son centre, soulevée) et finit au bas de sa légende — elle couvre
 * l'affiche et son titre (la grande carte porte le sien), jamais la ligne
 * suivante ni l'indication de l'appui maintenu, posée sous la légende. Sa
 * hauteur et celle de l'affiche et de sa légende ne diffèrent que de
 * quelques points : elle mord à peine sur l'écart du dessus.
 */
export function gridTrailerPreviewPlace(input: GridPreviewPlaceInput): GridPreviewPlace {
  const columns = Math.max(1, Math.floor(input.columns));
  const span = Math.max(1, Math.min(columns, Math.floor(input.span ?? GRID_PREVIEW_SPAN)));
  const column = Math.max(0, Math.min(columns - 1, Math.floor(input.column)));
  const { first } = gridTrailerPreviewSpread({ column, columns, span });
  const width = Math.round(span * input.cardWidth + (span - 1) * input.gap);
  const height = Math.round(width / TRAILER_PREVIEW_TILE_ASPECT);
  const scaledWidth = input.cardWidth * input.focusScale;
  const scaledHeight = input.cardHeight * input.focusScale;
  const from = {
    left: (input.cardWidth - scaledWidth) / 2,
    top: (input.cardHeight - scaledHeight) / 2 - input.lift,
    width: scaledWidth,
    height: scaledHeight,
  };
  const to = { left: (first - column) * (input.cardWidth + input.gap), top: input.captionBottom - height, width, height };
  return { tile: { width, height }, from, to };
}

/**
 * La fenêtre de préparation d'une grille autour de sa carte focalisée :
 * `[début, fin[` — sa ligne et la suivante, celle où BAS mène. Bornée :
 * deux lignes au plus, quelle que soit la taille du catalogue.
 */
export function gridTrailerPreviewWarmWindow(index: number, count: number, columns: number): [number, number] {
  const perLine = Math.max(1, Math.floor(columns));
  const start = Math.max(0, Math.min(count, Math.floor(index / perLine) * perLine));
  return [start, Math.min(count, start + 2 * perLine)];
}

/**
 * La grille est POSÉE quand ni le focus ni la page n'ont bougé depuis
 * `GRID_PREVIEW_SETTLE_MS` : avant, ni aperçu ni préparation. Le focus seul ne
 * suffit pas à le dire — en défilement accéléré (flèche tenue), tvOS ne
 * prévient l'app que d'un focus de temps en temps (un toutes les deux
 * secondes, mesuré), alors que la page défile toujours : c'est le défilement
 * qui dit que la grille bouge.
 */
export const GRID_PREVIEW_SETTLE_MS = 300;

/** Dans combien de temps la grille sera posée (ms ; 0 : elle l'est), depuis son dernier mouvement. */
export function gridPreviewSettleDelay(lastMoveAt: number | null, now: number, settleMs = GRID_PREVIEW_SETTLE_MS): number {
  if (lastMoveAt === null) return 0;
  return Math.max(0, lastMoveAt + settleMs - now);
}

/** Au-delà de tant de lignes défilées depuis le focus qu'elle connaît, l'app est en retard sur la page. */
export const GRID_FOCUS_OUTRUN_LINES = 1.5;

/**
 * Le focus que l'app connaît est DÉPASSÉ : la page a défilé de plus d'une
 * ligne et demie depuis qu'elle l'a reçu — un pas de flèche n'en fait jamais
 * défiler plus d'une. C'est le défilement accéléré de tvOS, dont l'app ne
 * reçoit qu'un focus de temps en temps : la carte qu'elle croit focalisée est
 * déjà loin, son aperçu ne se demande pas. Un pas simple, lui, ne retarde rien.
 */
export function gridFocusOutrun(scrollAtFocus: number, scrollNow: number, lineStride: number): boolean {
  return Math.abs(scrollNow - scrollAtFocus) > GRID_FOCUS_OUTRUN_LINES * Math.max(1, lineStride);
}
