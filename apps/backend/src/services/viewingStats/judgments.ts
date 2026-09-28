import { getPrisma, hasPrisma } from "../db";
import type { Judgments } from "./dataset";

/**
 * Ce que le compte a dit des titres, lu UNE fois par calcul : ses notes, ses
 * verdicts d'« Affiner », ses « J'aime » hors bibliothèque. Ils servent deux
 * fois — classer ses films et résumer ses avis (« Vos avis ») —, d'où une
 * seule lecture. Ma liste n'y entre pas : ce n'est pas un avis.
 */

/** Les comptes de « Vos avis », tirés des mêmes lignes. */
export interface JudgmentCounts {
  ratings: number;
  /** Moyenne des notes, sur 10 ; null sans note. */
  ratingAverage: number | null;
  superlikes: number;
  /** « J'aime » d'« Affiner » et titres aimés hors bibliothèque. */
  likes: number;
  dislikes: number;
  likedPeople: number;
}

export interface LoadedJudgments {
  judgments: Judgments;
  counts: JudgmentCounts;
}

/** La clé du moteur d'un titre noté ou jugé : « movie:603 », « tv:1399 ». */
export const judgmentKey = (mediaType: string, tmdbId: number): string =>
  `${mediaType === "movie" ? "movie" : "tv"}:${tmdbId}`;

const round1 = (n: number) => Math.round(n * 10) / 10;

type Verdict = "superlike" | "like" | "dislike";
const VERDICTS: ReadonlySet<string> = new Set<Verdict>(["superlike", "like", "dislike"]);

/** Assemble les jugements — pur, pour les tests. */
export function foldJudgments(
  ratings: ReadonlyArray<{ mediaType: string; tmdbId: number; score: number }>,
  swipes: ReadonlyArray<{ mediaType: string; tmdbId: number; verdict: string }>,
  likes: ReadonlyArray<{ mediaType: string; tmdbId: number }>,
  likedPeople: number,
  favorites: Set<string>
): LoadedJudgments {
  const perTitle = new Map<string, { sum: number; n: number }>();
  let sum = 0;
  for (const r of ratings) {
    sum += r.score;
    const key = judgmentKey(r.mediaType, r.tmdbId);
    const cur = perTitle.get(key) ?? { sum: 0, n: 0 };
    perTitle.set(key, { sum: cur.sum + r.score, n: cur.n + 1 });
  }

  // Un « J'aime » hors bibliothèque, puis le verdict d'« Affiner », plus précis, par-dessus.
  const verdicts = new Map<string, Verdict>();
  for (const l of likes) verdicts.set(judgmentKey(l.mediaType, l.tmdbId), "like");
  const tally = { superlike: 0, like: 0, dislike: 0 };
  for (const s of swipes) {
    if (!VERDICTS.has(s.verdict)) continue;
    const verdict = s.verdict as Verdict;
    verdicts.set(judgmentKey(s.mediaType, s.tmdbId), verdict);
    tally[verdict] += 1;
  }

  return {
    judgments: {
      ratings: new Map([...perTitle].map(([key, r]) => [key, round1(r.sum / r.n)])),
      verdicts,
      favorites,
    },
    counts: {
      ratings: ratings.length,
      ratingAverage: ratings.length ? round1(sum / ratings.length) : null,
      superlikes: tally.superlike,
      likes: tally.like + likes.length,
      dislikes: tally.dislike,
      likedPeople,
    },
  };
}

/** Les jugements d'un compte ; une base absente n'en donne aucun (les favoris Jellyfin restent). */
export async function loadJudgments(userId: string, favorites: Set<string>): Promise<LoadedJudgments> {
  if (!hasPrisma()) return foldJudgments([], [], [], 0, favorites);
  const prisma = getPrisma();
  const [ratings, swipes, likes, likedPeople] = await Promise.all([
    prisma.userRating.findMany({
      where: { jellyfinUserId: userId, deletedAt: null },
      select: { mediaType: true, tmdbId: true, score: true },
    }),
    prisma.userSwipe.findMany({
      where: { jellyfinUserId: userId, verdict: { in: [...VERDICTS] } },
      select: { mediaType: true, tmdbId: true, verdict: true },
    }),
    prisma.userLike.findMany({ where: { jellyfinUserId: userId }, select: { mediaType: true, tmdbId: true } }),
    prisma.userLikedPerson.count({ where: { jellyfinUserId: userId } }),
  ]);
  return foldJudgments(ratings, swipes, likes, likedPeople, favorites);
}
