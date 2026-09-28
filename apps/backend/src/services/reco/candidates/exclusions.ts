import { getPrisma } from "../../db";
import type { LibraryEntry, LibraryIndex } from "./libraryIndex";

/** mediaType du stockage des notes → vocabulaire canonique movie|tv. */
export function canonicalKey(mediaType: string, tmdbId: number): string {
  const t = mediaType === "series" || mediaType === "episode" || mediaType === "tv" ? "tv" : "movie";
  return `${t}:${tmdbId}`;
}

export interface ExclusionSets {
  /** Exclus de TOUTES les rangées : notés, vus, favoris, likés, Ma liste
   *  (mise de côté comprise), séries entamées, « ne plus proposer ». */
  everywhere: Set<string>;
}

/**
 * Les titres de bibliothèque qu'un compte connaît déjà : vus, favoris, dans
 * Ma liste, séries entamées. Aucun n'est une découverte — ils restent des
 * GRAINES et des ancres du goût (cf. anchors.ts), jamais des propositions.
 */
export function libraryExclusionKeys(
  entries: ReadonlyArray<Pick<LibraryEntry, "key" | "played" | "isFavorite" | "inWatchlist" | "inProgress">>
): string[] {
  return entries
    .filter((e) => e.played || e.isFavorite || e.inWatchlist || e.inProgress)
    .map((e) => e.key);
}

/**
 * Exclusions systématiques du moteur. Un titre noté — même mal — ne se
 * re-propose pas (sa note a déjà façonné le profil) ; un « ne plus me
 * proposer » est définitif, un verdict de swipe aussi ; un titre vu en entier n'a rien à faire dans une
 * rangée de découverte ; un FAVORI ou un like hors bibliothèque n'est jamais
 * une découverte, un titre de Ma liste non plus (on l'a déjà choisi) ; une
 * série entamée est déjà engagée, elle vit dans « Reprendre ».
 */
export async function buildExclusions(
  userId: string,
  library: LibraryIndex
): Promise<ExclusionSets> {
  const everywhere = new Set<string>([
    ...(await accountExclusionKeys(userId)),
    ...libraryExclusionKeys(library.entries),
  ]);
  return { everywhere };
}

/**
 * Les exclusions portées par la BASE (notes, refus, likes hors
 * bibliothèque, verdicts d'Affiner, titres mis de côté) — une lecture, sans
 * balayage Jellyfin : le chemin chaud du service de page les relit à chaque
 * requête.
 */
export async function accountExclusionKeys(userId: string): Promise<string[]> {
  const prisma = getPrisma();
  const [ratings, feedback, likes, swipes, pending] = await Promise.all([
    prisma.userRating.findMany({
      where: { jellyfinUserId: userId, deletedAt: null },
      select: { mediaType: true, tmdbId: true },
    }),
    prisma.recommendationFeedback.findMany({
      where: { jellyfinUserId: userId },
      select: { itemKey: true },
    }),
    prisma.userLike.findMany({
      where: { jellyfinUserId: userId },
      select: { mediaType: true, tmdbId: true },
    }),
    // Un titre jugé dans « Affiner » a déjà façonné le goût ; « passé » non.
    prisma.userSwipe.findMany({
      where: { jellyfinUserId: userId, verdict: { not: "skip" } },
      select: { mediaType: true, tmdbId: true },
    }),
    // Mis de côté avant son arrivée — Ma liste d'une carte hors bibliothèque,
    // cœur d'Affiner en attente : déjà choisi, plus une découverte.
    prisma.watchlistPending.findMany({
      where: { jellyfinUserId: userId },
      select: { mediaType: true, tmdbId: true },
    }),
  ]);
  return [
    ...ratings.map((r) => canonicalKey(r.mediaType, r.tmdbId)),
    ...feedback.map((f) => f.itemKey),
    ...likes.map((l) => canonicalKey(l.mediaType, l.tmdbId)),
    ...swipes.map((sw) => canonicalKey(sw.mediaType, sw.tmdbId)),
    ...pending.map((p) => canonicalKey(p.mediaType, p.tmdbId)),
  ];
}
