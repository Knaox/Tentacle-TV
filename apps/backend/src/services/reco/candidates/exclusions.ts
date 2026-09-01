import { getPrisma } from "../../db";
import type { LibraryIndex } from "./libraryIndex";

/** mediaType du stockage des notes → vocabulaire canonique movie|tv. */
export function canonicalKey(mediaType: string, tmdbId: number): string {
  const t = mediaType === "series" || mediaType === "episode" || mediaType === "tv" ? "tv" : "movie";
  return `${t}:${tmdbId}`;
}

export interface ExclusionSets {
  /** Exclus de TOUTES les rangées : notés, vus, favoris, séries entamées,
   *  « ne plus proposer ». */
  everywhere: Set<string>;
}

/**
 * Exclusions systématiques du moteur. Un titre noté — même mal — ne se
 * re-propose pas (sa note a déjà façonné le profil) ; un « ne plus me
 * proposer » est définitif ; un titre vu en entier n'a rien à faire dans une
 * rangée de découverte ; un FAVORI n'est jamais une découverte (il reste une
 * GRAINE — cf. deriveSeeds) ; une série entamée est déjà engagée, elle vit
 * dans « Reprendre », pas dans les recommandations.
 */
export async function buildExclusions(
  userId: string,
  library: LibraryIndex
): Promise<ExclusionSets> {
  const prisma = getPrisma();
  const [ratings, feedback] = await Promise.all([
    prisma.userRating.findMany({
      where: { jellyfinUserId: userId, deletedAt: null },
      select: { mediaType: true, tmdbId: true },
    }),
    prisma.recommendationFeedback.findMany({
      where: { jellyfinUserId: userId },
      select: { itemKey: true },
    }),
  ]);

  const everywhere = new Set<string>();
  for (const r of ratings) everywhere.add(canonicalKey(r.mediaType, r.tmdbId));
  for (const f of feedback) everywhere.add(f.itemKey);
  for (const entry of library.entries) {
    if (entry.played || entry.isFavorite || entry.inProgress) everywhere.add(entry.key);
  }

  return { everywhere };
}
