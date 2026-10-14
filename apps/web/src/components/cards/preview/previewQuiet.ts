import { useSyncExternalStore } from "react";

/**
 * Le SILENCE après une mini-carte fermée : aucun aperçu ne repart tant que le
 * pointeur n'a pas vraiment bougé (ou qu'une touche, autre qu'Échap, n'a pas
 * été pressée).
 *
 * Pourquoi une porte GLOBALE, et pas celle de la carte fermée : une mini-carte
 * déborde sur ses voisines. Qu'elle disparaisse sous un pointeur immobile —
 * Échap, fin de la bande-annonce, défilement —, et Chromium fait survoler la
 * carte qui se trouve dessous par des évènements synthétiques. Cette voisine
 * lançait alors SA bande-annonce une seconde plus tard, sans le moindre geste
 * (recette du 14/10). Son survol ordinaire (plateau) reste permis : seul
 * l'aperçu attend un vrai mouvement.
 *
 * Un « vrai » mouvement : un `pointermove` à plus de `QUIET_SLOP_PX` de la
 * position où la porte s'est fermée — un mouvement synthétique de Chromium
 * garde la même position. Une touche autre qu'Échap est aussi un geste : au
 * clavier, Tab vers la carte suivante doit pouvoir montrer son aperçu.
 */
export const QUIET_SLOP_PX = 3;

export interface PreviewQuiet {
  isQuiet: () => boolean;
  /** Ferme la porte, à la dernière position connue du pointeur. */
  quiet: () => void;
  onPointerMove: (x: number, y: number) => void;
  onKeyDown: (key: string) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createPreviewQuiet(): PreviewQuiet {
  let closed = false;
  let lastX = Number.NaN;
  let lastY = Number.NaN;
  let anchorX = Number.NaN;
  let anchorY = Number.NaN;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const open = () => {
    if (!closed) return;
    closed = false;
    notify();
  };
  return {
    isQuiet: () => closed,
    quiet: () => {
      anchorX = lastX;
      anchorY = lastY;
      if (closed) return;
      closed = true;
      notify();
    },
    onPointerMove: (x, y) => {
      lastX = x;
      lastY = y;
      // Position inconnue à la fermeture (aucun mouvement encore vu) : le
      // premier mouvement compte.
      if (closed && (!Number.isFinite(anchorX) || Math.hypot(x - anchorX, y - anchorY) > QUIET_SLOP_PX)) open();
    },
    onKeyDown: (key) => {
      if (key !== "Escape") open();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** La porte de l'application, branchée sur la fenêtre dès l'import (cf. `useHoverGuard`). */
export const previewQuiet = createPreviewQuiet();

if (typeof window !== "undefined") {
  window.addEventListener("pointermove", (e) => previewQuiet.onPointerMove(e.clientX, e.clientY), {
    passive: true,
    capture: true,
  });
  window.addEventListener("keydown", (e) => previewQuiet.onKeyDown(e.key), { capture: true });
}

/** La porte globale est-elle fermée ? Un abonnement par session d'aperçu (carte survolée). */
export function usePreviewQuiet(): boolean {
  return useSyncExternalStore(previewQuiet.subscribe, previewQuiet.isQuiet, previewQuiet.isQuiet);
}

/**
 * Les sessions dont le moteur est sollicité (survol effectif) : une mini-carte
 * qui s'efface parce qu'une AUTRE prend la place (un seul aperçu à la fois)
 * ne ferme pas la porte — celle qui arrive doit pouvoir se montrer.
 */
const wanting = new Set<object>();

export function setPreviewWanting(holder: object, wants: boolean): void {
  if (wants) wanting.add(holder);
  else wanting.delete(holder);
}

export function otherPreviewWanting(holder: object): boolean {
  for (const other of wanting) if (other !== holder) return true;
  return false;
}
