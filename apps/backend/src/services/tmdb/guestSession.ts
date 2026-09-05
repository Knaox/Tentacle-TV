import { getPrisma } from "../db";
import { TmdbError, tmdbConfigured, tmdbFetch, tmdbWrite } from "./client";

/**
 * Guest sessions TMDB : les notes partent ANONYMEMENT, rattachées à une
 * session invitée propre à chaque compte Tentacle — jamais au compte TMDB
 * propriétaire de la clé d'API (d'où la clé en query param, pas de Bearer).
 *
 * Règles TMDB relevées : UNE session par utilisateur, réutilisée sur tous les
 * appareils (stockée en base) ; une session non utilisée dans les 24 h suivant
 * sa création est supprimée côté TMDB — d'où la revalidation par l'usage :
 * un 401 à la notation recrée la session et rejoue l'appel, une fois.
 */

interface GuestSessionResponse {
  success: boolean;
  guest_session_id: string;
  expires_at?: string;
}

async function createGuestSession(userId: string): Promise<string> {
  const res = await tmdbFetch<GuestSessionResponse>("/authentication/guest_session/new");
  if (!res.success || !res.guest_session_id) {
    throw new TmdbError("Création de guest session refusée", 500);
  }
  const prisma = getPrisma();
  const expiresAt = res.expires_at ? new Date(res.expires_at.replace(" UTC", "Z")) : null;
  await prisma.externalAccount.upsert({
    where: { jellyfinUserId_provider: { jellyfinUserId: userId, provider: "tmdb_guest" } },
    create: {
      jellyfinUserId: userId,
      provider: "tmdb_guest",
      guestSessionId: res.guest_session_id,
      expiresAt: Number.isNaN(expiresAt?.getTime()) ? null : expiresAt,
    },
    update: {
      guestSessionId: res.guest_session_id,
      expiresAt: Number.isNaN(expiresAt?.getTime()) ? null : expiresAt,
      createdAt: new Date(),
    },
  });
  return res.guest_session_id;
}

/** La session du compte — créée au premier besoin, réutilisée ensuite. */
export async function ensureGuestSession(userId: string): Promise<string> {
  const prisma = getPrisma();
  const row = await prisma.externalAccount.findUnique({
    where: { jellyfinUserId_provider: { jellyfinUserId: userId, provider: "tmdb_guest" } },
  });
  if (row?.guestSessionId) return row.guestSessionId;
  return createGuestSession(userId);
}

interface RatingTarget {
  mediaType: string; // "movie" | "series" | "episode"
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
}

function ratingPath(target: RatingTarget): string {
  if (target.mediaType === "movie") return `/movie/${target.tmdbId}/rating`;
  if (target.mediaType === "episode") {
    return `/tv/${target.tmdbId}/season/${target.seasonNumber}/episode/${target.episodeNumber}/rating`;
  }
  return `/tv/${target.tmdbId}/rating`;
}

async function withSession<T>(
  userId: string,
  call: (sessionId: string) => Promise<T>
): Promise<T> {
  const sessionId = await ensureGuestSession(userId);
  try {
    return await call(sessionId);
  } catch (err) {
    // Session périmée côté TMDB (non utilisée sous 24 h) : on la recrée et on
    // rejoue UNE fois. Toute autre erreur remonte au worker (backoff).
    if (err instanceof TmdbError && err.status === 401) {
      const fresh = await createGuestSession(userId);
      return call(fresh);
    }
    throw err;
  }
}

/** Pousse une note (échelle interne 1..10 = valeur TMDB directe, pas de 0). */
export async function pushTmdbRating(
  userId: string,
  target: RatingTarget,
  score: number
): Promise<void> {
  if (!tmdbConfigured()) throw new TmdbError("TMDB non configuré", 0);
  await withSession(userId, (sessionId) =>
    tmdbWrite(
      "POST",
      ratingPath(target),
      { guest_session_id: sessionId },
      { value: score }
    )
  );
}

/** Efface une note distante (retrait local en `delete_pending`). */
export async function deleteTmdbRating(userId: string, target: RatingTarget): Promise<void> {
  if (!tmdbConfigured()) throw new TmdbError("TMDB non configuré", 0);
  await withSession(userId, (sessionId) =>
    tmdbWrite("DELETE", ratingPath(target), { guest_session_id: sessionId })
  ).catch((err) => {
    // Note déjà absente côté TMDB : l'effacement est acquis.
    if (err instanceof TmdbError && err.status === 404) return;
    throw err;
  });
}
