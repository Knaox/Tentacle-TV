import { PREVIEW_EXIT_MS } from "../previewMotion";
import { previewQuiet } from "../previewQuiet";
import { gridSides, roomIsEmpty, roomShifts, type RoomSide, type RoomSpan } from "./roomGeometry";
import { ANCHOR, ROOM, STATE, clearRoomDom, glidingOf, measureRoom, remark, roomOf, sidesOf, writeShifts } from "./roomDom";
import "./previewRoom.css";

export { roomOffset } from "./roomDom";

/**
 * Les VOISINES qui s'écartent — l'état d'une pièce, sans un seul rendu React.
 *
 * Le conteneur des cartes se déclare « pièce » (`data-preview-room`) :
 * `row` — une rangée, ou UNE ligne de grille : l'ordre du document dit le
 * côté, et une carte montée pendant l'aperçu prend sa place d'elle-même ;
 * `grid` — plusieurs lignes : seule la ligne de la carte reçoit ses côtés.
 * Tout passe par des attributs et deux variables (`roomDom.ts`) que lit la
 * feuille ; au repos, il ne reste RIEN.
 *
 * Le PASSAGE d'une carte à sa voisine (recette du 14/10 : sept cartes
 * revenaient de 61 px puis repartaient de 61 px). Quand la mini-carte part
 * vers une voisine de la même pièce, la pièce ATTEND (`linger`) au lieu de
 * revenir : la voisine survolée la RÉCLAME tant que son aperçu est en route
 * (`claimPreviewRoom`), et quand il s'ouvre, la pièce passe DIRECTEMENT de
 * l'écartement de l'une à celui de l'autre. Sans réclamation (`ROOM_CLAIM_MS`),
 * sans aperçu (pas de bande-annonce, échec : la voisine lâche), ou passé
 * `ROOM_LINGER_MAX_MS`, retour normal.
 */

/** Le retour fini (plus une marge d'une image ou deux), la pièce est rendue. */
const CLEAR_AFTER_MS = PREVIEW_EXIT_MS + 60;
/** Le temps laissé à la voisine survolée pour réclamer la pièce qui attend. */
export const ROOM_CLAIM_MS = 200;
/**
 * Ce que la pièce attend au plus l'aperçu de la voisine : un aperçu « chaud »
 * se montre à 800 ms ; au-delà (demande froide), retour normal.
 */
export const ROOM_LINGER_MAX_MS = 1200;

type Timer = ReturnType<typeof setTimeout>;

interface RoomState {
  owner: symbol;
  item: HTMLElement;
  marked: Set<HTMLElement>;
  contains: (x: number, y: number) => boolean;
  /** Le retour engagé : la pièce est rendue à son échéance. */
  clearTimer: Timer | null;
  claims: Set<symbol>;
  /** La mini-carte est partie vers une voisine : la pièce attend. */
  lingering: boolean;
  lingerTimer: Timer | null;
  lingerUntil: number;
}

/** Une pièce n'a qu'un occupant : la dernière mini-carte qui l'a ouverte. */
const rooms = new WeakMap<HTMLElement, RoomState>();
const now = () => performance.now();

export interface PreviewRoomHandle {
  /** La zone où un retour fait glisser des cartes (coordonnées de fenêtre). */
  contains: (x: number, y: number) => boolean;
  /** Le point est-il sur la carte elle-même (sa place dans la pièce) ? */
  onAnchor: (x: number, y: number) => boolean;
  /** La mini-carte part : les voisines reviennent, au tempo de sa sortie. */
  close: () => void;
  /** La mini-carte part vers une voisine : la pièce attend qu'elle la réclame. */
  linger: () => void;
}

function stopTimers(state: RoomState): void {
  if (state.clearTimer !== null) clearTimeout(state.clearTimer);
  if (state.lingerTimer !== null) clearTimeout(state.lingerTimer);
  state.clearTimer = null;
  state.lingerTimer = null;
}

