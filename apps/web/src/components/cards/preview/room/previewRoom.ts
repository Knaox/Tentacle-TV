import { PREVIEW_ENTER_EASE, PREVIEW_ENTER_MS, PREVIEW_EXIT_EASE, PREVIEW_EXIT_MS } from "../previewMotion";
import { glidingIndexes, gridSides, roomIsEmpty, roomShifts, translateX, type RoomSide, type RoomSpan } from "./roomGeometry";
import "./previewRoom.css";

/**
 * Les VOISINES qui s'écartent, côté DOM — sans un seul rendu React.
 *
 * Le conteneur des cartes se déclare « pièce » (`data-preview-room`) :
 *
 *   • `row` — une rangée qui défile, ou UNE ligne de grille : l'ordre du
 *     document dit le côté, la feuille fait glisser tout ce qui précède la
 *     carte vers la gauche et tout ce qui la suit vers la droite. Une carte
 *     montée PENDANT l'aperçu (la fenêtre d'une rangée glisse) prend sa place
 *     d'elle-même ;
 *   • `grid` — une grille de plusieurs lignes : seuls les éléments de la ligne
 *     de la carte reçoivent leur côté (`data-room-side`).
 *
 * Ses cales (`data-room-skip`) ne bougent jamais : décalées, elles
 * élargiraient la zone de défilement.
 *
 * Tout passe par des attributs et deux variables posés sur la pièce ; la
 * feuille anime `translate` (le compositeur, aucune mise en page, aucune
 * peinture des cartes). Les mesures sont lues d'un seul tenant à l'ouverture,
 * les écritures suivent. Au repos, il ne reste RIEN : ni attribut, ni
 * variable, ni calque.
 */

const ROOM = "data-preview-room";
const STATE = "data-room";
const ANCHOR = "data-room-anchor";
const SIDE = "data-room-side";
const GLIDE = "data-room-glide";
const SKIP = "data-room-skip";

const VARS: Record<string, string> = {
  "--room-enter-ms": `${PREVIEW_ENTER_MS}ms`,
  "--room-enter-ease": PREVIEW_ENTER_EASE,
  "--room-exit-ms": `${PREVIEW_EXIT_MS}ms`,
  "--room-exit-ease": PREVIEW_EXIT_EASE,
};
const SHIFT_VARS = ["--room-left", "--room-right"];
/** Le retour fini (plus une marge d'une image ou deux), la pièce est rendue. */
const CLEAR_AFTER_MS = PREVIEW_EXIT_MS + 60;

