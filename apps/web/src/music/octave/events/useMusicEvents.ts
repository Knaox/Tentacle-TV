/**
 * Octave — les événements `music:*` du canal de session (musicEvents.ts),
 * appliqués SANS geste : listes relues, cœurs confirmés, et un titre en
 * attente résolu bascule partout (listes, file, source du moteur).
 *
 * Transport : le socket Tentacle partagé (`subscribeSocket`), filtré sur la
 * liste FERMÉE `MUSIC_EVENT_TYPES` — un message inconnu est ignoré.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeSocket, useUserId } from "@tentacle-tv/api-client";
import { useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { MUSIC_EVENT_TYPES, libraryTrackKey, type MusicEvent, type MusicEventType } from "@tentacle-tv/shared/music";
import { clearLikeOverride } from "../actions/likeOverrides";
import { octaveKeys } from "../data/libraryQueries";
import { queueActions, applyResolution } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

const TYPES = new Set<string>(MUSIC_EVENT_TYPES);

export function asMusicEvent(message: unknown): MusicEvent | null {
  if (!message || typeof message !== "object") return null;
  const type = (message as { type?: unknown }).type;
  return typeof type === "string" && TYPES.has(type as MusicEventType) ? (message as MusicEvent) : null;
}

export function useMusicEvents(): void {
  const queryClient = useQueryClient();
  const user = useUserId();
  const player = useOctavePlayer();
  const refreshPlugins = useRefreshPlugins();

  useEffect(() => {
    const invalidate = (key: readonly unknown[]) => void queryClient.invalidateQueries({ queryKey: key });
    return subscribeSocket((message: unknown) => {
      const event = asMusicEvent(message);
      if (!event) return;
      switch (event.type) {
        case "music:library":
          invalidate(octaveKeys.home(user));
          invalidate([...octaveKeys.all(user), "albums"]);
          invalidate([...octaveKeys.all(user), "artists"]);
          invalidate([...octaveKeys.all(user), "search"]);
          break;
        case "music:userdata":
          for (const change of event.changes) {
            const key = libraryTrackKey(change.jellyfinId);
            clearLikeOverride(key);
            queueActions.patchFavorite(player, key, change.favorite);
          }
          invalidate(octaveKeys.liked(user));
          break;
        case "music:playlist":
          invalidate(octaveKeys.playlist(user, event.playlistId));
          invalidate(octaveKeys.playlists(user));
          break;
        case "music:resolved":
          applyResolution(player, event);
          invalidate(octaveKeys.liked(user));
          invalidate(octaveKeys.pending(user));
          invalidate([...octaveKeys.all(user), "playlist"]);
          break;
        case "music:pending":
          invalidate(octaveKeys.pending(user));
          break;
        case "music:provider":
          refreshPlugins();
          break;
      }
    });
  }, [player, queryClient, refreshPlugins, user]);
}
