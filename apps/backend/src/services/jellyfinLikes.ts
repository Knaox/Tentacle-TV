import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";
import { jellyfinAuthHeaders } from "./jellyfinAuth";

// Deux drapeaux des données utilisateur d'un item, que le serveur pose POUR
// LE COMPTE d'un utilisateur, avec la clé admin :
//   • « Ma liste » = le drapeau `Likes` — une série sortie automatiquement de
//     la liste qui revient à l'épisode suivant (watchlistAutoRetired), un
//     titre mis de côté avant son arrivée (watchlistPending) ;
//   • « J'aime » = le cœur, `IsFavorite` — un like donné dans « Affiner »
//     (services/swipe/swipeFavorites.ts), tout de suite ou à l'arrivée.
// Mêmes URL que le client (`useToggleWatchlist`, `useFavorite`), idempotentes
// côté Jellyfin.

async function call(path: string, method: "POST" | "DELETE"): Promise<boolean> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return false;
  try {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: jellyfinAuthHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function ratingPath(userId: string, itemId: string, likes: boolean): string {
  const query = likes ? "?likes=true" : "";
  return `/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}/Rating${query}`;
}

function favoritePath(userId: string, itemId: string): string {
  return `/Users/${encodeURIComponent(userId)}/FavoriteItems/${encodeURIComponent(itemId)}`;
}

/** Met l'item dans « Ma liste » de l'utilisateur. Vrai si Jellyfin a suivi. */
export function likeItemForUser(userId: string, itemId: string): Promise<boolean> {
  return call(ratingPath(userId, itemId, true), "POST");
}

/** Retire l'item de « Ma liste » de l'utilisateur. Vrai si Jellyfin a suivi. */
export function unlikeItemForUser(userId: string, itemId: string): Promise<boolean> {
  return call(ratingPath(userId, itemId, false), "DELETE");
}

/** Met le cœur (« J'aime ») de l'utilisateur sur l'item. Vrai si Jellyfin a suivi. */
export function favoriteItemForUser(userId: string, itemId: string): Promise<boolean> {
  return call(favoritePath(userId, itemId), "POST");
}

/** Retire le cœur de l'utilisateur. Vrai si Jellyfin a suivi. */
export function unfavoriteItemForUser(userId: string, itemId: string): Promise<boolean> {
  return call(favoritePath(userId, itemId), "DELETE");
}
