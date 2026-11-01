import type { PoolEntry } from "./generationJob";
import { dailyRandom } from "./seedRotation";

/**
 * Le TIRAGE du jour des rangées personnelles (« Pour vous », « Films pour
 * vous », « Animés », « Dans la bibliothèque », « À découvrir ») : sans lui,
 * elles montraient le même haut de classement tant que les signaux ne
 * bougeaient pas. Déterministe pour (compte, rangée, jour) : deux requêtes du
 * même jour, sur deux appareils, montrent la même chose. Il choisit QUELS
 * titres la sélection (MMR, quota d'univers) peut prendre ; l'ordre affiché
 * reste la correspondance décroissante (rowSelection.inDisplayOrder). Pur.
 */
export interface RowDraw {
  userId: string;
  dayStamp: string;
  /** Lassitude par clé (0..1, 1 = jamais montré) — cf. impressionFatigue. Absente : aucune. */
  fatigue?: ReadonlyMap<string, number>;
}

/** Fenêtre du tirage : le haut du classement, trois fois la rangée. */
export const DRAW_WINDOW_FACTOR = 3;
/** Titres tirés, une fois et demie la rangée : la sélection garde de quoi varier. */
export const DRAW_SHORTLIST_FACTOR = 1.5;
/** Poids du dernier de la fenêtre face au premier (1) : il garde sa chance. */
const DRAW_WEIGHT_FLOOR = 0.15;

/**
 * Les titres que la rangée de `size` places peut prendre aujourd'hui, dans
 * l'ordre du classement. Le score de chacun, normalisé, est multiplié par sa
 * lassitude : un titre trop montré sort de la fenêtre au profit des suivants.
 * Dans la fenêtre, un tirage pondéré sans remise (Efraimidis-Spirakis), le
 * poids croissant avec le carré du score : les plus forts restent majoritaires.
 */
export function dailyShortlist(entries: readonly PoolEntry[], size: number, rowKey: string, draw: RowDraw): PoolEntry[] {
  if (entries.length === 0 || size <= 0) return [...entries];
  const totals = entries.map((e) => e.breakdown.total);
  const min = Math.min(...totals);
  const spread = Math.max(...totals) - min || 1;
  const scored = entries.map((entry, index) => {
    const strength = (entry.breakdown.total - min) / spread;
    const fatigue = draw.fatigue?.get(entry.candidate.key) ?? 1;
    return { entry, index, strength, fatigue, rank: strength * fatigue };
  });
  const window = [...scored].sort((a, b) => b.rank - a.rank || a.index - b.index).slice(0, Math.ceil(size * DRAW_WINDOW_FACTOR));
  const count = Math.ceil(size * DRAW_SHORTLIST_FACTOR);
  if (window.length <= count) return window.sort((a, b) => a.index - b.index).map((s) => s.entry);
  const rand = dailyRandom(`${draw.userId}:${rowKey}`, draw.dayStamp);
  return window
    .map((s) => {
      const weight = (DRAW_WEIGHT_FLOOR + (1 - DRAW_WEIGHT_FLOOR) * s.strength ** 2) * Math.max(s.fatigue, 0.01);
      // Clé u^(1/w) : les `count` plus grandes forment un tirage pondéré sans remise.
      return { s, key: Math.pow(Math.max(rand(), 1e-12), 1 / weight) };
    })
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .sort((a, b) => a.s.index - b.s.index)
    .map(({ s }) => s.entry);
}

/** Le rétrécissement du jour d'une rangée, prêt pour `pickCapped` ; sans tirage : aucun. */
export function drawNarrow(draw: RowDraw | undefined, rowKey: string, size: number): ((list: PoolEntry[]) => PoolEntry[]) | undefined {
  return draw ? (list) => dailyShortlist(list, size, rowKey, draw) : undefined;
}
