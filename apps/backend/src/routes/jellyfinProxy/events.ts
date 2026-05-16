import { broadcastToUser } from "../../services/wsManager";

/** Extract userId from proxy paths like Users/{userId}/FavoriteItems/... */
function extractUserIdFromPath(path: string): string | null {
  const match = path.match(/^Users\/([^/]+)\//);
  return match ? match[1] : null;
}

/** Emit WS events based on successful Jellyfin proxy mutations. */
export function emitProxyEvents(wildcardPath: string, request: unknown): void {
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
