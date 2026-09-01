import type { Candidate } from "../scoring/strategy";

/** Cible du pool avant classement (spec : 500 à 1000). */
export const POOL_MAX = 1000;

/** Rétro-remplit les champs annexes du gagnant depuis le doublon perdant :
 *  un titre à la fois en bibliothèque ET recommandé par une graine garde les
 *  DEUX vérités (jellyfinItemId pour naviguer, seedKey pour la rangée
 *  « Parce que vous avez aimé », visuels TMDB pour l'affichage). */
function backfill(winner: Candidate, loser: Candidate): void {
  winner.seedKey = winner.seedKey ?? loser.seedKey;
  winner.personKey = winner.personKey ?? loser.personKey;
  winner.posterPath = winner.posterPath ?? loser.posterPath;
  winner.backdropPath = winner.backdropPath ?? loser.backdropPath;
  winner.voteAverage = winner.voteAverage ?? loser.voteAverage;
  winner.voteCount = winner.voteCount ?? loser.voteCount;
  winner.popularity = winner.popularity ?? loser.popularity;
  winner.year = winner.year ?? loser.year;
}

/**
 * Union + déduplication par clé canonique. En cas de doublon, la version la
 * plus riche gagne : un jellyfinItemId (bibliothèque) prime — c'est lui qui
 * décide de la navigation — puis la première venue (l'ordre des sources est
 * choisi par l'appelant). Le perdant n'est plus jeté : ses champs annexes
 * comblent les trous du gagnant (deux graines différentes : la première gagne,
 * déterministe).
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
        const winner = { ...candidate };
        backfill(winner, existing);
        byKey.set(candidate.key, winner);
      } else {
        backfill(existing, candidate);
      }
    }
    if (byKey.size >= max) break;
  }
  return [...byKey.values()].slice(0, max);
}
