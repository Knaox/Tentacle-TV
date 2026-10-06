import { cachedBitrate, remeasureBitrate, type BitrateMeasureOptions } from "./bitrateMeasure";
import type { JellyfinClient } from "../jellyfin";

/**
 * La mesure du débit, rattachée au TITRE qui l'a utilisée — pour que
 * l'épisode suivant ne joue jamais sur la photographie du précédent.
 *
 * La mesure garde son cache de 10 min, mais elle « appartient » au premier
 * titre qui la lit. Un AUTRE titre (l'épisode suivant, un film relancé
 * depuis l'accueil) la refait : la connexion a pu changer, et la précédente
 * avait peut-être été prise pendant que le lecteur remplissait sa réserve.
 * C'est elle qui décide si l'on revient en lecture directe.
 *
 * Le démarrage attend la nouvelle mesure au plus `REMEASURE_WAIT_MS`. Au-delà,
 * le lien porte moins de ~10 Mb/s (3 Mo pas encore arrivés) : l'ancienne
 * mesure, déjà basse, sert de repli — jamais de blocage, jamais de
 * renégociation en cours de lecture.
 *
 * La mesure prise à l'accueil n'appartient à aucun titre : le premier lu la
 * prend telle quelle, sans attendre.
 */

export const REMEASURE_WAIT_MS = 2_500;

let owner: string | null = null;
const pending = new Set<string>();
const listeners = new Set<() => void>();

const notify = () => { for (const listener of listeners) listener(); };

/** Le titre doit-il attendre une nouvelle mesure avant de choisir son flux ? */
export function bitratePendingFor(itemId: string): boolean {
  return pending.has(itemId) || (owner !== null && owner !== itemId);
}

/** Écoute la fin d'une remesure (les crochets React s'y abonnent). */
export function subscribeItemBitrate(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * La mesure qui vaut pour ce titre : celle en cache s'il en est le
 * propriétaire (ou s'il est le premier lu), sinon une NOUVELLE, attendue au
 * plus `maxWaitMs` — l'ancienne servant de repli.
 */
export async function bitrateForItem(
  client: JellyfinClient,
  itemId: string,
  options: BitrateMeasureOptions = {},
  maxWaitMs = REMEASURE_WAIT_MS,
): Promise<number | null> {
  if (owner === null || owner === itemId) {
    owner = itemId;
    return cachedBitrate(client, options);
  }
  const previous = cachedBitrate(client, options);
  owner = itemId;
  pending.add(itemId);
  try {
    const fresh = await Promise.race([
      remeasureBitrate(client, options),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), maxWaitMs)),
    ]);
    return fresh === undefined ? previous : fresh ?? previous;
  } finally {
    pending.delete(itemId);
    notify();
  }
}

/** Pour les tests : oublie le propriétaire de la mesure. */
export function resetItemBitrateForTests(): void {
  owner = null;
  pending.clear();
}
