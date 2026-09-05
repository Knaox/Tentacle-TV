/**
 * Quota d'exploration : 10 à 15 % des emplacements vont à des candidats de
 * score moyen dont les facettes sont PEU représentées dans le profil. C'est
 * ce qui casse la boucle de renforcement du moteur.
 */

import type { TasteVector } from "./scoring/strategy";

/** En deçà, une facette du profil est considérée comme non représentée. */
const NOVELTY_EPSILON = 0.01;

/** Plancher de qualité bayésienne (0..1) pour entrer par l'exploration. */
export const EXPLORATION_QUALITY_FLOOR = 0.55;

/**
 * Part d'exploration selon le curseur « Sûr ↔ Aventureux » (balance = λ×100).
 * Au défaut (70) : 10 %. Plus aventureux → jusqu'à ~25 %, plus sûr → 5 %.
 */
export function explorationQuota(balance: number): number {
  const quota = 0.1 + ((70 - balance) / 100) * 0.5;
  return Math.min(0.25, Math.max(0.05, quota));
}

/**
 * Nouveauté d'un candidat pour CE profil : la part de ses facettes que le
 * profil ne connaît pas (poids quasi nul). 1 = totalement hors des habitudes.
 */
export function noveltyOf(profile: TasteVector, facetKeys: Iterable<string>): number {
  let total = 0;
  let unseen = 0;
  for (const key of facetKeys) {
    total++;
    if (Math.abs(profile.facets[key] ?? 0) < NOVELTY_EPSILON) unseen++;
  }
  return total === 0 ? 0 : unseen / total;
}

export interface ExplorationItem {
  key: string;
  novelty: number;
  quality: number;
}

/**
 * Choisit les entrées d'exploration : qualité au-dessus du plancher, puis les
 * plus nouvelles d'abord (départage par clé — déterministe).
 */
export function pickExplorationKeys(items: ExplorationItem[], count: number): string[] {
  return items
    .filter((i) => i.quality >= EXPLORATION_QUALITY_FLOOR)
    .sort((a, b) => b.novelty - a.novelty || (a.key < b.key ? -1 : 1))
    .slice(0, count)
    .map((i) => i.key);
}
