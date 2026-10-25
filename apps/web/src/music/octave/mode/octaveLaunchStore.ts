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
import { isOctaveMode, subscribeOctaveMode } from "./octaveMode";

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

/** Après la première image d'Octave, le temps qu'il reste au repos avant de faire le travail de Tentacle retenu. */
const TENTACLE_IDLE_DELAY_MS = 2_500;

/**
 * Le travail de démarrage de TENTACLE qui n'a rien à faire dans Octave (la
 * relecture de son cache de requêtes, jusqu'à 3 Mo de JSON) : tout de suite
 * hors d'un lancement en Octave ; sinon au repos après la première image, ou
 * dès que Tentacle en a besoin (le mode s'éteint, sa première image) — une
 * fois. Rien n'est perdu si l'application se ferme avant : rien n'a été lu,
 * donc rien n'est réécrit.
 */
export function whenTentacleNeeded(run: () => void): void {
  if (!launchedInOctave) {
    run();
    return;
  }
  let done = false;
  let idle: number | null = null;
  const go = () => {
    if (done) return;
    done = true;
    listeners.delete(go);
    offMode();
    clearTimeout(timer);
    if (idle !== null && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
    run();
  };
  listeners.add(go);
  const offMode = subscribeOctaveMode(() => {
    if (!isOctaveMode()) go();
  });
  const timer = setTimeout(() => {
    if (typeof requestIdleCallback === "function") idle = requestIdleCallback(go, { timeout: 2_000 });
    else go();
  }, TENTACLE_IDLE_DELAY_MS);
}