function clearRoom(room: HTMLElement, state: RoomState): void {
  stopTimers(state);
  clearRoomDom(room, state.item, state.marked);
  rooms.delete(room);
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
  const items = measureRoom(room);
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

  // ÉCRITURES. Une pièce encore occupée (l'aperçu d'avant revient, ou attend)
  // change de main : ses cartes vont DIRECTEMENT de là où elles sont à leur
  // nouvelle place.
  const previous = rooms.get(room);
  if (previous) {
    stopTimers(previous);
    if (previous.item !== item) previous.item.removeAttribute(ANCHOR);
  }
  writeShifts(room, shifts);
  item.setAttribute(ANCHOR, "");
  const contains = (x: number, y: number) => {
    if (!room.isConnected) return false;
    const zone = room.getBoundingClientRect();
    // Une grille de plusieurs lignes ne fait bouger que la ligne de la carte.
    const band = sides.size > 0 ? item.getBoundingClientRect() : zone;
    return x >= zone.left && x <= zone.right && y >= band.top && y <= band.bottom;
  };
  const state: RoomState = {
    owner: Symbol("preview-room"),
    item,
    marked: remark(previous?.marked ?? new Set(), glide, sides),
    contains,
    clearTimer: null,
    claims: new Set(),
    lingering: false,
    lingerTimer: null,
    lingerUntil: 0,
  };
  room.setAttribute(STATE, "open");
  rooms.set(room, state);

  return {
    contains,
    onAnchor: (x, y) => {
      const box = item.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    },
    close: () => returnRoom(room, state.owner),
    linger: () => lingerRoom(room, state.owner),
  };
}

/** Le RETOUR des voisines, au tempo de la sortie de la mini-carte. */
function returnRoom(room: HTMLElement, owner: symbol): void {
  const state = rooms.get(room);
  // Une autre mini-carte a repris la pièce : c'est elle qui la rendra.
  if (!state || state.owner !== owner || state.clearTimer !== null) return;
  stopTimers(state);
  state.lingering = false;
  if (!room.isConnected) {
    clearRoom(room, state);
    return;
  }
  // Le retour fait glisser des cartes sous un pointeur peut-être immobile : la
  // porte est TENUE le temps du glissement (`previewQuiet.hold`).
  const pointer = previewQuiet.pointer();
  if (pointer && state.contains(pointer.x, pointer.y)) previewQuiet.hold(CLEAR_AFTER_MS);
  // Ceux qu'on verra revenir : la rangée a pu défiler depuis l'ouverture.
  const sides = sidesOf(state.marked);
  state.marked = remark(state.marked, glidingOf(measureRoom(room), room, state.item, sides), sides);
  room.setAttribute(STATE, "closing");
  state.clearTimer = setTimeout(() => {
    if (rooms.get(room)?.owner === owner) clearRoom(room, state);
  }, CLEAR_AFTER_MS);
}

function armLinger(room: HTMLElement, state: RoomState, ms: number): void {
  if (state.lingerTimer !== null) clearTimeout(state.lingerTimer);
  const { owner } = state;
  state.lingerTimer = setTimeout(() => returnRoom(room, owner), Math.max(0, ms));
}

/** La pièce ATTEND : réclamée, jusqu'à `ROOM_LINGER_MAX_MS` ; sinon, `ROOM_CLAIM_MS`. */
function lingerRoom(room: HTMLElement, owner: symbol): void {
  const state = rooms.get(room);
  if (!state || state.owner !== owner || state.lingering || state.clearTimer !== null) return;
  state.lingering = true;
  state.lingerUntil = now() + ROOM_LINGER_MAX_MS;
  armLinger(room, state, state.claims.size > 0 ? ROOM_LINGER_MAX_MS : ROOM_CLAIM_MS);
}

/**
 * La voisine survolée RÉCLAME la pièce ouverte (ou qui attend) de sa carte,
 * tant que son propre aperçu est en route. Rend de quoi la lâcher : la
 * dernière qui lâche une pièce qui attend la fait revenir. `null` quand il
 * n'y a rien à réclamer (aucune pièce ouverte, ou elle revient déjà).
 */
export function claimPreviewRoom(anchor: HTMLElement): (() => void) | null {
  const found = roomOf(anchor);
  if (!found) return null;
  const { room } = found;
  const state = rooms.get(room);
  if (!state || state.clearTimer !== null || state.item === found.item) return null;
  const token = Symbol("claim");
  state.claims.add(token);
  if (state.lingering) armLinger(room, state, state.lingerUntil - now());
  const { owner } = state;
  return () => {
    const current = rooms.get(room);
    if (!current || current.owner !== owner) return;
    current.claims.delete(token);
    if (current.lingering && current.claims.size === 0) returnRoom(room, owner);
  };
}
