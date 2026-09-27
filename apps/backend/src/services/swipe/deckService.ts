import { bootstrapPool, readPool } from "../reco/generationJob";
import { buildExclusions } from "../reco/candidates/exclusions";
import { getLibraryIndexMemo } from "../reco/candidates/libraryMemo";
import { tmdbConfigured } from "../tmdb/client";
import { mixDeck, shuffled } from "./deckMix";
import { hasArtwork, libraryCard, splitPool } from "./poolCards";
import { blockedKeys, countVerdicts, listSwipes } from "./swipeStore";
import type { SwipeCounts } from "./swipeStore";
import { topRatedCards, trendingCards } from "./tmdbLists";
import type { SwipeLang } from "./tmdbGenres";
import type { SwipeCard } from "./swipeTypes";

export interface DeckRequest {
  lang: SwipeLang;
  size: number;
  /** Cartes déjà dans la pile du client : jamais servies deux fois. */
  exclude: readonly string[];
}

export interface DeckResponse {
  cards: SwipeCard[];
  /** Faux : la pile ne vient que de la bibliothèque (aucune clé TMDB). */
  tmdbConfigured: boolean;
  counts: SwipeCounts;
}

/** Titres de bibliothèque « populaires » faute de TMDB : les mieux notés. */
const LIBRARY_POPULAR_MAX = 80;

/**
 * La pile d'un compte : goût (haut du pool), populaire (tendances TMDB ou
 * mieux notés de la bibliothèque), exploration (fond du pool, classiques
 * TMDB, bibliothèque tirée au hasard). Rien de jugé, rien de déjà connu (vu,
 * noté, favori, Ma liste…), rien que le client tient déjà.
 */
export async function buildDeck(userId: string, req: DeckRequest): Promise<DeckResponse> {
  const [library, pool, swipes] = await Promise.all([
    getLibraryIndexMemo(userId),
    readPool(userId),
    listSwipes(userId),
  ]);
  // Premier passage sans pool : la génération part en fond, la pile se sert
  // de la bibliothèque et des tendances en attendant.
  if (!pool) void bootstrapPool(userId).catch(() => undefined);

  const tmdb = tmdbConfigured();
  const [exclusions, trending, classics] = await Promise.all([
    buildExclusions(userId, library),
    trendingCards(req.lang, library),
    topRatedCards(req.lang, library),
  ]);

  const unseen = library.entries.filter((e) => !e.played && e.hasPrimaryImage);
  const libraryByRating = unseen
    .slice()
    .sort((a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0))
    .slice(0, LIBRARY_POPULAR_MAX)
    .map((e) => libraryCard(e, "popular"));
  const libraryRandom = shuffled(unseen).slice(0, 200).map((e) => libraryCard(e, "explore"));

  const { taste, deep } = pool
    ? splitPool(pool.entries, req.lang, library)
    : { taste: [] as SwipeCard[], deep: [] as SwipeCard[] };

  const exclude = new Set<string>([...req.exclude, ...exclusions.everywhere, ...blockedKeys(swipes, Date.now())]);
  const cards = mixDeck(
    {
      taste,
      popular: tmdb ? [...trending, ...libraryByRating] : libraryByRating,
      explore: shuffled([...shuffled(deep).slice(0, 120), ...classics, ...libraryRandom]),
    },
    { size: req.size, exclude, balanceLibrary: tmdb }
  ).filter((c) => hasArtwork(c, library));

  return { cards, tmdbConfigured: tmdb, counts: countVerdicts(swipes) };
}
