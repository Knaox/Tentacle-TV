/**
 * Octave — une houle qui roule suit l'énergie de la musique (`oceanEnergyStore.ts`) :
 *
 * - la VITESSE par `updatePlaybackRate` sur SES animations (celles de
 *   `oceanMotion.css`) : le temps de chaque animation est gardé, rien ne saute,
 *   et le compositeur continue seul — aucune image de plus ;
 * - l'AMPLITUDE par une variable (`--ocean-amp`) que la feuille lit dans un
 *   `scaleY`, avec une courte transition par pas.
 *
 * Seulement à l'état `run` et sans mouvement réduit : sinon, aucun abonnement
 * (aucune mesure), et l'allure de toujours revient.
 */

import { useEffect } from "react";
import { usePlayerSelector } from "../player/OctavePlayerProvider";
import { NEUTRAL_DRIVE, type SwellDrive } from "./oceanEnergy";
import { oceanEnergy } from "./oceanEnergyStore";

/** Les animations de la houle (noms des `@keyframes` de `oceanMotion.css`). */
export const OCEAN_ANIMATIONS: ReadonlySet<string> = new Set([
  "ocSwellLeft",
  "ocSwellRight",
  "ocOceanShimmer",
  "ocOceanBob",
  "ocOceanDriftLeft",
  "ocOceanDriftRight",
]);

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Applique un état à une houle : sa variable d'amplitude, la vitesse de ses animations. */
export function applyDrive(element: HTMLElement, drive: SwellDrive): void {
  element.style.setProperty("--ocean-amp", drive.amplitude.toFixed(2));
  if (typeof element.getAnimations !== "function") return;
  for (const animation of element.getAnimations({ subtree: true })) {
    if ("animationName" in animation && OCEAN_ANIMATIONS.has((animation as CSSAnimation).animationName) && animation.playbackRate !== drive.rate) {
      animation.updatePlaybackRate(drive.rate);
    }
  }
}

export function useOceanEnergy(element: HTMLElement | null, running: boolean): void {
  const trackKey = usePlayerSelector((s) => s.current?.key ?? null);
  useEffect(() => {
    if (running) oceanEnergy.noteTrack(trackKey);
  }, [running, trackKey]);
  useEffect(() => {
    if (element === null || !running || prefersReducedMotion()) return;
    const off = oceanEnergy.subscribe((drive) => applyDrive(element, drive));
    return () => {
      off();
      applyDrive(element, NEUTRAL_DRIVE);
    };
  }, [element, running]);
}
