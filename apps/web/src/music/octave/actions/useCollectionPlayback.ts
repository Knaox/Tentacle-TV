/**
 * Octave — lire un album ou une playlist depuis sa carte, sans l'ouvrir.
 * Ses titres se lisent dès le SURVOL de la carte (requête mise en cache) : au
 * clic, ils sont là, et la barre se met à jour aussitôt.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { libraryApi } from "../data/libraryApi";
import { octaveKeys } from "../data/libraryQueries";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

export type CollectionRef = { kind: "album"; id: string } | { kind: "playlist"; id: string };

export function useCollectionPlayback() {
  const queryClient = useQueryClient();
  const user = useUserId();
  const player = useOctavePlayer();

  const tracksOf = useCallback(
    async (ref: CollectionRef): Promise<MusicTrack[]> => {
      if (ref.kind === "album") {
        const album = await queryClient.fetchQuery({ queryKey: octaveKeys.album(user, ref.id), queryFn: () => libraryApi.album(ref.id), staleTime: 60_000 });
        return album.tracks ?? [];
      }
      const playlist = await queryClient.fetchQuery({ queryKey: octaveKeys.playlist(user, ref.id), queryFn: () => libraryApi.playlist(ref.id), staleTime: 15_000 });
      return playlist.entries.map((e) => e.track);
    },
    [queryClient, user],
  );

  /** Survol ou appui : la liste se lit (mise en cache), et à l'appui son premier titre prépare sa source. */
  const warm = useCallback(
    (ref: CollectionRef, intent: "hover" | "press") => {
      const loading = tracksOf(ref).catch((): MusicTrack[] => []);
      if (intent === "press") void loading.then((tracks) => tracks[0] && player.prefetch([tracks[0]], "press"));
    },
    [player, tracksOf],
  );

  const play = useCallback(
    async (ref: CollectionRef, shuffle = false) => {
      const tracks = await tracksOf(ref);
      if (tracks.length === 0) return;
      const contextId = `${ref.kind}:${ref.id}`;
      if (shuffle) queueActions.playShuffled(player, tracks, contextId);
      else player.playList(tracks, 0, contextId);
    },
    [player, tracksOf],
  );

  return { play, warm };
}
