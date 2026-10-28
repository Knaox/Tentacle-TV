/**
 * Octave — les événements `music:*`, UNE souscription : `useMusicEvents` d'A5
 * (socket partagé, liste d'attente et extensions relues, rattrapage au retour
 * du socket), dont `onEvent` applique en plus :
 * - l'effet BIBLIOTHÈQUE d'A3 (`applyMusicEvent` : listes, cœurs, playlists,
 *   sources) — `useMusicLive` n'est pas monté, il ferait une seconde souscription ;
 * - le LECTEUR : cœur confirmé (`music:userdata`), titre résolu basculé dans la
 *   file et à chaud dans le moteur (`music:resolved` → `swapSource`).
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyMusicEvent, useJellyfinClient, useMusicCapability, useMusicEvents } from "@tentacle-tv/api-client";
import { libraryTrackKey, type MusicEvent } from "@tentacle-tv/shared/music";
import { applyResolution, queueActions } from "@tentacle-tv/shared/octave";
import { clearLikeOverride } from "../actions/likeOverrides";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { useDesktopClientFetch } from "../clientFetch/useDesktopClientFetch";
import { signalMusicEvent } from "@tentacle-tv/offline-core/music";

export function useOctaveEvents(): void {
  const queryClient = useQueryClient();
  const player = useOctavePlayer();
  const client = useJellyfinClient();
  const capable = useMusicCapability();
  // Comme l'accueil : le jeton de la page (bureau), le cookie sinon (web).
  const token = client.getAccessToken() || localStorage.getItem("tentacle_token");

  const onEvent = useCallback(
    (event: MusicEvent) => {
      applyMusicEvent(queryClient, event);
      // La tenue à jour des playlists gardées hors ligne (bureau) : ce qui la réveille.
      signalMusicEvent(event);
      if (event.type === "music:userdata") {
        for (const change of event.changes) {
          const key = libraryTrackKey(change.jellyfinId);
          clearLikeOverride(key);
          queueActions.patchFavorite(player, key, change.favorite);
        }
      } else if (event.type === "music:resolved") {
        applyResolution(player, event);
      }
    },
    [player, queryClient],
  );

  useMusicEvents({ enabled: capable, token, onEvent });
  // Bureau : les requêtes de l'extension partent de CET appareil (requêtes déléguées).
  useDesktopClientFetch(capable, token);
}
