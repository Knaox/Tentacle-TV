import type { Candidate } from "../scoring/strategy";

/** Cible du pool avant classement (spec : 500 à 1000). */
export const POOL_MAX = 1000;

/**
 * Union + déduplication par clé canonique. En cas de doublon, la version la
 * plus riche gagne : un jellyfinItemId (bibliothèque) prime — c'est lui qui
 * décide de la navigation — puis la première venue (l'ordre des sources est
 * choisi par l'appelant).
 */
export function assemblePool(sources: Candidate[][], max = POOL_MAX): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const source of sources) {
    for (const candidate of source) {
      const existing = byKey.get(candidate.key);
      if (!existing) {
        byKey.set(candidate.key, candidate);
        continue;
      }
      if (!existing.jellyfinItemId && candidate.jellyfinItemId) {
        byKey.set(candidate.key, { ...candidate });
      }
    }
    if (byKey.size >= max) break;
  }
  return [...byKey.values()].slice(0, max);
}
