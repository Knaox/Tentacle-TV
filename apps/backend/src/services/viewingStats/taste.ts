import { getPrisma, hasPrisma } from "../db";
import { parseAnchors } from "../reco/anchorStore";
import type { AnchorKind } from "../reco/anchors";
import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import type { ViewingStatsSignals, ViewingStatsTaste, ViewingStatsTasteReason, ViewingStatsTasteTitle } from "./contract";

/**
 * Le goût, lu dans le profil du moteur de recommandations — TEL QUEL : aucun
 * recalcul, aucune reconstruction déclenchée d'ici. Un profil absent (moteur
 * pas encore passé, personnalisation coupée) donne `available: false`, et la
 * page le dit au lieu d'inventer.
 */

export const LOVED_MAX = 10;

/** Les signaux qui disent « aimé », du plus parlant au plus discret. */
const REASONS: Array<[AnchorKind, ViewingStatsTasteReason]> = [
  ["superlike", "superlike"],
  ["favorite", "favorite"],
  ["rating", "rating"],
  ["like", "like"],
  ["swipe_like", "like"],
  ["rewatch", "rewatch"],
  ["series", "series"],
  ["completed", "completed"],
];

function reasonsOf(kinds: readonly AnchorKind[]): ViewingStatsTasteReason[] {
  const out: ViewingStatsTasteReason[] = [];
  for (const [kind, reason] of REASONS) if (kinds.includes(kind) && !out.includes(reason)) out.push(reason);
  return out;
}

const EMPTY_SIGNALS: ViewingStatsSignals = {
  ratings: 0, ratingAverage: null, superlikes: 0, likes: 0, dislikes: 0, likedPeople: 0, favorites: 0,
};

/** Un titre de bibliothèque retrouvé : son id Jellyfin et son nom. */
export interface LibraryTitle {
  id: string;
  name: string;
}

/**
 * @param libraryTitleOf  pont « movie:603 » / « tv:1399 » / « jf:<id> » →
 *                        titre de bibliothèque, bâti depuis l'historique et
 *                        les favoris (sans appel de plus)
 */
export async function readTaste(
  userId: string,
  favorites: number,
  libraryTitleOf: (key: string) => LibraryTitle | null
): Promise<ViewingStatsTaste> {
  if (!hasPrisma()) return { available: false, computedAt: null, animeShare: 0, loved: [], signals: { ...EMPTY_SIGNALS, favorites } };
  const prisma = getPrisma();
  const [profile, ratings, swipes, likes, likedPeople] = await Promise.all([
    prisma.tasteProfile.findUnique({
      where: { jellyfinUserId: userId },
      select: { anchors: true, animeShare: true, computedAt: true },
    }),
    prisma.userRating.findMany({
      where: { jellyfinUserId: userId, deletedAt: null },
      select: { mediaType: true, tmdbId: true, score: true },
    }),
    prisma.userSwipe.groupBy({ by: ["verdict"], where: { jellyfinUserId: userId }, _count: { _all: true } }),
    prisma.userLike.count({ where: { jellyfinUserId: userId } }),
    prisma.userLikedPerson.count({ where: { jellyfinUserId: userId } }),
  ]);

  // Notes : moyenne générale, et moyenne par titre (les saisons d'une série se fondent).
  const perTitle = new Map<string, { sum: number; n: number }>();
  let sum = 0;
  for (const r of ratings) {
    sum += r.score;
    const key = `${r.mediaType === "movie" ? "movie" : "tv"}:${r.tmdbId}`;
    const cur = perTitle.get(key) ?? { sum: 0, n: 0 };
    perTitle.set(key, { sum: cur.sum + r.score, n: cur.n + 1 });
  }
  const verdicts = new Map(swipes.map((s) => [s.verdict, s._count._all]));
  const signals: ViewingStatsSignals = {
    ratings: ratings.length,
    ratingAverage: ratings.length ? Math.round((sum / ratings.length) * 10) / 10 : null,
    superlikes: verdicts.get("superlike") ?? 0,
    likes: (verdicts.get("like") ?? 0) + likes,
    dislikes: verdicts.get("dislike") ?? 0,
    likedPeople,
    favorites,
  };

  const anchors = profile ? parseAnchors(profile.anchors) ?? [] : [];
  const lovedAnchors = anchors
    .filter((a) => a.weight > 0 && reasonsOf(a.kinds).length > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, LOVED_MAX);
  const metas = await getCachedMetaMany(
    lovedAnchors.filter((a) => a.tmdbId > 0).map((a) => ({ mediaType: a.mediaType, tmdbId: a.tmdbId }))
  );

  const loved: ViewingStatsTasteTitle[] = lovedAnchors.map((a) => {
    const meta = a.tmdbId > 0 ? metas.get(metaKey(a.mediaType, a.tmdbId)) : undefined;
    const rated = perTitle.get(a.key);
    const library = libraryTitleOf(a.key);
    return {
      key: a.key,
      mediaType: a.mediaType,
      tmdbId: a.tmdbId,
      title: a.title || meta?.title || library?.name || "",
      jellyfinId: library?.id ?? (a.key.startsWith("jf:") ? a.key.slice(3) : null),
      posterPath: meta?.posterPath ?? null,
      reasons: reasonsOf(a.kinds),
      rating: rated ? Math.round((rated.sum / rated.n) * 10) / 10 : null,
      hours: a.hours,
    };
  });

  return {
    available: !!profile,
    computedAt: profile ? profile.computedAt.toISOString() : null,
    animeShare: profile?.animeShare ?? 0,
    // Un titre sans nom ne se montre pas : une affiche muette n'apprend rien.
    loved: loved.filter((l) => l.title !== ""),
    signals,
  };
}
