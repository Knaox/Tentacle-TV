/**
 * Octave — lire D'UN GESTE ce que la recherche met en avant : le meilleur résultat (un titre, un album, un artiste,
 * une playlist) et les collections hors bibliothèque (album, playlist d'une extension). Les titres d'une
 * collection externe se lisent par la vue de l'extension, sous la MÊME clé que sa page (`useEntityQueries`,
 * `useExternalPlaylist`) : l'ouvrir ensuite est immédiat. Survol et appui préparent (comme les cartes de la
 * bibliothèque).
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchExternalAlbum, fetchExternalPlaylist } from "@tentacle-tv/api-client";
import type { ExternalMusicPlaylist, MusicAlbum, MusicTrack } from "@tentacle-tv/shared/music";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useCollectionPlayback } from "../actions/useCollectionPlayback";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { entityTarget } from "../octavePaths";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import type { TopResult } from "./searchLayout";

export type ExternalCollection = { kind: "album"; album: MusicAlbum } | { kind: "playlist"; playlist: ExternalMusicPlaylist };

/** La clé de cache d'une vue hors bibliothèque (celle de `useEntityQueries` pour l'album). */
export const externalViewKey = (kind: "album" | "playlist", target: string) => ["music", "external", kind, target] as const;

export function useExternalCollection() {
  const queryClient = useQueryClient();
  const provider = useOctaveProvider();
  const player = useOctavePlayer();

  const tracksOf = useCallback(
    async (ref: ExternalCollection): Promise<MusicTrack[]> => {
      const entity = ref.kind === "album" ? ref.album : ref.playlist;
      const target = entityTarget({ jellyfinId: null, external: entity.external });
      if (!entity.external || !target || !isFromProvider(provider, entity.external.pluginId) || !provider) return [];
      const id = entity.external.id;
      if (ref.kind === "album") {
        const album = await queryClient.fetchQuery({ queryKey: externalViewKey("album", target), queryFn: ({ signal }) => fetchExternalAlbum(provider, id, signal), staleTime: 60_000 });
        return album?.tracks ?? [];
      }
      const playlist = await queryClient.fetchQuery({ queryKey: externalViewKey("playlist", target), queryFn: ({ signal }) => fetchExternalPlaylist(provider, id, signal), staleTime: 60_000 });
      return playlist?.tracks ?? [];
    },
    [provider, queryClient],
  );

  const warm = useCallback(
    (ref: ExternalCollection, intent: "hover" | "press") => {
      const loading = tracksOf(ref).catch((): MusicTrack[] => []);
      if (intent === "press") void loading.then((tracks) => tracks[0] && player.prefetch([tracks[0]], "press"));
    },
    [player, tracksOf],
  );

  const play = useCallback(
    async (ref: ExternalCollection, shuffle = false) => {
      const tracks = await tracksOf(ref).catch((): MusicTrack[] => []);
      if (tracks.length === 0) return;
      const entity = ref.kind === "album" ? ref.album : ref.playlist;
      const contextId = `${ref.kind}:${entity.key}`;
      if (shuffle) queueActions.playShuffled(player, tracks, contextId);
      else player.playList(tracks, 0, contextId);
    },
    [player, tracksOf],
  );

  return { play, warm };
}

/** Le meilleur résultat : un titre se lit (suivi des titres d'à côté), une collection depuis son début. */
export function useTopPlayback(sideTracks: readonly MusicTrack[], contextId: string) {
  const player = useOctavePlayer();
  const library = useCollectionPlayback();
  const external = useExternalCollection();

  const play = useCallback(
    (top: TopResult) => {
      if (top.kind === "track") return player.playList([top.track, ...sideTracks], 0, contextId);
      if (top.kind === "artist") return sideTracks.length > 0 ? player.playList([...sideTracks], 0, contextId) : undefined;
      if (top.kind === "album") return top.album.jellyfinId ? void library.play({ kind: "album", id: top.album.jellyfinId }) : void external.play({ kind: "album", album: top.album });
      return void external.play({ kind: "playlist", playlist: top.playlist });
    },
    [contextId, external, library, player, sideTracks],
  );

  const warm = useCallback(
    (top: TopResult, intent: "hover" | "press") => {
      if (top.kind === "track") return player.prefetch([top.track], intent);
      if (top.kind === "artist") return sideTracks[0] ? player.prefetch([sideTracks[0]], intent) : undefined;
      if (top.kind === "album") return top.album.jellyfinId ? library.warm({ kind: "album", id: top.album.jellyfinId }, intent) : external.warm({ kind: "album", album: top.album }, intent);
      return external.warm({ kind: "playlist", playlist: top.playlist }, intent);
    },
    [external, library, player, sideTracks],
  );

  return { play, warm };
}
