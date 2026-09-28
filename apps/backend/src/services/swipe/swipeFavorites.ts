import { favoriteItemForUser, unfavoriteItemForUser } from "../jellyfinLikes";
import { getLibraryIndexMemo, patchLibraryMemo } from "../reco/candidates/libraryMemo";
import { dropPendingFlag, holdPendingFlag } from "../watchlistPending";
import { broadcastToUser } from "../wsManager";

/**
 * Le « J'aime » d'Affiner EST le cœur de la bibliothèque (IsFavorite) : un
 * like ou un coup de cœur le pose tout de suite quand le titre est là, sinon
 * il attend son arrivée dans watchlist_pending (drapeau « favorite ») — la
 * mécanique de « Ma liste à l'arrivée », arrivée et balayage compris.
 * Annuler le verdict, ou le changer pour un refus, retire ce que le like a
 * posé, et rien d'autre : un cœur qui existait avant le like reste.
 *
 * L'affinité Watch Together n'y passe jamais : ses verdicts vivent dans sa
 * propre table et ne touchent ni le goût ni la bibliothèque.
 */

type MediaType = "movie" | "tv";

export function isLikeVerdict(verdict: string | null | undefined): boolean {
  return verdict === "like" || verdict === "superlike";
}

/** Ce qu'un like a fait du cœur. */
export type SwipeFavoriteOutcome = "favorited" | "already" | "pending";

/** Les cœurs posés PAR un like, le temps qu'il reste annulable (la pile
 *  n'annule que ses derniers gestes, en mémoire du client). */
const setByLike = new Map<string, number>();
const SET_BY_LIKE_TTL_MS = 24 * 3600_000;

function markKey(userId: string, key: string): string {
  return `${userId}|${key}`;
}

function rememberSetByLike(userId: string, key: string, now: number): void {
  for (const [k, at] of setByLike) if (now - at >= SET_BY_LIKE_TTL_MS) setByLike.delete(k);
  setByLike.set(markKey(userId, key), now);
}

/** Pose le cœur d'un titre aimé dans Affiner — ou le met de côté jusqu'à son arrivée. */
export async function favoriteForSwipe(userId: string, mediaType: MediaType, tmdbId: number): Promise<SwipeFavoriteOutcome> {
  const key = `${mediaType}:${tmdbId}`;
  // L'index de la reco (celui qui compose la pile) dit si le titre est là,
  // son id, et si le cœur y est déjà — sans requête Jellyfin de plus.
  const index = await getLibraryIndexMemo(userId).catch(() => null);
  const entry = index?.byKey.get(key);
  if (!entry) {
    // Absent (ou arrivé depuis le dernier balayage) : l'arrivée, ou le
    // balayage, posera le cœur.
    await holdPendingFlag(userId, mediaType, tmdbId, "favorite");
    return "pending";
  }
  if (entry.isFavorite) return "already";
  if (!(await favoriteItemForUser(userId, entry.itemId))) {
    // Jellyfin muet : le titre est là, le balayage réessaiera.
    await holdPendingFlag(userId, mediaType, tmdbId, "favorite");
    return "pending";
  }
  patchLibraryMemo(userId, key, { isFavorite: true });
  rememberSetByLike(userId, key, Date.now());
  broadcastToUser(userId, "favorites");
  return "favorited";
}

/** Défait ce qu'un like a posé : le cœur en attente, ou celui qu'il a mis. */
export async function unfavoriteForSwipe(userId: string, mediaType: MediaType, tmdbId: number): Promise<void> {
  const key = `${mediaType}:${tmdbId}`;
  if (await dropPendingFlag(userId, mediaType, tmdbId, "favorite")) return;
  const mark = markKey(userId, key);
  if (!setByLike.has(mark)) return;
  setByLike.delete(mark);
  const index = await getLibraryIndexMemo(userId).catch(() => null);
  const entry = index?.byKey.get(key);
  if (!entry || !(await unfavoriteItemForUser(userId, entry.itemId))) return;
  patchLibraryMemo(userId, key, { isFavorite: false });
  broadcastToUser(userId, "favorites");
}

/**
 * Accorde le cœur au verdict, d'un état à l'autre : un like qui arrive le
 * pose, un like qui part (annulé, remplacé par un refus ou un « passer ») le
 * défait ; d'un like au coup de cœur, rien ne bouge. Ne lève jamais — le
 * verdict, lui, est déjà enregistré.
 */
export async function syncSwipeFavorite(
  userId: string,
  mediaType: MediaType,
  tmdbId: number,
  before: string | null,
  after: string | null
): Promise<void> {
  const wasLike = isLikeVerdict(before);
  const isLike = isLikeVerdict(after);
  if (wasLike === isLike) return;
  try {
    if (isLike) await favoriteForSwipe(userId, mediaType, tmdbId);
    else await unfavoriteForSwipe(userId, mediaType, tmdbId);
  } catch (err) {
    console.error(`[Swipe] cœur de ${mediaType}:${tmdbId} pour ${userId.slice(0, 8)}… non accordé :`, err);
  }
}

/** Isolation des tests. */
export function resetSwipeFavoritesForTests(): void {
  setByLike.clear();
}
