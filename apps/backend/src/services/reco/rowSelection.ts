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
        relevance: e.breakdown.relevance,
        negative: e.breakdown.negative,
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

/** Plafond d'univers : la part du compte × 1,3, plus une marge de 5 %. */
const UNIVERSE_CAP_FACTOR = 1.3;
const UNIVERSE_CAP_MARGIN = 0.05;
const UNIVERSE_CAP_MAX_SHARE = 0.8;

/**
 * Emplacements que l'univers peut occuper AU PLUS dans une rangée mixte. Deux
 * animés se ressemblent toujours plus que deux films en prises de vues
 * réelles (genre, langue, mot-clé communs) : sans plafond, un compte à 21 %
 * d'animés en recevait neuf sur vingt en tête.
 */
export function universeCap(slots: number, share: number): number {
  if (slots <= 0) return 0;
  const ratio = Math.min(UNIVERSE_CAP_MAX_SHARE, share * UNIVERSE_CAP_FACTOR + UNIVERSE_CAP_MARGIN);
  return Math.min(slots, Math.max(universeQuota(slots, share), Math.round(slots * ratio)));
}

/**
 * Sélection d'une rangée mixte, bornée par l'univers : le quota d'ABORD (MMR
 * sur ses entrées, facettes communes ignorées), puis le MMR principal sur le
 * reste — où l'univers n'entre plus que jusqu'à son plafond, les mieux
 * classés d'abord. Taille exacte, quota garanti, plafond tenu.
 */
export function pickWithUniverseQuota(
  entries: PoolEntry[],
  slots: number,
  lambda: number,
  share: number
): PoolEntry[] {
  const quota = universeQuota(slots, share);
  const cap = universeCap(slots, share);
  const universe = entries.filter(isAnimeEntry);
  const anime = quota > 0 ? mmrPick(universe, quota, lambda, ANIME_COMMON_FACETS) : [];
  const taken = new Set(anime.map((e) => e.candidate.key));
  const extra = new Set(
    universe
      .filter((e) => !taken.has(e.candidate.key))
      .slice(0, Math.max(0, cap - anime.length))
      .map((e) => e.candidate.key)
  );
  const mainInput = entries.filter(
    (e) => !taken.has(e.candidate.key) && (!isAnimeEntry(e) || extra.has(e.candidate.key))
  );
  const main = mmrPick(mainInput, slots - anime.length, lambda);
  return interleaveEvenly(main, anime);
}
