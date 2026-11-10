/**
 * Le VERROU de la mise à jour, appliqué au DOM (règles : `updateLockRules.ts`).
 *
 * Verrouillé, plus rien derrière la pop-up ne répond :
 *  - le CLAVIER est filtré en phase de capture sur `window`, par un écouteur posé AU CHARGEMENT
 *    du module — avant ceux du lecteur, de l'omnibox ou du lecteur de bandes-annonces, qui se
 *    posent dans des effets. Tab tourne dans la pop-up, Entrée et Espace y activent un bouton
 *    sans se propager, tout le reste est avalé (Échap compris) ;
 *  - le POINTEUR est filtré de même : un clic qui passerait par-dessus le voile (une couche plus
 *    haute, une fenêtre de portail) n'atteint rien ;
 *  - tout ce qui n'est pas la pop-up devient INERTE (`inert`) : ni focus, ni lecteur d'écran ;
 *  - la LECTURE se met en pause et y reste (`useUpdateLockPause`, monté par les deux lecteurs).
 *
 * Deux sources le tiennent : la pop-up de l'application (`UpdateDialog`, Electron — Windows,
 * Linux) et la surcouche de la coquille CEF, qui l'annonce par l'évènement
 * `tentacle:update-lock` (`apps/desktop-cef/web/shim/update-overlay.js`). Le nom de cet
 * évènement traverse deux programmes : il ne se renomme pas.
 */

import { useSyncExternalStore } from "react";
import {
  childrenToInert, keyVerdict, nextFocusIndex, pointerBlocked, type UpdateLockReason,
} from "./updateLockRules";

/** La pop-up : tout ce qui est dessous reste vivant. */
export const UPDATE_LOCK_ZONE = "data-update-lock-zone";
/** Son panneau : le focus y tourne. */
export const UPDATE_LOCK_PANEL = "data-update-lock-panel";
/** L'évènement de la coquille CEF (`detail.locked`). */
export const UPDATE_LOCK_EVENT = "tentacle:update-lock";
/** L'élément hôte de la surcouche de la coquille CEF. */
const SHELL_OVERLAY_TAG = "TENTACLE-UPDATE";

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
const POINTER_EVENTS = ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "wheel", "touchstart"] as const;
const KEY_EVENTS = ["keydown", "keyup", "keypress"] as const;

const reasons = new Set<UpdateLockReason>();
const listeners = new Set<() => void>();
let release: (() => void) | null = null;

export function isUpdateLocked(): boolean {
  return reasons.size > 0;
}

export function subscribeUpdateLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Pose ou lève le verrou d'une source ; il tient tant qu'UNE source le tient. */
export function setUpdateLock(reason: UpdateLockReason, locked: boolean): void {
  const before = isUpdateLocked();
  if (locked) reasons.add(reason);
  else reasons.delete(reason);
  const now = isUpdateLocked();
  if (now === before) return;
  if (now) release = engageBackground();
  else { release?.(); release = null; }
  listeners.forEach((listener) => listener());
}

/** Le verrou, pour un composant (le lecteur, le PiP). */
export function useUpdateLocked(): boolean {
  return useSyncExternalStore(subscribeUpdateLock, isUpdateLocked, () => false);
}

function inside(event: Event, test: (element: Element) => boolean): boolean {
  return event.composedPath().some((node) => node instanceof Element && test(node));
}

const inZone = (event: Event): boolean => inside(event, (element) => element.hasAttribute(UPDATE_LOCK_ZONE));
const inShellOverlay = (event: Event): boolean => inside(event, (element) => element.tagName === SHELL_OVERLAY_TAG);

function onKey(event: Event): void {
  const key = (event as KeyboardEvent).key;
  const verdict = keyVerdict({ locked: isUpdateLocked(), key, inZone: inZone(event), inShellOverlay: inShellOverlay(event) });
  if (verdict === "pass") return;
  event.stopImmediatePropagation();
  if (verdict === "allow") return;
  event.preventDefault();
  if (verdict === "trap" && event.type === "keydown") cycleFocus((event as KeyboardEvent).shiftKey);
}

function onPointer(event: Event): void {
  if (!pointerBlocked({ locked: isUpdateLocked(), inZone: inZone(event), inShellOverlay: inShellOverlay(event) })) return;
  event.stopImmediatePropagation();
  event.preventDefault();
}

function cycleFocus(backwards: boolean): void {
  const panel = document.querySelector<HTMLElement>(`[${UPDATE_LOCK_PANEL}]`);
  if (!panel) return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.getClientRects().length > 0);
  const next = nextFocusIndex(items.length, items.indexOf(document.activeElement as HTMLElement), backwards);
  (next === null ? panel : items[next]).focus();
}

/**
 * Le filtre du CLAVIER d'une fenêtre : la principale au chargement du module, celle du PiP quand
 * elle s'ouvre. Posé d'avance et pour de bon — il ne coûte qu'un test tant que rien n'est verrouillé.
 */
export function guardWindow(view: Window): () => void {
  KEY_EVENTS.forEach((type) => view.addEventListener(type, onKey, true));
  return () => KEY_EVENTS.forEach((type) => view.removeEventListener(type, onKey, true));
}

/**
 * Le filtre du POINTEUR, lui, ne vit que le temps du verrou : un écouteur de molette non passif
 * posé en permanence sur `window` ferait attendre chaque défilement de l'application.
 */
function guardPointer(view: Window): () => void {
  POINTER_EVENTS.forEach((type) => view.addEventListener(type, onPointer, { capture: true, passive: false }));
  return () => POINTER_EVENTS.forEach((type) => view.removeEventListener(type, onPointer, true));
}

const holdsZone = (element: Element): boolean =>
  element.tagName === SHELL_OVERLAY_TAG || element.hasAttribute(UPDATE_LOCK_ZONE) || element.querySelector(`[${UPDATE_LOCK_ZONE}]`) !== null;

/** Rend l'arrière-plan inerte, y compris ce qui s'y ajoute ; rend ce qu'il faut pour le défaire. */
function engageBackground(): () => void {
  if (typeof document === "undefined") return () => {};
  const touched = new Set<HTMLElement>();
  const pass = () => {
    const children = Array.from(document.body.children) as HTMLElement[];
    const facts = children.map((child) => ({ tag: child.tagName, holdsZone: holdsZone(child), alreadyInert: child.inert === true }));
    for (const index of childrenToInert(facts)) {
      children[index].inert = true;
      touched.add(children[index]);
    }
    // La pop-up vient d'entrer dans un nœud déjà rendu inerte (un portail tardif) : on le rend.
    touched.forEach((element) => {
      if (holdsZone(element)) { element.inert = false; touched.delete(element); }
    });
  };
  pass();
  const active = document.activeElement;
  if (active instanceof HTMLElement && !active.closest(`[${UPDATE_LOCK_ZONE}]`)) active.blur();
  const observer = typeof MutationObserver === "function" ? new MutationObserver(pass) : null;
  // Les portails (menus, avis, autres feuilles) sont des enfants DIRECTS de `<body>` : pas de sous-arbre.
  observer?.observe(document.body, { childList: true });
  const releasePointer = guardPointer(window);
  return () => {
    releasePointer();
    observer?.disconnect();
    touched.forEach((element) => { element.inert = false; });
    touched.clear();
  };
}

if (typeof window !== "undefined") {
  guardWindow(window);
  window.addEventListener(UPDATE_LOCK_EVENT, (event) => {
    setUpdateLock("shell", (event as CustomEvent<{ locked?: boolean }>).detail?.locked === true);
  });
}
