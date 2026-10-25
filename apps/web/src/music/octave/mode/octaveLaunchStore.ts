/**
 * Octave — le lancement en Octave, décidé UNE fois au chargement (comme le
 * mode lui-même, `octaveMode.ts`) par la règle d'`octaveLaunch.ts`, et ce
 * qu'il RETIENT de Tentacle : tant que l'on n'est pas entré une première fois
 * dans Tentacle, ni « Qui regarde ? », ni les recouvrements de démarrage, ni
 * les préchargements des films (recommandations, mesure de débit, aperçus…).
 * La première image de Tentacle (accueil, réglages, lien profond) relâche
 * tout, une fois pour la session.
 *
 * Le miroir de la disponibilité (`tentacle_octave_launch`, stockage local) :
 * la dernière réponse connue, par serveur et par compte — aucun secret.
 * Clé de stockage : elle ne se renomme jamais.
 */

import { useSyncExternalStore } from "react";
import { octaveOwner } from "../cache/octaveOwner";
import { launchesInOctave, type OctaveLaunchMirror } from "./octaveLaunch";
import { isOctaveMode } from "./octaveMode";

export const OCTAVE_LAUNCH_MIRROR_KEY = "tentacle_octave_launch";

export function readOctaveLaunchMirror(): OctaveLaunchMirror | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(OCTAVE_LAUNCH_MIRROR_KEY) ?? "null") as Partial<OctaveLaunchMirror> | null;
    if (!parsed || typeof parsed.owner !== "string" || typeof parsed.available !== "boolean") return null;
    return { owner: parsed.owner, available: parsed.available };
  } catch {
    return null;
  }
}

/** La disponibilité d'Octave pour la session gardée, établie par le serveur : le prochain lancement la connaîtra. */
export function noteOctaveAvailability(available: boolean): void {
  const owner = octaveOwner();
  if (owner === null) return;
  const known = readOctaveLaunchMirror();
  if (known?.owner === owner && known.available === available) return;
  try {
    localStorage.setItem(OCTAVE_LAUNCH_MIRROR_KEY, JSON.stringify({ owner, available } satisfies OctaveLaunchMirror));
  } catch {
    /* stockage plein ou bloqué : le prochain lancement attendra le serveur */
  }
}

export function forgetOctaveLaunchMirror(): void {
  try {
    localStorage.removeItem(OCTAVE_LAUNCH_MIRROR_KEY);
  } catch {
    /* rien à oublier */
  }
}

const listeners = new Set<() => void>();
const launchMirror = readOctaveLaunchMirror();
let held = launchesInOctave(isOctaveMode(), octaveOwner(), launchMirror);
const launchedInOctave = held;

/** Le miroir tel qu'il était au lancement (la page d'arrivée en décide). */
export function launchOctaveMirror(): OctaveLaunchMirror | null {
  return launchMirror;
}

/** L'application s'est ouverte dans Octave (décision du lancement, figée). */
export function wasLaunchedInOctave(): boolean {
  return launchedInOctave;
}

/** Tentacle est-il encore retenu (lancement en Octave, aucune image de Tentacle depuis) ? */
export function isTentacleHeld(): boolean {
  return held;
}

/** La première image de Tentacle — ou Octave abandonné au lancement : tout ce qui attendait part. */
export function releaseTentacle(): void {
  if (!held) return;
  held = false;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTentacleHeld(): boolean {
  return useSyncExternalStore(subscribe, isTentacleHeld, () => false);
}
