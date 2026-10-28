/**
 * Octave — les événements `music:*`, UNE souscription : `useMusicEvents` d'A5
 * (socket partagé, liste d'attente et extensions relues, rattrapage au retour
 * du socket), dont `onEvent` applique en plus :
 * - l'effet commun (`applyOctaveEvent`, api-client) : la BIBLIOTHÈQUE (listes,
 *   cœurs, playlists, tri, sources — `useMusicLive` n'est pas monté, il ferait une
 *   seconde souscription) et le LECTEUR (cœur confirmé, titre résolu basculé) ;
 * - la tenue à jour du hors ligne de l'appareil (`signalMusicEvent`).
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyOctaveEvent, useJellyfinClient, useMusicCapability, useMusicEvents } from "@tentacle-tv/api-client";
import type { MusicEvent } from "@tentacle-tv/shared/music";
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
      // Bibliothèque et lecteur : l'effet commun (api-client, le même au mobile).
      applyOctaveEvent(queryClient, player, event);
      // La tenue à jour des playlists gardées hors ligne (bureau) : ce qui la réveille.
      signalMusicEvent(event);
    },
    [player, queryClient],
  );

  useMusicEvents({ enabled: capable, token, onEvent });
  // Bureau : les requêtes de l'extension partent de CET appareil (requêtes déléguées).
  useDesktopClientFetch(capable, token);
}
