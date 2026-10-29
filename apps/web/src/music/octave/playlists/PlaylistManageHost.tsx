/**
 * Octave — l'hôte des gestes de gestion d'une playlist (une fois par coquille) : la boîte « Modifier les
 * détails », le partage (lien, personnes du serveur), quitter une playlist partagée, et la confirmation de suppression, qui dit ce qui arrive aux titres en attente.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { PlaylistDetailsDialog } from "./PlaylistDetailsDialog";
import { SharePlaylistDialog } from "./SharePlaylistDialog";
import { PlaylistMembersDialog } from "./members/PlaylistMembersDialog";
import { LeavePlaylistConfirm } from "./members/LeavePlaylistConfirm";
import { closePlaylistManage, usePlaylistManageRequest } from "./playlistManageStore";
import { usePlaylistManagement } from "./usePlaylistManagement";

export function PlaylistManageHost() {
  const { t } = useTranslation("music");
  const request = usePlaylistManageRequest();
  const manage = usePlaylistManagement();
  const [deleting, setDeleting] = useState(false);
  if (!request) return null;
  const { playlist } = request;

  if (request.kind === "edit") {
    return <PlaylistDetailsDialog key={playlist.jellyfinId} playlist={playlist} onSave={(change) => manage.saveDetails(playlist, change)} onClose={closePlaylistManage} />;
  }
  if (request.kind === "share") return <SharePlaylistDialog key={playlist.jellyfinId} playlist={playlist} onClose={closePlaylistManage} />;
  if (request.kind === "members") return <PlaylistMembersDialog key={playlist.jellyfinId} playlist={playlist} onClose={closePlaylistManage} />;
  if (request.kind === "leave") return <LeavePlaylistConfirm key={playlist.jellyfinId} playlist={playlist} onClose={closePlaylistManage} />;
  const waiting = manage.waitingCount(playlist);
  return (
    <ConfirmDialog
      open
      danger
      pending={deleting}
      title={t("playlistManage.deleteTitle", { name: playlist.name })}
      message={waiting > 0 ? t("playlistManage.deleteMessageWaiting", { count: waiting }) : t("playlistManage.deleteMessage")}
      confirmLabel={t("playlistManage.deleteConfirm")}
      cancelLabel={t("playlistManage.cancel")}
      onCancel={closePlaylistManage}
      onConfirm={async () => {
        setDeleting(true);
        const ok = await manage.deletePlaylist(playlist);
        setDeleting(false);
        if (ok) closePlaylistManage();
      }}
    />
  );
}
