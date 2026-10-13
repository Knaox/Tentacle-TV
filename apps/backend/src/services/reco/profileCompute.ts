import type { TitleMeta } from "../tmdb/metaCache";
import { ANIME_UNIVERSE_KEY, facetsFromJellyfin, facetsFromTmdb } from "./facets";
import type { FacetEntry } from "./facets";
import { ratingStats, truncateVector } from "./profileMath";
import type { UserSignals } from "./signals";
import { buildAnchors } from "./anchors";
import type { Anchor, AnchorInputs, MeasuredViewing } from "./anchors";
import type { StoredAnchor } from "./anchorStore";
import { potentialsOf } from "./potentials";
import type { PotentialTitle } from "./potentials";
import { buildCentroid, consumptionShares, universeShareOf } from "./tasteModel";

/**
 * Le CALCUL du profil de goût, sans base ni réseau : les signaux d'un compte
 * entrent, le profil sort. `profileBuilder` l'alimente depuis la base et
 * Jellyfin puis l'écrit ; le banc de recommandation (test/reco-bench)
 * l'alimente depuis un persona — le même moteur, mot pour mot.
 */
const PROFILE_MAX_FACETS = 400;

export interface ProfileComputeInput {
  now: number;
  ratings: AnchorInputs["ratings"];
  likes: AnchorInputs["likes"];
  feedback: AnchorInputs["feedback"];
  swipes: NonNullable<AnchorInputs["swipes"]>;
  /** Ma liste d'un titre absent (watchlist_pending, drapeau « watchlist »). */
  pendingWatchlist: ReadonlyArray<{ mediaType: string; tmdbId: number }>;
  signals: UserSignals;
  measured: ReadonlyMap<string, MeasuredViewing>;
}

export interface ProfileComputeDeps {
  /** Fiches TMDB des ancres (cache, puis budget de fetchs). */
  resolveMeta: (anchors: readonly Anchor[]) => Promise<Map<string, TitleMeta>>;
  idfFor: (key: string) => number;
}

export interface ComputedProfile {
  vector: Record<string, number>;
  stored: StoredAnchor[];
  potentials: PotentialTitle[];
  signalCount: number;
  ratingMean: number;
  ratingStdDev: number;
  animeShare: number;
}

export async function computeTasteProfile(input: ProfileComputeInput, deps: ProfileComputeDeps): Promise<ComputedProfile> {
  const { signals } = input;
  const { mean, stdDev } = ratingStats(input.ratings.map((r) => r.score));
  const anchorSet = buildAnchors({
    now: input.now,
    ratings: input.ratings,
    likes: input.likes,
    feedback: input.feedback,
    swipes: input.swipes,
    favorites: signals.favorites,
    playedMovies: signals.playedMovies,
    resumable: signals.resumable,
    playedEpisodes: signals.playedEpisodes,
    seriesById: signals.seriesById,
    measured: input.measured,
  });
  const { anchors, itemByKey } = anchorSet;
  // Ma liste n'est pas un goût : ce qui n'y est que listé reste un potentiel.
  const potentials = potentialsOf(anchorSet, signals.watchlist, input.pendingWatchlist);

  const metaByKey = await deps.resolveMeta(anchors);
  const facetsByKey = new Map<string, FacetEntry[]>();
  const stored: StoredAnchor[] = [];
  for (const a of anchors) {
    const meta = metaByKey.get(a.key);
    const fallback = itemByKey.get(a.key);
    const facets = meta ? facetsFromTmdb(meta) : fallback ? facetsFromJellyfin(fallback) : [];
    if (facets.length === 0) continue;
    if (!a.title && meta) a.title = meta.title;
    facetsByKey.set(a.key, facets);
    // Les facettes de repli voyagent avec l'ancre : TMDB ne les connaît pas.
    stored.push(meta ? a : { ...a, facets });
  }

  const facetsOf = (a: Anchor) => facetsByKey.get(a.key) ?? null;
  const shares = consumptionShares(stored);
  const vector = truncateVector(buildCentroid(stored, facetsOf, deps.idfFor, shares), PROFILE_MAX_FACETS);
  // Part d'animé en TEMPS DE VISIONNAGE sur les ancres de CONSOMMATION : c'est
  // ce qu'on REGARDE qui décide, pas ce qu'on met en favori.
  const animeShare = universeShareOf(stored, (a) => (facetsOf(a) ?? []).some((f) => f.key === ANIME_UNIVERSE_KEY));
  // Compte de signaux (et non d'ancres) : les seuils froid/tiède du service
  // gardent leur sens — un titre vu, noté et en favori, c'est trois signaux.
  const signalCount = stored.reduce((s, a) => s + a.kinds.length, 0);
  return { vector, stored, potentials, signalCount, ratingMean: mean, ratingStdDev: stdDev, animeShare };
}
