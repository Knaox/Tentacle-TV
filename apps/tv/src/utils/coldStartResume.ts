import type { QueryClient } from "@tanstack/react-query";
import { fetchSeriesWatchState, judgeServerUserData, projectStop, type NextEpisodeResult } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { seriesResumeAfterStop, type PlaybackMarker } from "@tentacle-tv/tv-core/playback";

/**
 * À la relance à froid, la position d'arrêt notée dans le marqueur l'emporte-t-elle
 * sur la reprise relue chez Jellyfin ? Jellyfin 12.1 accuse parfois un arrêt sans
 * l'écrire (mesuré : arrêt d'arrière-plan accusé à 106 s, reprise restée à 89,8 s,
 * l'instantané du dernier début) — la fiche rouverte proposait de reprendre en arrière.
 *
 * Seulement si, à la fois :
 * - le marqueur a été écrit au passage en ARRIÈRE-PLAN : le lecteur s'est mis
 *   en pause, sa position est exacte. Mort À L'ÉCRAN, il peut retarder de 30 s
 *   (son rythme) sur la file des rapports, qui rejoue la sienne (≤ 2 s) avant
 *   la relecture : c'est elle qui fait foi ;
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
  if (marker.phase !== "background" || position === undefined || !item.UserData) return null;
  const projection = projectStop({ positionSeconds: position, runtimeTicks: item.RunTimeTicks });
  if (!projection || projection.played !== false) return null;
  return judgeServerUserData({ ...projection, stoppedAt: marker.at }, item.UserData) === "older" ? position : null;
}

/** Ce qu'il faut du client Jellyfin pour relire l'état d'une série. */
interface EpisodesFetcher {
  fetch(path: string): Promise<unknown>;
}

/**
 * L'arrêt adopté d'un ÉPISODE jusqu'à la fiche de sa SÉRIE : « Reprendre S1 · E5 »,
 * sa jauge et sa saison viennent de l'état de visionnage, que Jellyfin calcule
 * sur la reprise qu'il n'a pas écrite. Relu (la clé même de `useSeriesWatchState`),
 * corrigé par l'arrêt (`seriesResumeAfterStop`), posé avant l'ouverture de la
 * fiche — elle le trouve frais et ne le redemande pas. Serveur muet : rien, la
 * fiche le redemandera ; jamais un verdict inventé sans celui du serveur.
 */
export async function settleSeriesResume(
  qc: QueryClient,
  client: EpisodesFetcher,
  userId: string,
  seriesId: string,
  stop: { episode: MediaItem; positionTicks: number; stoppedAt: number },
): Promise<void> {
  const queryKey = ["series-watch-state", seriesId];
  const server = await qc
    .fetchQuery<NextEpisodeResult>({
      queryKey,
      staleTime: 60_000,
      retry: false,
      queryFn: () => fetchSeriesWatchState(client, userId, seriesId),
    })
    .catch(() => undefined);
  if (server) qc.setQueryData<NextEpisodeResult>(queryKey, seriesResumeAfterStop(server, stop));
}
