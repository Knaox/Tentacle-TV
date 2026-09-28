import { patchLibraryMemo, type LibraryEntryPatch } from "../../services/reco/candidates/libraryMemo";
import { broadcastToUser } from "../../services/wsManager";

/** Extract userId from proxy paths like Users/{userId}/FavoriteItems/... */
function extractUserIdFromPath(path: string): string | null {
  const match = path.match(/^Users\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Le drapeau de données utilisateur qu'une requête RÉUSSIE vient de poser ou
 * d'ôter : le cœur (FavoriteItems), « vu » (PlayedItems), Ma liste
 * (Items/…/Rating, `likes=true`). Null pour tout le reste.
 */
export function userDataPatchOf(
  path: string,
  method: string | undefined,
  query: unknown
): { userId: string; itemId: string; patch: LibraryEntryPatch } | null {
  if (method !== "POST" && method !== "DELETE") return null;
  const on = method === "POST";
  let m = /^Users\/([^/]+)\/FavoriteItems\/([^/]+)$/.exec(path);
  if (m) return { userId: m[1], itemId: m[2], patch: { isFavorite: on } };
  m = /^Users\/([^/]+)\/PlayedItems\/([^/]+)$/.exec(path);
  if (m) return { userId: m[1], itemId: m[2], patch: { played: on } };
  m = /^Users\/([^/]+)\/Items\/([^/]+)\/Rating$/.exec(path);
  if (m) {
    const likes = String((query as { likes?: unknown } | undefined)?.likes ?? "").toLowerCase() === "true";
    return { userId: m[1], itemId: m[2], patch: { inWatchlist: on && likes } };
  }
  return null;
}

/** Emit WS events based on successful Jellyfin proxy mutations. */
export function emitProxyEvents(wildcardPath: string, request: unknown): void {
  // L'index de la reco apprend le geste TOUT DE SUITE : un titre mis en
  // favori, vu ou dans Ma liste sort des recommandations à la requête
  // suivante, sans attendre le balayage que déclenche le WS Jellyfin.
  const req = request as { method?: string; query?: unknown };
  const userData = userDataPatchOf(wildcardPath, req.method, req.query);
  if (userData) patchLibraryMemo(userData.userId, userData.itemId, userData.patch);

  // FavoriteItems → watchlist changed
  if (/FavoriteItems/.test(wildcardPath)) {
    const userId = extractUserIdFromPath(wildcardPath);
    if (userId) broadcastToUser(userId, "watchlist");
  }

  // PlayedItems → watched status changed
  if (/PlayedItems/.test(wildcardPath)) {
    const userId = extractUserIdFromPath(wildcardPath);
    if (userId) {
      broadcastToUser(userId, "watched");
      broadcastToUser(userId, "continue_watching");
    }
  }

  // Playback stopped → continue watching + next up changed
  if (/Sessions\/Playing\/Stopped/.test(wildcardPath)) {
    const user = (request as { user?: { userId: string } }).user;
    if (user) {
      broadcastToUser(user.userId, "continue_watching");
      broadcastToUser(user.userId, "next_up");
    }
  }

  // Playback progress → continue watching (debounced by wsManager)
  if (/Sessions\/Playing\/Progress/.test(wildcardPath)) {
    const user = (request as { user?: { userId: string } }).user;
    if (user) {
      broadcastToUser(user.userId, "continue_watching");
    }
  }
}
