/**
 * Maximal Marginal Relevance — la sélection finale ne prend jamais le top-N
 * brut : à chaque insertion, un candidat est pénalisé à proportion de sa
 * ressemblance maximale avec les déjà retenus. Sans lui, une rangée est vingt
 * films du même genre à la suite.
 */

export interface MmrItem {
  key: string;
  score: number;
  facetKeys: ReadonlySet<string>;
}

/** Jaccard sur les ensembles de facettes — la mesure de redondance du MMR. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const key of small) if (large.has(key)) inter++;
  return inter / (a.size + b.size - inter);
}

/** λ par défaut du curseur « Sûr ↔ Aventureux » (0,7 = plutôt sûr). */
export const MMR_DEFAULT_LAMBDA = 0.7;

/**
 * Sélection gloutonne : MMR(c) = λ·score(c) − (1−λ)·max(sim(c, retenus)).
 * Déterministe à entrée égale (départage par clé). Rend les clés dans l'ordre
 * d'insertion — c'est l'ordre d'affichage de la rangée.
 */
export function selectWithMmr(items: MmrItem[], count: number, lambda: number): string[] {
  const pool = [...items].sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1));
  const selected: MmrItem[] = [];

  while (selected.length < count && pool.length > 0) {
    let bestIdx = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      let maxSim = 0;
      for (const s of selected) {
        const sim = jaccard(item.facetKeys, s.facetKeys);
        if (sim > maxSim) maxSim = sim;
      }
      const value = lambda * item.score - (1 - lambda) * maxSim;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  return selected.map((s) => s.key);
}
