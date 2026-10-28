/**
 * Octave mobile — la musique EN DIRECT, UNE souscription par coquille (comme `useOctaveEvents` du bureau) :
 * les évènements `music:*` du canal des comptes (`/api/ws`, jeton de la session : en profil de la Famille, le
 * socket est celui du profil). Chacun relit ce qu'il rend faux et rien d'autre (`applyOctaveEvent` : listes,
 * cœurs, playlists, tri d'une liste, lecteur), et réveille la tenue à jour du hors ligne (`signalMusicEvent`,
 * m5). Une playlist ou un like changé au bureau se voit ici, et inversement — jamais un relevé. Au retour du
 * socket après une coupure, toute la musique se relit une fois. Ne rend rien.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyOctaveEvent, useMusicCapability, useMusicEvents, useTentacleConfig } from "@tentacle-tv/api-client";
import { signalMusicEvent } from "@tentacle-tv/offline-core/music";
import type { MusicEvent } from "@tentacle-tv/shared/music";
import { useMobileClientFetch } from "../clientFetch/useMobileClientFetch";
import { useOptionalOctavePlayer } from "../player";

export function OctaveEventsHost() {
  const qc = useQueryClient();
  const player = useOptionalOctavePlayer();
  const capable = useMusicCapability();
  const { storage } = useTentacleConfig();
  const token = storage.getItem("tentacle_token");
  const onEvent = useCallback(
    (event: MusicEvent) => {
      applyOctaveEvent(qc, player, event);
      signalMusicEvent(event);
    },
    [player, qc],
  );
  useMusicEvents({ enabled: capable && !!token, token, onEvent });
  // Les requêtes YouTube de l'extension partent de CE téléphone (requêtes déléguées), comme du bureau.
  useMobileClientFetch(capable && !!token, token);
  return null;
}
