import { MEDIA_ITEM_FIELDS, type useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { nativePlayerHeaders } from "./nativePlayerHeaders";

/** Au-delà, Jellyfin est tenu pour muet : le lecteur ne va pas attendre davantage. */
const DIRECT_ITEM_TIMEOUT_MS = 6000;

/** Le direct est configuré : un serveur média et le jeton Jellyfin de l'appareil. */
export function hasDirectItemPath(client: ReturnType<typeof useJellyfinClient>): boolean {
  const direct = client.getDirectStreaming?.();
  return !!direct?.mediaBaseUrl && !!direct.jellyfinToken;
}

/**
 * La fiche complète d'un titre, lue EN DIRECT chez Jellyfin, avec le jeton de
 * l'appareil — le recours du lecteur quand Tentacle ne répond plus et que le
 * cache n'a rien de jouable (`usePlayerItem`). Les mêmes champs que
 * `useMediaItem`.
 *
 * La forme DOCUMENTÉE (`/Items/{id}?userId=`) : le proxy de Tentacle traduit
 * `/Users/{u}/Items/{id}`, alias que Jellyfin peut retirer à sa prochaine
 * version majeure ; en direct, personne ne traduit.
 *
 * `null` en mode proxy (aucun jeton), sur un refus ou sans réponse.
 */
export async function fetchItemDirect(
  client: ReturnType<typeof useJellyfinClient>,
  userId: string,
  itemId: string,
): Promise<MediaItem | null> {
  const direct = client.getDirectStreaming?.();
  if (!direct?.mediaBaseUrl || !direct.jellyfinToken) return null;
  const query = `userId=${encodeURIComponent(userId)}&Fields=${MEDIA_ITEM_FIELDS}&EnableUserData=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECT_ITEM_TIMEOUT_MS);
  try {
    const res = await fetch(`${direct.mediaBaseUrl}/Items/${itemId}?${query}`, {
      // Jellyfin 12 nomme pistes et libellés dans la langue de l'interface.
      headers: { ...nativePlayerHeaders(client), ...(client.language ? { "Accept-Language": client.language } : {}) },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const item = (await res.json()) as MediaItem;
    return item?.Id === itemId ? item : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
