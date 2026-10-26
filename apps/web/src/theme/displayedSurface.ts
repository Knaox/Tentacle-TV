/**
 * La SURFACE affichée : Tentacle (films et séries) ou Octave (le mode musique). Chaque surface a son apparence
 * réglée à part, sur l'appareil (Damien, 26/10 : « je veux vraiment qu'on distingue les deux ») — le Liquid Glass
 * (`liquidGlassMode.ts`) et le thème (`colorScheme.ts`) lisent la surface pour choisir LEUR réglage.
 *
 * Posée par la coquille d'Octave à son montage (`useDisplayedSurface`), rendue à Tentacle à son démontage — une
 * page de Tentacle ouverte mode musique allumé (Réglages, un lien) est Tentacle. Au chargement, l'adresse le dit
 * déjà : une page `/octave/…` ne s'affiche jamais d'abord sous l'apparence de Tentacle.
 */

import { useLayoutEffect } from "react";

export type DisplayedSurface = "tentacle" | "octave";

/** Le préfixe des adresses d'Octave (`OCTAVE_BASE_PATH`), recopié : le thème ne dépend pas du mode musique. */
const OCTAVE_PATH = "/octave";

function initialSurface(): DisplayedSurface {
  try {
    const path = typeof window === "undefined" ? "" : window.location.pathname;
    return path === OCTAVE_PATH || path.startsWith(`${OCTAVE_PATH}/`) ? "octave" : "tentacle";
  } catch {
    return "tentacle";
  }
}

let surface: DisplayedSurface = initialSurface();
const listeners = new Set<() => void>();

export const getDisplayedSurface = (): DisplayedSurface => surface;

export function setDisplayedSurface(next: DisplayedSurface): void {
  if (next === surface) return;
  surface = next;
  for (const listener of listeners) listener();
}

export function subscribeDisplayedSurface(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Monté, cette surface est affichée ; démonté, Tentacle reprend. Effet de MISE EN PAGE : avant la peinture. */
export function useDisplayedSurface(next: DisplayedSurface): void {
  useLayoutEffect(() => {
    setDisplayedSurface(next);
    return () => setDisplayedSurface("tentacle");
  }, [next]);
}
