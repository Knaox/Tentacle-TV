import { getConfigValue, getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";

/**
 * Décision produit : noter un FILM vaut visionnage — il passe « vu » dans
 * Jellyfin (état partagé par tous les clients, filtres « non vus » compris).
 * Les SÉRIES ne sont JAMAIS marquées : cocher tous les épisodes casserait
 * « Reprendre » et « À suivre » — leur note suffit à les exclure des
 * recommandations. Débrayable sans redéploiement : `reco_rate_marks_played`
 * = "false" dans server_config.
 */
export async function markMoviePlayedOnRating(
  userId: string,
  mediaType: string,
  tmdbId: number,
  jellyfinItemId?: string | null
): Promise<void> {
  if (mediaType !== "movie") return;
  if (getConfigValue("reco_rate_marks_played") === "false") return;
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return;

  let itemId = jellyfinItemId ?? null;
  if (!itemId) {
    const library = await getLibraryIndexMemo(userId);
    const entry = library.byKey.get(`movie:${tmdbId}`);
    if (!entry || entry.played) return; // hors bibliothèque ou déjà vu : rien
    itemId = entry.itemId;
  }

  // Clé admin + userId dans le chemin : l'état est attribué au bon compte.
  // Le POST déclenche UserDataChanged côté Jellyfin → poke → le moteur et le
  // mémo de bibliothèque se recalent tout seuls.
  await fetch(`${url}/Users/${userId}/PlayedItems/${encodeURIComponent(itemId)}`, {
    method: "POST",
    headers: { "X-Emby-Token": apiKey },
  });
}
