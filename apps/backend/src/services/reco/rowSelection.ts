import type { PoolEntry } from "./generationJob";
import { noveltyOf, pickExplorationKeys } from "./exploration";
import { selectWithMmr } from "./mmr";
import type { TasteVector } from "./scoring/strategy";

/** Le MMR travaille sur le haut du pool — au-delà, c'est du bruit coûteux. */
export const MMR_INPUT_MAX = 150;

/** Sélection MMR sur le haut des entrées (ordre = ordre d'affichage). `ignoreKeys`
 *  retire des facettes du jaccard — la diversité au sein d'un univers. */
export function mmrPick(
  entries: PoolEntry[],
  count: number,
  lambda: number,
  ignoreKeys?: ReadonlySet<string>
): PoolEntry[] {
  const input = entries.slice(0, MMR_INPUT_MAX);
  const byKey = new Map(input.map((e) => [e.candidate.key, e]));
  const picked = selectWithMmr(
    input.map((e) => ({
      key: e.candidate.key,
      score: e.breakdown.total,
      facetKeys: new Set(e.candidate.facets.map((f) => f.key)),
    })),
    count,
    lambda,
    ignoreKeys
  );
  return picked.map((key) => byKey.get(key)!).filter(Boolean);
}

/** Les entrées d'exploration : qualité au plancher, nouveauté d'abord. */
export function explorationPicks(
  eligible: PoolEntry[],
  profile: TasteVector,
  count: number,
  alreadyPicked: ReadonlySet<string>
): PoolEntry[] {
  const byKey = new Map(eligible.map((e) => [e.candidate.key, e]));
  const picked = pickExplorationKeys(
    eligible
      .filter((e) => !alreadyPicked.has(e.candidate.key))
      .map((e) => ({
        key: e.candidate.key,
        novelty: noveltyOf(profile, e.candidate.facets.map((f) => f.key)),
        quality: e.breakdown.quality,
      })),
    count
  );
  return picked.map((key) => byKey.get(key)!).filter(Boolean);
}