interface RoomState {
  owner: symbol;
  item: HTMLElement;
  marked: Set<HTMLElement>;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Une pièce n'a qu'un occupant : la dernière mini-carte qui l'a ouverte. */
const rooms = new WeakMap<HTMLElement, RoomState>();

export interface PreviewRoomHandle {
  /** La zone où un retour fait glisser des cartes (coordonnées de fenêtre). */
  contains: (x: number, y: number) => boolean;
  /** La mini-carte part : les voisines reviennent, au tempo de sa sortie. */
  close: () => void;
}

interface Measured {
  el: HTMLElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function roomOf(anchor: HTMLElement): { room: HTMLElement; item: HTMLElement } | null {
  const room = anchor.closest<HTMLElement>(`[${ROOM}]`);
  if (!room) return null;
  let item: HTMLElement | null = anchor;
  while (item && item.parentElement !== room) item = item.parentElement;
  return item ? { room, item } : null;
}

/** La place de chaque élément DANS la pièce : sa boîte, moins le glissement en cours. */
function measure(room: HTMLElement): Measured[] {
  const out: Measured[] = [];
  for (const child of Array.from(room.children)) {
    if (!(child instanceof HTMLElement) || child.hasAttribute(SKIP)) continue;
    const rect = child.getBoundingClientRect();
    const dx = translateX(getComputedStyle(child).translate);
    out.push({ el: child, left: rect.left - dx, right: rect.right - dx, top: rect.top, bottom: rect.bottom });
  }
  return out;
}

/** Ce qu'on voit de la pièce : sa propre boîte si elle défile, la fenêtre sinon. */
function viewOf(room: HTMLElement): RoomSpan {
  if (room.scrollWidth <= room.clientWidth + 1) return { left: 0, right: window.innerWidth };
  const rect = room.getBoundingClientRect();
  return { left: Math.max(0, rect.left), right: Math.min(window.innerWidth, rect.right) };
}

function clear(room: HTMLElement, state: RoomState): void {
  if (state.timer !== null) clearTimeout(state.timer);
  room.removeAttribute(STATE);
  for (const name of [...SHIFT_VARS, ...Object.keys(VARS)]) room.style.removeProperty(name);
  state.item.removeAttribute(ANCHOR);
  for (const el of state.marked) {
    el.removeAttribute(SIDE);
    el.removeAttribute(GLIDE);
  }
  rooms.delete(room);
}

/** Pose les marques voulues, retire celles d'avant qui ne servent plus. */
function remark(previous: Set<HTMLElement>, glide: Set<HTMLElement>, sides: Map<HTMLElement, RoomSide>): Set<HTMLElement> {
  const marked = new Set<HTMLElement>([...glide, ...sides.keys()]);
  for (const el of previous) {
    if (marked.has(el)) continue;
    el.removeAttribute(SIDE);
    el.removeAttribute(GLIDE);
  }
  for (const el of marked) {
    if (glide.has(el)) el.setAttribute(GLIDE, "");
    else el.removeAttribute(GLIDE);
    const side = sides.get(el);
    if (side) el.setAttribute(SIDE, side);
    else el.removeAttribute(SIDE);
  }
  return marked;
}

/**
 * Ceux qui glissent : visibles, plus un de chaque côté, jamais la carte — et,
 * dans une grille de plusieurs lignes, seulement ceux de sa ligne.
 */
function glidingOf(items: Measured[], room: HTMLElement, item: HTMLElement, sides: Map<HTMLElement, RoomSide>): Set<HTMLElement> {
  const grid = room.getAttribute(ROOM) === "grid";
  const out = new Set<HTMLElement>();
  for (const index of glidingIndexes(items, viewOf(room))) {
    const el = items[index].el;
    if (el !== item && (!grid || sides.has(el))) out.add(el);
  }
  return out;
}

/**
 * Ouvre la pièce de la carte dont `anchor` est le visuel, pour une mini-carte
 * qui occupe `preview` (coordonnées de fenêtre). `null` sans pièce, ou quand
 * la mini-carte ne dépasse pas de sa carte.
 */
export function openPreviewRoom(anchor: HTMLElement, preview: RoomSpan): PreviewRoomHandle | null {
  const found = roomOf(anchor);
  if (!found) return null;
  const { room, item } = found;

  // LECTURES, d'un seul tenant.
  const items = measure(room);
  const anchorIndex = items.findIndex((entry) => entry.el === item);
  if (anchorIndex < 0) return null;
  const shifts = roomShifts(items[anchorIndex], preview);
  if (roomIsEmpty(shifts)) return null;
  const sides = new Map<HTMLElement, RoomSide>();
  if (room.getAttribute(ROOM) === "grid") {
    gridSides(items, anchorIndex).forEach((side, index) => {
      if (side) sides.set(items[index].el, side);
    });
  }
  const glide = glidingOf(items, room, item, sides);

  // ÉCRITURES. Une pièce encore occupée (l'aperçu d'avant revient) change de
  // main : ses cartes repartent de là où elles sont, vers leur nouvelle place.
  const previous = rooms.get(room);
  if (previous) {
    if (previous.timer !== null) clearTimeout(previous.timer);
    if (previous.item !== item) previous.item.removeAttribute(ANCHOR);
  }
  for (const [name, value] of Object.entries(VARS)) room.style.setProperty(name, value);
  room.style.setProperty("--room-left", `${shifts.left}px`);
  room.style.setProperty("--room-right", `${shifts.right}px`);
  item.setAttribute(ANCHOR, "");
  const state: RoomState = {
    owner: Symbol("preview-room"),
    item,
    marked: remark(previous?.marked ?? new Set(), glide, sides),
    timer: null,
  };
  room.setAttribute(STATE, "open");
  rooms.set(room, state);

  return {
    contains: (x, y) => {
      if (!room.isConnected) return false;
      const zone = room.getBoundingClientRect();
      // Une grille de plusieurs lignes ne fait bouger que la ligne de la carte.
      const band = sides.size > 0 ? item.getBoundingClientRect() : zone;
      return x >= zone.left && x <= zone.right && y >= band.top && y <= band.bottom;
    },
    close: () => closeRoom(room, state.owner),
  };
}

function closeRoom(room: HTMLElement, owner: symbol): void {
  const state = rooms.get(room);
  // Une autre mini-carte a repris la pièce : c'est elle qui la rendra.
  if (!state || state.owner !== owner) return;
  if (!room.isConnected) {
    clear(room, state);
    return;
  }
  // Ceux qu'on verra revenir : la rangée a pu défiler depuis l'ouverture.
  const sides = new Map<HTMLElement, RoomSide>();
  for (const el of state.marked) {
    const side = el.getAttribute(SIDE);
    if (side === "before" || side === "after") sides.set(el, side);
  }
  state.marked = remark(state.marked, glidingOf(measure(room), room, state.item, sides), sides);
  room.setAttribute(STATE, "closing");
  state.timer = setTimeout(() => {
    if (rooms.get(room)?.owner === owner) clear(room, state);
  }, CLEAR_AFTER_MS);
}
