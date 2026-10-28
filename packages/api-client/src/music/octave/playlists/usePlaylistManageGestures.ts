/**
 * Octave — les gestes qui GÈRENT une playlist, communs au web, au bureau et au mobile (jamais décidés par le
 * client : le serveur refuse une playlist que le compte ne peut pas modifier, `editable` ne fait que cacher
 * l'entrée) : modifier ses détails, la dupliquer, la supprimer — et, à la suppression, retirer chez l'extension
 * ses entrées en attente (leurs demandes EN COURS s'abandonnent), en fond, une seule relecture de la liste
 * d'attente à la fin. Ce qui est propre à l'application (aller ailleurs, la copie gardée sur l'appareil) passe
 * par `onDeleted` / `onDuplicated`.
 *
 * Règle de Damien : supprimer une playlist supprime l'OBJET playlist Jellyfin, rien d'autre — jamais un titre,
 * un fichier, un élément Jellyfin, un album Lidarr.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { removeWaiting, waitingOf } from "@tentacle-tv/shared/octave";
import type { MusicProvider } from "../../../pluginMusic/musicProvider";
import { removePendingMusic } from "../../../pluginMusic/musicRequests";
import { musicPendingKey, useMusicPending } from "../../../pluginMusic/useMusicActions";
import { useDeleteMusicPlaylist, useDuplicateMusicPlaylist, useMusicPlaylistReader, useUpdateMusicPlaylistDetails } from "../../useMusicPlaylists";
import type { OctaveActionsUi } from "../actions/actionsUi";

export interface PlaylistManageHooks {
  /** Après la suppression : quitter la page de la playlist, libérer sa copie gardée sur l'appareil. */
  onDeleted?: (playlist: MusicPlaylist) => void;
  /** L'action « Ouvrir » de l'avis d'une copie. */
  onDuplicated?: (playlistId: string) => void;
}

export function usePlaylistManageGestures(provider: MusicProvider | null, ui: Pick<OctaveActionsUi, "t" | "notify">, hooks: PlaylistManageHooks = {}) {
  const { t, notify } = ui;
  const { onDeleted, onDuplicated } = hooks;
  const qc = useQueryClient();
  const pending = useMusicPending(provider).data.items;
  const read = useMusicPlaylistReader();
  const { mutateAsync: update } = useUpdateMusicPlaylistDetails();
  const { mutateAsync: remove } = useDeleteMusicPlaylist();
  const { mutateAsync: copy } = useDuplicateMusicPlaylist();
  const failed = useCallback(() => notify("error", t("refusal.failed"), { title: t("refusal.title") }), [notify, t]);

  /** Les titres en attente de cette playlist (ce que la suppression abandonnera). */
  const waitingCount = useCallback((playlist: MusicPlaylist) => waitingOf(pending, playlist.jellyfinId).length, [pending]);

  const saveDetails = useCallback(
    async (playlist: MusicPlaylist, change: { name?: string; description?: string }): Promise<boolean> => {
      try {
        const detail = await update({ playlistId: playlist.jellyfinId, ...change });
        notify("success", t("playlistManage.saved", { name: detail.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [failed, notify, t, update],
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
      onDeleted?.(playlist);
      notify("success", t("playlistManage.deleted", { name: playlist.name }));
      if (provider && waiting.length > 0) {
        void removeWaiting(waiting, (id) => removePendingMusic(provider, id)).then(() => qc.invalidateQueries({ queryKey: musicPendingKey(provider.pluginId) }));
      }
      return true;
    },
    [failed, notify, onDeleted, pending, provider, qc, remove, t],
  );

  const duplicate = useCallback(
    async (playlist: MusicPlaylist): Promise<boolean> => {
      try {
        const source = await read(playlist.jellyfinId);
        const itemIds = source.entries.flatMap((e) => (e.track.jellyfinId ? [e.track.jellyfinId] : []));
        const name = t("playlistManage.copyName", { name: playlist.name }).slice(0, 200);
        const created = await copy({ name, itemIds });
        const partial = waitingOf(pending, playlist.jellyfinId).length > 0;
        notify("success", t(partial ? "playlistManage.duplicatedPartial" : "playlistManage.duplicated", { name }), {
          ...(onDuplicated && { action: { label: t("playlistManage.open"), onPress: () => onDuplicated(created.jellyfinId) } }),
        });
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [copy, failed, notify, onDuplicated, pending, read, t],
  );

  return { saveDetails, deletePlaylist, duplicate, waitingCount };
}
