import type { PoolEntry } from "./generationJob";
import { noveltyOf, pickExplorationKeys } from "./exploration";
import { ANIME_COMMON_FACETS, ANIME_MIN_SHARE, hasAnimeUniverse } from "./facets";
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

/** L'entrée porte-t-elle l'univers animé ? */
export function isAnimeEntry(entry: PoolEntry): boolean {
  return hasAnimeUniverse(entry.candidate.facets.map((f) => f.key));
}

/** Part d'univers plafonnée à la moitié des emplacements d'une rangée mixte. */
const UNIVERSE_QUOTA_MAX_SHARE = 0.5;
/** Plancher du quota dès le seuil franchi : un seul animé ressemble à un accident. */
const UNIVERSE_QUOTA_MIN = 2;

/**
 * Emplacements réservés à l'univers dans une rangée mixte : 0 sous le seuil ;
 * sinon la part du profil, entre deux et la moitié de la rangée.
 */
export function universeQuota(slots: number, share: number): number {
  if (slots <= 0 || !(share >= ANIME_MIN_SHARE)) return 0;
  const wanted = Math.round(slots * Math.min(share, UNIVERSE_QUOTA_MAX_SHARE));
  return Math.min(Math.floor(slots / 2), Math.max(UNIVERSE_QUOTA_MIN, wanted));
}

/**
 * Entrelacement régulier : les extras se répartissent sur la rangée (positions
 * ⌊(k+1)·n/(e+1)⌋) au lieu de s'empiler en fin, hors du premier écran.
 */
export function interleaveEvenly<T>(main: T[], extra: T[]): T[] {
  if (extra.length === 0) return [...main];
  const total = main.length + extra.length;
  const slots = new Set<number>();
  for (let k = 0; k < extra.length; k++) {
    slots.add(Math.floor(((k + 1) * total) / (extra.length + 1)));
  }
  const out: T[] = [];
  let m = 0;
  let e = 0;
  for (let i = 0; i < total; i++) {
    const takeExtra = e < extra.length && (slots.has(i) || m >= main.length);
    out.push(takeExtra ? extra[e++] : main[m++]);
  }
  return out;
}

/**
 * Sélection d'une rangée mixte avec quota d'univers : l'univers d'ABORD (MMR
 * sur ses entrées, facettes communes ignorées), puis le MMR principal sur le
 * reste pour les emplacements restants — taille exacte, quota garanti, et un
 * animé mieux classé peut en plus entrer par la voie principale. Part sous le
 * seuil : mmrPick tel quel, à l'identique.
 */
export function pickWithUniverseQuota(
  entries: PoolEntry[],
  slots: number,
  lambda: number,
  share: number
): PoolEntry[] {
  const quota = universeQuota(slots, share);
  if (quota === 0) return mmrPick(entries, slots, lambda);
  const anime = mmrPick(entries.filter(isAnimeEntry), quota, lambda, ANIME_COMMON_FACETS);
  const taken = new Set(anime.map((e) => e.candidate.key));
  const main = mmrPick(entries.filter((e) => !taken.has(e.candidate.key)), slots - anime.length, lambda);
  return interleaveEvenly(main, anime);
}
