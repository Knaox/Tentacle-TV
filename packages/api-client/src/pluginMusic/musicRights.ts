/**
 * Les DROITS du compte face à l'extension de musique (route `rights` du contrat `music`) : ajouter à la
 * bibliothèque, limite du jour, garder hors ligne hors bibliothèque. Générique : rien de nommé. L'extension les
 * TIENT (ses routes refusent) ; le client ne fait que cacher. Pas de route (extension d'avant), réponse illisible
 * ou en échec : le comportement d'avant (`MUSIC_RIGHTS_BEFORE`) — le serveur refusera s'il le faut.
 */

import { MUSIC_RIGHTS_BEFORE, readMusicRights, type MusicRights } from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { musicRouteUrl, type MusicProvider } from "./musicProvider";

export const musicRightsKey = (pluginId: string | null) => ["music", "rights", pluginId] as const;

export async function fetchMusicRights(provider: MusicProvider, signal?: AbortSignal): Promise<MusicRights> {
  const route = provider.music.rights;
  if (!route) return MUSIC_RIGHTS_BEFORE;
  try {
    return readMusicRights(await tentacleApiFetch<unknown>(musicRouteUrl(provider, route), { signal })) ?? MUSIC_RIGHTS_BEFORE;
  } catch (error) {
    if (signal?.aborted) throw error;
    return MUSIC_RIGHTS_BEFORE;
  }
}

/** Un ajout vient d'être accepté : le reste du jour, un de moins (la relecture du serveur suit). */
export function afterOneAcquired(rights: MusicRights): MusicRights {
  return rights.remainingToday === null ? rights : { ...rights, remainingToday: Math.max(0, rights.remainingToday - 1) };
}
