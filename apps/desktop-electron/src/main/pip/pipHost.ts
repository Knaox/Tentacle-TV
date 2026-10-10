/**
 * La fenêtre PiP ouverte, vue de la couche vidéo.
 *
 * Sous Linux, la colle KWin reconnaît la fenêtre PiP à son titre et y colle
 * mpv elle-même : la couche vidéo n'a rien à en savoir. Sur macOS, c'est la
 * SURFACE qui déplace la fenêtre de mpv d'un parent à l'autre
 * (`video/macosSurface.ts`) : elle doit apprendre qu'un PiP s'ouvre ou se
 * ferme, et le retrouver si la lecture commence alors qu'il est déjà ouvert —
 * un épisode suivant enchaîné dans le PiP crée une nouvelle surface.
 *
 * Un état de module, à une seule entrée : il n'y a jamais qu'un PiP.
 */

import type { BrowserWindow } from "electron";

type Listener = (pip: BrowserWindow | null) => void;

let current: BrowserWindow | null = null;
const listeners = new Set<Listener>();

/** La fenêtre PiP ouverte, ou `null`. */
export function currentPipWindow(): BrowserWindow | null {
  if (current !== null && current.isDestroyed()) current = null;
  return current;
}

/** La fabrique (`pipWindow.ts`) annonce la fenêtre née, puis `null` à sa fermeture. */
export function setPipWindow(next: BrowserWindow | null): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener(next);
}

/** S'abonne aux ouvertures et fermetures ; rend le désabonnement. */
export function onPipWindowChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
