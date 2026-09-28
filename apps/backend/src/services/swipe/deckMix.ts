import type { DeckSource, SwipeCard } from "./swipeTypes";

export type DeckPools = Record<DeckSource, readonly SwipeCard[]>;

/**
 * Le motif d'une pile : 5 cartes « goût », 3 « populaires », 2 « exploration »
 * sur dix. Le goût domine (c'est lui qu'on affine), la popularité donne des
 * repères que tout le monde sait juger, l'exploration évite l'enfermement.
 */
export const DECK_PATTERN: readonly DeckSource[] = [
  "taste", "popular", "taste", "explore", "taste",
  "popular", "taste", "explore", "taste", "popular",
];

const FALLBACK_ORDER: readonly DeckSource[] = ["taste", "popular", "explore"];

export interface MixOptions {
  size: number;
  /** Clés à ne jamais servir : jugées, connues, déjà dans la pile du client. */
  exclude: ReadonlySet<string>;
  /** Alterner bibliothèque et hors bibliothèque (faux sans clé TMDB : tout
   *  est en bibliothèque, il n'y a rien à équilibrer). */
  balanceLibrary: boolean;
}

/**
 * Compose la pile : chaque place prend la source que le motif lui assigne, et
 * penche vers le côté (bibliothèque ou non) le moins servi jusque-là. Une
 * source tarie cède sa place aux autres — la pile ne rétrécit que quand TOUT
 * est épuisé. Jamais deux fois la même clé. Pure.
 */
export function mixDeck(pools: DeckPools, opts: MixOptions): SwipeCard[] {
  const used = new Set(opts.exclude);
  const out: SwipeCard[] = [];
  let inLibrary = 0;

  const take = (source: DeckSource, wantLibrary: boolean | null): SwipeCard | null => {
    for (const card of pools[source]) {
      if (used.has(card.key)) continue;
      if (wantLibrary !== null && !!card.jellyfinItemId !== wantLibrary) continue;
      return card;
    }
    return null;
  };

  for (let i = 0; out.length < opts.size; i++) {
    const preferred = DECK_PATTERN[i % DECK_PATTERN.length];
    const wantLibrary = opts.balanceLibrary ? inLibrary <= out.length - inLibrary : null;
    const others = FALLBACK_ORDER.filter((s) => s !== preferred);
    const card =
      take(preferred, wantLibrary) ??
      take(preferred, null) ??
      others.map((s) => take(s, wantLibrary)).find(Boolean) ??
      others.map((s) => take(s, null)).find(Boolean) ??
      null;
    if (!card) break;
    used.add(card.key);
    out.push(card);
    if (card.jellyfinItemId) inLibrary++;
  }
  return out;
}

/** Mélange de Fisher-Yates, au tirage injecté (tests déterministes). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
