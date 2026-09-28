import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";

// « Ma liste » vit chez Jellyfin : c'est le drapeau `Likes` des données
// utilisateur d'un item. Le serveur le pose POUR LE COMPTE d'un utilisateur,
// avec la clé admin, dans deux cas : une série sortie automatiquement de la
// liste qui revient à l'épisode suivant (watchlistAutoRetired), et un titre
// mis de côté avant son arrivée (watchlistPending). Même URL que le client
// (`useToggleWatchlist`), idempotente côté Jellyfin.

async function rate(userId: string, itemId: string, method: "POST" | "DELETE"): Promise<boolean> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return false;
  const query = method === "POST" ? "?likes=true" : "";
  try {
    const res = await fetch(
      `${url}/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}/Rating${query}`,
      { method, headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(10_000) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Met l'item dans « Ma liste » de l'utilisateur. Vrai si Jellyfin a suivi. */
export function likeItemForUser(userId: string, itemId: string): Promise<boolean> {
  return rate(userId, itemId, "POST");
}

/** Retire l'item de « Ma liste » de l'utilisateur. Vrai si Jellyfin a suivi. */
export function unlikeItemForUser(userId: string, itemId: string): Promise<boolean> {
  return rate(userId, itemId, "DELETE");
}
