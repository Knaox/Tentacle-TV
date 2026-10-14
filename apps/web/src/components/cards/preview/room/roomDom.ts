import { PREVIEW_ENTER_EASE, PREVIEW_ENTER_MS, PREVIEW_EXIT_EASE, PREVIEW_EXIT_MS } from "../previewMotion";
import { glidingIndexes, translateX, type RoomSide, type RoomSpan } from "./roomGeometry";

/**
 * Le DOM d'une pièce (`previewRoom.ts`) : ce qu'on y lit — la place de chaque
 * élément, ce qu'on voit de la rangée — et les marques qu'on y pose pour
 * `previewRoom.css`. Aucune décision ici : seulement des lectures et des
 * écritures, groupées par l'appelant (toutes les lectures, puis toutes les
 * écritures).
 */

export const ROOM = "data-preview-room";
export const STATE = "data-room";
export const ANCHOR = "data-room-anchor";
export const SIDE = "data-room-side";
export const GLIDE = "data-room-glide";
const SKIP = "data-room-skip";

/** Le tempo de la mini-carte, posé sur la pièce (`previewMotion.ts` : aucune copie). */
export const ROOM_VARS: Record<string, string> = {
  "--room-enter-ms": `${PREVIEW_ENTER_MS}ms`,
  "--room-enter-ease": PREVIEW_ENTER_EASE,
  "--room-exit-ms": `${PREVIEW_EXIT_MS}ms`,
  "--room-exit-ease": PREVIEW_EXIT_EASE,
};
const SHIFT_VARS = ["--room-left", "--room-right"];

export interface Measured {
  el: HTMLElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** La pièce d'une carte, et l'élément de la pièce qui la porte. */
export function roomOf(anchor: HTMLElement): { room: HTMLElement; item: HTMLElement } | null {
  const room = anchor.closest<HTMLElement>(`[${ROOM}]`);
  if (!room) return null;
  let item: HTMLElement | null = anchor;
  while (item && item.parentElement !== room) item = item.parentElement;
  return item ? { room, item } : null;
}

/**
 * Le glissement EN COURS de la carte dans sa pièce (px) : une voisine encore
 * écartée par la pièce d'une autre carte. 0 hors d'une pièce.
 */
export function roomOffset(anchor: HTMLElement): number {
  const found = roomOf(anchor);
  return found ? translateX(getComputedStyle(found.item).translate) : 0;
}

/** La place de chaque élément DANS la pièce : sa boîte, moins le glissement en cours. */
export function measureRoom(room: HTMLElement): Measured[] {
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

/**
 * Ceux qui glissent : visibles, plus un de chaque côté, jamais la carte — et,
 * dans une grille de plusieurs lignes, seulement ceux de sa ligne.
 */
export function glidingOf(items: Measured[], room: HTMLElement, item: HTMLElement, sides: Map<HTMLElement, RoomSide>): Set<HTMLElement> {
  const grid = room.getAttribute(ROOM) === "grid";
  const out = new Set<HTMLElement>();
  for (const index of glidingIndexes(items, viewOf(room))) {
    const el = items[index].el;
    if (el !== item && (!grid || sides.has(el))) out.add(el);
  }
  return out;
}

/** Les côtés posés sur des éléments marqués (grille de plusieurs lignes). */
export function sidesOf(marked: Iterable<HTMLElement>): Map<HTMLElement, RoomSide> {
  const sides = new Map<HTMLElement, RoomSide>();
  for (const el of marked) {
    const side = el.getAttribute(SIDE);
    if (side === "before" || side === "after") sides.set(el, side);
  }
  return sides;
}

/** Pose les marques voulues, retire celles d'avant qui ne servent plus. */
export function remark(previous: Set<HTMLElement>, glide: Set<HTMLElement>, sides: Map<HTMLElement, RoomSide>): Set<HTMLElement> {
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

/** Pose le tempo et les glissements sur la pièce. */
export function writeShifts(room: HTMLElement, shifts: { left: number; right: number }): void {
  for (const [name, value] of Object.entries(ROOM_VARS)) room.style.setProperty(name, value);
  room.style.setProperty("--room-left", `${shifts.left}px`);
  room.style.setProperty("--room-right", `${shifts.right}px`);
}

/** Retire tout : la pièce rendue, il ne reste ni attribut, ni variable. */
export function clearRoomDom(room: HTMLElement, item: HTMLElement, marked: Iterable<HTMLElement>): void {
  room.removeAttribute(STATE);
  for (const name of [...SHIFT_VARS, ...Object.keys(ROOM_VARS)]) room.style.removeProperty(name);
  item.removeAttribute(ANCHOR);
  for (const el of marked) {
    el.removeAttribute(SIDE);
    el.removeAttribute(GLIDE);
  }
}
