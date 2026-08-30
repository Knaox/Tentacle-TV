import { buildQuery } from "./types";

/**
 * L'URL d'une planche trickplay — LA même sur toutes les plateformes.
 *
 * Elle vise le proxy Tentacle (`/items/…/trickplay/…`), qui la sert avec un
 * cache immuable d'un an : une planche téléchargée une fois l'est pour de bon,
 * et la carte de reprise comme l'aperçu de la barre de progression partagent
 * la même entrée de cache.
 *
 * Le jeton passe en `api_key` : `background-image`, `new Image()` et l'Image
 * de React Native ne savent pas poser d'en-tête. Sur le web, le cookie
 * `tentacle_token` suffit — le paramètre ne part que s'il y a un jeton.
 */
export function buildTrickplayTileUrl(
  baseUrl: string,
  accessToken: string | null,
  itemId: string,
  mediaSourceId: string,
  width: number,
  tileIndex: number,
): string {
  const params: Record<string, string> = { mediaSourceId };
  if (accessToken) params.api_key = accessToken;
  return `${baseUrl}/items/${itemId}/trickplay/${width}/${tileIndex}.jpg?${buildQuery(params)}`;
}
