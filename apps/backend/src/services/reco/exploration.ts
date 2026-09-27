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
  /** Proximité aux titres aimés (classement à ancres) — absente d'un vieux pool. */
  relevance?: number;
  /** Ressemblance aux refus et abandons. */
  negative?: number;
}

/** Plancher de qualité de l'exploration « voisine » (note bayésienne /10). */
const ADJACENT_QUALITY_FLOOR = 0.62;
/** Au-delà, le candidat ressemble trop à ce que le compte a refusé. */
const ADJACENT_NEGATIVE_MAX = 0.3;
/** Part de la nouveauté dans le tri — le reste est la proximité aux goûts. */
const ADJACENT_NOVELTY_SHARE = 0.6;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Choisit les entrées d'exploration. Avec le classement à ancres : une
 * exploration VOISINE — un titre relié aux goûts (proximité au-dessus de la
 * médiane du panier), de bonne qualité, jamais proche d'un refus, et qui
 * emmène ailleurs (nouveauté d'abord). L'ancienne règle prenait le plus
 * éloigné du profil : la rangée montrait, par construction, ce que le compte
 * aimait le moins. Sans proximité (vieux pool) : l'ancienne règle.
 */
export function pickExplorationKeys(items: ExplorationItem[], count: number): string[] {
  const byKey = (a: ExplorationItem, b: ExplorationItem) => (a.key < b.key ? -1 : 1);
  if (!items.some((i) => i.relevance !== undefined)) {
    return items
      .filter((i) => i.quality >= EXPLORATION_QUALITY_FLOOR)
      .sort((a, b) => b.novelty - a.novelty || byKey(a, b))
      .slice(0, count)
      .map((i) => i.key);
  }
  const floor = median(items.map((i) => i.relevance ?? 0));
  const value = (i: ExplorationItem) =>
    ADJACENT_NOVELTY_SHARE * i.novelty + (1 - ADJACENT_NOVELTY_SHARE) * (i.relevance ?? 0);
  return items
    .filter(
      (i) =>
        i.quality >= ADJACENT_QUALITY_FLOOR &&
        (i.relevance ?? 0) >= floor &&
        (i.negative ?? 0) < ADJACENT_NEGATIVE_MAX
    )
    .sort((a, b) => value(b) - value(a) || byKey(a, b))
    .slice(0, count)
    .map((i) => i.key);
}
