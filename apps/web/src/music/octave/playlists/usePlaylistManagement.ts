/**
 * Octave — les gestes qui GÈRENT une playlist (jamais décidés par le client : le serveur refuse une playlist
 * que le compte ne peut pas modifier, `editable` ne fait que cacher l'entrée) : modifier ses détails, la
 * dupliquer, la supprimer — et, à la suppression, retirer chez l'extension ses entrées en attente (leurs
 * demandes à Lidarr EN COURS s'abandonnent), en fond, une seule relecture de la liste d'attente à la fin.
 *
 * Règle de Damien : supprimer une playlist supprime l'OBJET playlist Jellyfin, rien d'autre — jamais un titre,
 * un fichier, un élément Jellyfin, un album Lidarr. Un titre importé déjà arrivé reste dans la bibliothèque ;
 * sur l'appareil, seule la copie gardée à cause de cette seule playlist part (`offlineRelease.ts`).
 */

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  musicPendingKey,
  removePendingMusic,
  useDeleteMusicPlaylist,
  useDuplicateMusicPlaylist,
  useMusicPlaylistReader,
  useUpdateMusicPlaylistDetails,
} from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { useToast } from "../../../contexts/ToastContext";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { usePendingMusic } from "../pending/usePendingMusic";
import { octavePaths } from "../octavePaths";
import { removeWaiting, waitingOf } from "./playlistCleanup";
import { keptMusicState } from "../offline/keptMusicStore";
import { removeKept } from "../offline/keepMusic";
import { offlineReleaseOf } from "./offlineRelease";

export function usePlaylistManagement() {
  const { t } = useTranslation("music");
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const provider = useOctaveProvider();
  const pending = usePendingMusic();
  const read = useMusicPlaylistReader();
  const { mutateAsync: update } = useUpdateMusicPlaylistDetails();
  const { mutateAsync: remove } = useDeleteMusicPlaylist();
  const { mutateAsync: copy } = useDuplicateMusicPlaylist();
  const failed = useCallback(() => toast.show("error", t("refusal.failed"), { title: t("refusal.title") }), [t, toast]);

  /** Les titres en attente de cette playlist (ce que la suppression abandonnera). */
  const waitingCount = useCallback((playlist: MusicPlaylist) => waitingOf(pending, playlist.jellyfinId).length, [pending]);

  const saveDetails = useCallback(
    async (playlist: MusicPlaylist, change: { name?: string; description?: string }): Promise<boolean> => {
      try {
        const detail = await update({ playlistId: playlist.jellyfinId, ...change });
        toast.show("success", t("playlistManage.saved", { name: detail.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [failed, t, toast, update],
  );

  const deletePlaylist = useCallback(
    async (playlist: MusicPlaylist): Promise<boolean> => {
      const waiting = waitingOf(pending, playlist.jellyfinId).map((p) => p.operationId);
      try {
        await remove({ playlistId: playlist.jellyfinId });
      } catch {
        failed();
        return false;
      }
      // La page de la playlist supprimée n'a plus rien à montrer : retour à « Playlists ».
      if (pathname === octavePaths.playlist(playlist.jellyfinId)) navigate(octavePaths.playlists, { replace: true });
      toast.show("success", t("playlistManage.deleted", { name: playlist.name }));
      // L'appareil : seule part la copie gardée pour CETTE playlist et rien d'autre (jamais un titre du serveur).
      const kept = keptMusicState();
      const release = offlineReleaseOf(playlist.jellyfinId, kept.collections, kept.tracks);
      if (release) void removeKept(kept.tracks.filter((t) => release.fileIds.includes(t.fileId)), release.collectionKey);
      if (provider && waiting.length > 0) {
        void removeWaiting(waiting, (id) => removePendingMusic(provider, id)).then(() =>
          qc.invalidateQueries({ queryKey: musicPendingKey(provider.pluginId) }),
        );
      }
      return true;
    },
    [failed, navigate, pathname, pending, provider, qc, remove, t, toast],
  );

  const duplicate = useCallback(
    async (playlist: MusicPlaylist): Promise<boolean> => {
      try {
        const source = await read(playlist.jellyfinId);
        const itemIds = source.entries.flatMap((e) => (e.track.jellyfinId ? [e.track.jellyfinId] : []));
        const name = t("playlistManage.copyName", { name: playlist.name }).slice(0, 200);
        const created = await copy({ name, itemIds });
        const partial = waitingOf(pending, playlist.jellyfinId).length > 0;
        toast.show("success", t(partial ? "playlistManage.duplicatedPartial" : "playlistManage.duplicated", { name }), {
          action: { label: t("playlistManage.open"), onPress: () => navigate(octavePaths.playlist(created.jellyfinId)) },
        });
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [copy, failed, navigate, pending, read, t, toast],
  );

  return { saveDetails, deletePlaylist, duplicate, waitingCount };
}
