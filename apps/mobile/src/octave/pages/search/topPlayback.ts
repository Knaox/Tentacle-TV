/**
 * Octave mobile — « Lecture » du MEILLEUR RÉSULTAT, la règle du bureau (`search/useTopPlayback.ts`) : un titre se
 * lit suivi des titres d'à côté ; un artiste, ses titres d'à côté ; un ALBUM, l'album depuis son début (de la
 * bibliothèque ou d'une extension) ; une playlist d'extension, la playlist. Avant, le mobile lisait les titres
 * d'à côté quelle que soit la nature. Les vues se lisent sous la MÊME clé que leur page : l'ouvrir ensuite est
 * immédiat.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { externalEntityKey, fetchExternalAlbum, fetchExternalPlaylist, isFromMusicProvider, musicApi, musicKeys, type MusicProvider } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { TopResult } from "@tentacle-tv/shared/octave";
import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import { usePagesPlayer } from "../env/pagesPlayer";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { playFrom } from "../env/playFrom";

type Collection = Extract<TopResult, { kind: "album" | "playlist" }>;

function usable(provider: MusicProvider | null, pluginId: string): provider is MusicProvider {
  return isFromMusicProvider(provider, pluginId);
}

export function useTopPlayback(sideTracks: readonly MusicTrack[], contextId: string): (top: TopResult) => void {
  const player = usePagesPlayer();
  const provider = useOctavePagesProvider();
  const queryClient = useQueryClient();

  const tracksOf = useCallback(
    async (top: Collection): Promise<{ tracks: MusicTrack[]; context: string }> => {
      if (top.kind === "album" && top.album.jellyfinId) {
        const id = top.album.jellyfinId;
        const album = await queryClient.fetchQuery({ queryKey: musicKeys.album(id), queryFn: ({ signal }) => musicApi.album(id, signal), staleTime: 60_000 });
        return { tracks: album.tracks ?? [], context: `album:${id}` };
      }
      const entity = top.kind === "album" ? top.album : top.playlist;
      const target = entityTarget({ jellyfinId: null, external: entity.external });
      if (!entity.external || !target || !usable(provider, entity.external.pluginId)) return { tracks: [], context: "" };
      const id = entity.external.id;
      if (top.kind === "album") {
        const album = await queryClient.fetchQuery({ queryKey: externalEntityKey("album", target), queryFn: ({ signal }) => fetchExternalAlbum(provider, id, signal), staleTime: 60_000 });
        return { tracks: album?.tracks ?? [], context: `album:${target}` };
      }
      const playlist = await queryClient.fetchQuery({ queryKey: externalEntityKey("playlist", target), queryFn: ({ signal }) => fetchExternalPlaylist(provider, id, signal), staleTime: 60_000 });
      return { tracks: playlist?.tracks ?? [], context: `playlist:${target}` };
    },
    [provider, queryClient],
  );

  return useCallback(
    (top: TopResult) => {
      // La liste d'à côté s'ouvre déjà sur le titre en tête : il n'entre qu'une fois dans la file.
      if (top.kind === "track") return playFrom(player, [top.track, ...sideTracks.filter((t) => t.key !== top.track.key)], 0, contextId);
      if (top.kind === "artist") return playFrom(player, sideTracks, 0, contextId);
      void tracksOf(top)
        .then(({ tracks, context }) => tracks.length > 0 && playFrom(player, tracks, 0, context))
        .catch(() => undefined);
    },
    [contextId, player, sideTracks, tracksOf],
  );
}
