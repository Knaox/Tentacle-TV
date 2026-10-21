import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

/**
 * La fenêtre change-t-elle de taille (bord tiré, plein écran) ?
 *
 * Pendant ce temps, une surface FIXE pose sa région SANS transition native :
 * avec une transition, la coquille rejoue CHAQUE changement de cadre au
 * ressort (`regions.ts`, lg-natif) — la vue native, gardée à sa distance du
 * haut par AppKit, glisserait alors vers le bas derrière une barre de lecture
 * qui, elle, a déjà sauté à sa place. Le fondu d'entrée et de sortie revient
 * une fois la taille posée.
 *
 * Le premier `resize` d'une rafale est rendu SYNCHRONE (`flushSync`) : il est
 * servi avant les rappels d'image où la primitive mesure, et la région part,
 * dès son premier cadre nouveau, sans transition.
 */

/** Calme après le dernier `resize` (le plein écran en enchaîne plusieurs). */
export const RESIZE_SETTLE_MS = 400;

let resizing = false;
let settle: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function onResize(): void {
  if (settle !== null) clearTimeout(settle);
  settle = setTimeout(() => {
    settle = null;
    resizing = false;
    emit();
  }, RESIZE_SETTLE_MS);
  if (resizing) return;
  resizing = true;
  flushSync(emit);
}

/** S'abonne aux débuts et aux fins de redimensionnement (exporté pour les tests). */
export function subscribeWindowResizing(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("resize", onResize);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("resize", onResize);
    if (settle !== null) clearTimeout(settle);
    settle = null;
    resizing = false;
  };
}

export const isWindowResizing = (): boolean => resizing;
const readOnServer = (): boolean => false;

export function useWindowResizing(): boolean {
  return useSyncExternalStore(subscribeWindowResizing, isWindowResizing, readOnServer);
}
