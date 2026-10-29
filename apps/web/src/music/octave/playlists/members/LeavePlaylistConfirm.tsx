/**
 * Octave — QUITTER une playlist qu'un autre compte nous a partagée : une confirmation (on ne la retrouve que s'il
 * la repartage), puis le serveur nous retire ; sur sa page, retour à « Playlists ».
 */

import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicPlaylistMembers } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { octavePaths } from "../../octavePaths";

export function LeavePlaylistConfirm({ playlist, onClose }: { playlist: MusicPlaylist; onClose: () => void }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // La lecture du partage n'est pas utile ici : le geste seul.
  const members = useMusicPlaylistMembers(playlist.jellyfinId, false);
  return (
    <ConfirmDialog
      open
      danger
      pending={members.busy === "leave"}
      title={t("leaveTitle", { name: playlist.name })}
      message={t("leaveMessage", { owner: playlist.sharing?.owner.name ?? "" })}
      confirmLabel={t("leaveConfirm")}
      cancelLabel={t("cancel")}
      onCancel={onClose}
      onConfirm={async () => {
        const left = await members.leave();
        if (!left) return;
        if (pathname === octavePaths.playlist(playlist.jellyfinId)) navigate(octavePaths.playlists, { replace: true });
        onClose();
      }}
    />
  );
}
