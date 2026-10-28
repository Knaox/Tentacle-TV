/**
 * Octave — ce que fait un évènement `music:*` dans une application ouverte en Octave, le même au web, au
 * bureau et au mobile : l'effet BIBLIOTHÈQUE (`applyMusicEvent` : listes, cœurs, playlists, tri d'une liste,
 * sources), puis le LECTEUR — cœur confirmé (`music:userdata` : le cœur affiché d'avance s'efface, la file le
 * reprend), titre résolu basculé dans la file et à chaud dans le moteur (`music:resolved`). Ce qui est propre
 * à l'appareil (la tenue à jour du hors ligne) reste chez l'appelant.
 */

import type { QueryClient } from "@tanstack/react-query";
import { libraryTrackKey, type MusicEvent } from "@tentacle-tv/shared/music";
import { applyResolution, queueActions, type OctavePlayer } from "@tentacle-tv/shared/octave";
import { applyMusicEvent } from "../../useMusicLive";
import { clearLikeOverride } from "../actions/likeOverrides";

export function applyOctaveEvent(qc: QueryClient, player: OctavePlayer | null, event: MusicEvent): void {
  applyMusicEvent(qc, event);
  if (event.type === "music:userdata") {
    for (const change of event.changes) {
      const key = libraryTrackKey(change.jellyfinId);
      clearLikeOverride(key);
      if (player) queueActions.patchFavorite(player, key, change.favorite);
    }
  } else if (event.type === "music:resolved" && player) {
    applyResolution(player, event);
  }
}
