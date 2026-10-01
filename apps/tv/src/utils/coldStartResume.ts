import { judgeServerUserData, projectStop } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { PlaybackMarker } from "@tentacle-tv/tv-core/playback";

/**
 * À la relance à froid, la position d'arrêt notée dans le marqueur l'emporte-t-elle
 * sur la reprise relue chez Jellyfin ? Jellyfin 12.1 accuse parfois un arrêt sans
 * l'écrire (mesuré : arrêt d'arrière-plan accusé à 106 s, reprise restée à 89,8 s,
 * l'instantané du dernier début) — l'app tuée entre-temps rouvrait en arrière.
 *
 * Seulement si, à la fois :
 * - LA DATE GAGNE : aucune lecture du titre n'a commencé depuis le marqueur
 *   (`LastPlayedDate` du serveur antérieure) — sinon le serveur a raison ;
 * - la position diffère de plus de 3 s ;
 * - c'est une REPRISE selon la règle de Jellyfin (ni le tout début, ni la fin) :
 *   là, son verdict n'est jamais combattu.
 *
 * Rend la position à adopter (s), ou `null`.
 */
export function markerStopToAdopt(marker: PlaybackMarker, item: MediaItem): number | null {
  const position = marker.positionSeconds;
  if (position === undefined || !item.UserData) return null;
  const projection = projectStop({ positionSeconds: position, runtimeTicks: item.RunTimeTicks });
  if (!projection || projection.played !== false) return null;
  return judgeServerUserData({ ...projection, stoppedAt: marker.at }, item.UserData) === "older" ? position : null;
}
