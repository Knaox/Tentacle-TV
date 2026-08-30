/**
 * Une « scène » l'est-elle vraiment ? — les preuves, et le repêchage.
 *
 * Deux échecs symétriques, mesurés le 30.08 sur le même corpus :
 *
 *  1. **La fausse scène d'« Avatar : la voie de l'eau »** : son défilement de
 *     cast est si DENSE (colonnes multiples, texte serré) que la part de noir
 *     descend sous le seuil large — trois minutes de crédits classées
 *     « scène », et un bouton qui y envoyait. Relevé sur la zone : saturation
 *     maximale 0, part de noir minimale 0,62 — il n'y a AUCUNE image qui
 *     ressemble à une scène là-dedans.
 *  2. **Le stinger d'« Iron Man »** : la scène de Nick Fury est si SOMBRE
 *     (noir 0,74 → 1,00 sur trois vignettes sur cinq) que le lissage
 *     l'absorbait dans le générique — cinquante secondes de scène invisibles.
 *
 * D'où deux règles, calées sur les sept scènes réelles du corpus :
 *
 *  - **la preuve** : un passage n'est une scène que s'il porte au moins une
 *    vignette qu'aucun générique ne produit — saturée (≥ 30) ou franchement
 *    claire (noir ≤ 0,55). Toutes les vraies scènes en ont (la plus juste :
 *    Brave New World, noir 0,46) ; la zone d'Avatar, zéro.
 *  - **le repêchage** : quand le générique court jusqu'au bout sans scène, on
 *    cherche une preuve dans les deux dernières minutes ; d'elle, on remonte
 *    jusqu'au dernier VRAI défilement (deux vignettes noyau consécutives) —
 *    c'est le début du stinger. Iron Man : preuve à 125:50 (saturation 38),
 *    remontée jusqu'à 125:10, cinquante secondes retrouvées.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import { isCore, type FrameSample } from "./frameBlocks";
import { POST_CREDITS_MIN_MS } from "./segmentTypes";

/** Saturation qu'aucun générique n'atteint (Avatar : 0 ; Iron Man scène : 38). */
export const SCENE_SAT_MIN = 30;
/**
 * Part de noir sous laquelle une vignette est trop claire pour un générique.
 * 0,55 : la fausse zone d'Avatar ne descend pas sous 0,62, la vraie scène la
 * plus sombre du corpus (Brave New World) monte à 0,46.
 */
export const SCENE_DARK_MAX = 0.55;
/** Le stinger de fin de fichier se cherche dans cette fenêtre. */
export const SALVAGE_WINDOW_MS = 120_000;

/** La vignette qu'aucun générique ne produit. */
export function isSceneEvidence(sample: FrameSample): boolean {
  return sample.saturation >= SCENE_SAT_MIN || sample.dark <= SCENE_DARK_MAX;
}

/** Le passage [startMs, endMs) porte-t-il au moins une preuve de scène ? */
export function hasSceneEvidence(
  samples: readonly FrameSample[],
  startMs: number,
  endMs: number,
): boolean {
  return samples.some((s) => s.ms >= startMs && s.ms < endMs && isSceneEvidence(s));
}

/**
 * Le stinger collé à la fin du fichier, ou `null`.
 *
 * `samples` est la suite GARDÉE (triée, bornée à la durée). On prend la
 * DERNIÈRE preuve de la fenêtre, puis on remonte tant qu'on ne heurte pas
 * deux vignettes noyau consécutives — le dernier vrai défilement. Moins de
 * vingt secondes retrouvées : ce n'est pas une scène, on ne rend rien.
 */
export function salvageTailStinger(
  samples: readonly FrameSample[],
  runtimeMs: number,
): { sceneStartMs: number } | null {
  const windowStartMs = runtimeMs - SALVAGE_WINDOW_MS;
  let anchor = -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].ms < windowStartMs) break;
    if (isSceneEvidence(samples[i])) {
      anchor = i;
      break;
    }
  }
  if (anchor < 0) return null;

  let start = samples[anchor].ms;
  for (let i = anchor - 1; i >= 0; i--) {
    if (samples[i].ms < windowStartMs) break;
    // Deux noyaux d'affilée = le défilement lui-même : le stinger commence après.
    if (isCore(samples[i]) && i > 0 && isCore(samples[i - 1])) break;
    start = samples[i].ms;
  }
  if (runtimeMs - start < POST_CREDITS_MIN_MS) return null;
  return { sceneStartMs: start };
}
