import { getPrisma } from "../../db";
import { getCachedMetaMany, metaKey } from "../../tmdb/metaCache";
import { ratingSignalWeight, ratingStats, seriesEngagementWeight } from "../profileMath";
import { canonicalKey } from "./exclusions";
import type { LibraryIndex } from "./libraryIndex";
import type { SeedRef } from "./tmdbSource";

/** 20 à 30 titres-graines (spec) — on vise le milieu. */
const SEEDS_MAX = 24;
/** Séries SUIVIES admises comme graines : au plus dix, dès six épisodes vus.
 *  Sans plafond, vingt-cinq séries à six épisodes (0,71) évinceraient tous
 *  les favoris (0,7) — et /recommendations ne rendrait plus que des séries. */
const SERIES_SEEDS_MAX = 10;
const SERIES_SEED_MIN_EPISODES = 6;

/**
 * Les titres les plus FORTS du profil : notes hautes (normalisées sur
 * l'échelle personnelle), favoris, likes hors bibliothèque, et les séries
 * SUIVIES (force = engagement, cf. seriesEngagementWeight). Ce sont eux qui
 * nourrissent /recommendations, /similar et les rangées « Parce que vous avez
 * aimé [titre] ». Les signaux négatifs ne font jamais graine.
 */
export async function deriveSeeds(userId: string, library: LibraryIndex): Promise<SeedRef[]> {
  const prisma = getPrisma();
  const [ratings, likes] = await Promise.all([
    prisma.userRating.findMany({
      where: { jellyfinUserId: userId, deletedAt: null, mediaType: { in: ["movie", "series"] } },
      select: { mediaType: true, tmdbId: true, score: true, updatedAt: true },
    }),
    prisma.userLike.findMany({
      where: { jellyfinUserId: userId },
      select: { mediaType: true, tmdbId: true },
    }),
  ]);

  const { mean, stdDev } = ratingStats(ratings.map((r) => r.score));
  const byKey = new Map<string, SeedRef>();

  const push = (mediaType: "movie" | "tv", tmdbId: number, strength: number) => {
    if (strength <= 0) return;
    const key = `${mediaType}:${tmdbId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.strength = Math.max(existing.strength, strength);
      return;
    }
    byKey.set(key, {
      mediaType,
      tmdbId,
      title: library.byKey.get(key)?.name ?? "",
      strength,
    });
  };

  for (const r of ratings) {
    const mediaType = r.mediaType === "movie" ? "movie" : "tv";
    push(mediaType, r.tmdbId, ratingSignalWeight(r.score, mean, stdDev));
  }
  for (const entry of library.entries) {
    if (entry.isFavorite) push(entry.mediaType, entry.tmdbId, 0.7);
  }
  // Les séries les plus regardées : elles ouvrent enfin /recommendations aux
  // séries qu'on suit vraiment — animés compris — sans note ni favori.
  const followed = library.entries
    .filter((e) => e.mediaType === "tv" && e.playedEpisodes >= SERIES_SEED_MIN_EPISODES)
    .sort((a, b) => b.playedEpisodes - a.playedEpisodes || a.tmdbId - b.tmdbId)
    .slice(0, SERIES_SEEDS_MAX);
  for (const entry of followed) {
    push("tv", entry.tmdbId, seriesEngagementWeight(entry.playedEpisodes));
  }
  for (const like of likes) {
    const key = canonicalKey(like.mediaType, like.tmdbId);
    const [mediaType] = key.split(":") as ["movie" | "tv"];
    push(mediaType, like.tmdbId, 0.7);
  }

  const seeds = [...byKey.values()]
    .sort((a, b) => b.strength - a.strength || a.tmdbId - b.tmdbId)
    .slice(0, SEEDS_MAX);

  // Titre manquant (graine hors bibliothèque) : le cache de métadonnées le
  // fournit gratuitement quand il l'a — jamais d'appel réseau ici, et en une
  // seule lecture groupée.
  const mute = seeds.filter((s) => !s.title);
  if (mute.length > 0) {
    const metas = await getCachedMetaMany(mute);
    for (const seed of mute) {
      const meta = metas.get(metaKey(seed.mediaType, seed.tmdbId));
      if (meta) seed.title = meta.title;
    }
  }
  return seeds;
}
