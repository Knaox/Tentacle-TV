/**
 * Octave — les gestes qui GÈRENT une playlist, côté web : ceux d'api-client (`usePlaylistManageGestures` :
 * détails, copie, suppression et ses attentes), avec ce qui est propre au web et au bureau — la page de la
 * playlist supprimée ramène à « Playlists », et sur l'appareil seule part la copie gardée à cause de cette
 * seule playlist (`offlineRelease.ts`), jamais un titre du serveur.
 */

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePlaylistManageGestures } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { octavePaths } from "../octavePaths";
import { useOctaveActionsUi } from "../actions/useOctaveActionsUi";
import { keptMusicState } from "../offline/keptMusicStore";
import { removeKept } from "../offline/keepMusic";
import { offlineReleaseOf } from "./offlineRelease";

export function usePlaylistManagement() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDeleted = useCallback(
    (playlist: MusicPlaylist) => {
      // La page de la playlist supprimée n'a plus rien à montrer : retour à « Playlists ».
      if (pathname === octavePaths.playlist(playlist.jellyfinId)) navigate(octavePaths.playlists, { replace: true });
      const kept = keptMusicState();
      const release = offlineReleaseOf(playlist.jellyfinId, kept.collections, kept.tracks);
      if (release) void removeKept(kept.tracks.filter((t) => release.fileIds.includes(t.fileId)), release.collectionKey);
    },
    [navigate, pathname],
  );
  const onDuplicated = useCallback((playlistId: string) => navigate(octavePaths.playlist(playlistId)), [navigate]);
  return usePlaylistManageGestures(useOctaveProvider(), useOctaveActionsUi(), { onDeleted, onDuplicated });
}
