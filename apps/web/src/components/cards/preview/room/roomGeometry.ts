/**
 * La PLACE que les voisines font à la mini-carte — géométrie pure, sans DOM.
 *
 * Quand la mini-carte est vue, les cartes de la MÊME ligne (une rangée qui
 * défile, ou une ligne de grille) glissent sur le côté : la mini-carte ne
 * recouvre plus que sa propre carte, et l'écart entre elle et chaque voisine
 * redevient celui de la rangée. À gauche, tout glisse de ce que la mini-carte
 * dépasse de sa carte à gauche ; à droite, de ce qu'elle dépasse à droite.
 * Une carte au bord — mini-carte rentrée dans la fenêtre — pousse donc tout
 * d'un seul côté. Horizontal seulement : les autres lignes ne bougent pas.
 */

export interface RoomSpan {
  left: number;
  right: number;
}

export interface RoomBand {
  top: number;
  bottom: number;
}

/** Ce que glissent les voisines : `left` vers la gauche, `right` vers la droite (px, ≥ 0, entiers). */
export interface RoomShifts {
  left: number;
  right: number;
}

/**
 * Le glissement, d'après la boîte de la carte DANS la rangée (sa place de
 * mise en page, ni soulevée ni décalée) et celle de la mini-carte.
 */
export function roomShifts(item: RoomSpan, preview: RoomSpan): RoomShifts {
  return {
    left: Math.max(0, Math.round(item.left - preview.left)),
    right: Math.max(0, Math.round(preview.right - item.right)),
  };
}

/** Rien à faire glisser : la mini-carte ne dépasse pas de sa carte. */
export function roomIsEmpty(shifts: RoomShifts): boolean {
  return shifts.left === 0 && shifts.right === 0;
}

/**
 * Deux boîtes sont sur la même ligne quand elles se recouvrent sur plus de la
 * moitié de la plus basse : une grille aligne ses lignes, mais une carte plus
 * haute (titre sur deux lignes) ne doit pas en changer.
 */
export function sameLine(a: RoomBand, b: RoomBand): boolean {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const smaller = Math.min(a.bottom - a.top, b.bottom - b.top);
  return smaller > 0 && overlap > smaller / 2;
}

export type RoomSide = "before" | "after";

/**
 * Le côté de chaque élément d'une GRILLE à plusieurs lignes : `before` à
 * gauche de la carte, `after` à droite, `null` hors de sa ligne (ou la carte
 * elle-même). Les grilles d'une seule ligne et les rangées s'en passent : la
 * feuille y lit l'ordre du document.
 */
export function gridSides(items: ReadonlyArray<RoomSpan & RoomBand>, anchorIndex: number): Array<RoomSide | null> {
  const anchor = items[anchorIndex];
  return items.map((item, index) => {
    if (index === anchorIndex || !anchor || !sameLine(anchor, item)) return null;
    return item.left + item.right < anchor.left + anchor.right ? "before" : "after";
  });
}

/**
 * Les éléments qui GLISSENT (transition) : ceux qu'on voit dans la zone
 * visible de la rangée, plus un de chaque côté — celui qui entre pendant le
 * retour. Les autres sautent à leur place sans animation : hors de la vue, un
 * glissement ne coûterait qu'un calque de plus pour rien.
 */
export function glidingIndexes(items: ReadonlyArray<RoomSpan>, view: RoomSpan): number[] {
  const visible = items.map((item) => item.right > view.left && item.left < view.right);
  const first = visible.indexOf(true);
  const last = visible.lastIndexOf(true);
  if (first < 0) return [];
  const out: number[] = [];
  for (let i = Math.max(0, first - 1); i <= Math.min(items.length - 1, last + 1); i++) out.push(i);
  return out;
}

/** La valeur d'une propriété `translate` calculée, sur l'axe horizontal (px). */
export function translateX(computed: string | null | undefined): number {
  if (!computed || computed === "none") return 0;
  const value = Number.parseFloat(computed);
  return Number.isFinite(value) ? value : 0;
}
