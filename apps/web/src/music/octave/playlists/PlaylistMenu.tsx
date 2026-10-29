/**
 * Octave — le menu « … » d'une playlist (sa page, ses cartes, le rail ; au clic droit aussi) : modifier les
 * détails, dupliquer, partager avec des comptes du serveur ou par un lien (si le serveur le sait et le compte en
 * a le droit), supprimer. Une playlist qu'on m'a partagée : « Personnes » et « Quitter la playlist ». Seulement sur une playlist que le compte peut modifier (`editable`, la règle
 * du serveur) : ailleurs, ni bouton ni menu. La suppression est à part, en rouge, et demande confirmation.
 */

import { useRef, type RefObject } from "react";
import { Copy, Link2, LogOut, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMusicPlaylistMembersAvailable, useMusicPlaylistShareAvailable, usePlaylistSharingRules } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { FloatingLayer } from "../../../components/floating/FloatingLayer";
import type { FloatingAnchor } from "../../../components/floating/useFloatingPlacement";
import { requestPlaylistManage } from "./playlistManageStore";
import { usePlaylistManagement } from "./usePlaylistManagement";

const itemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none";

export function PlaylistMenuPanel({ playlist, anchor, onClose }: { playlist: MusicPlaylist; anchor: FloatingAnchor; onClose: () => void }) {
  const { t } = useTranslation("music");
  const { t: ts } = useTranslation("musicShare");
  const { t: tm } = useTranslation("musicPlaylistMembers");
  const { duplicate } = usePlaylistManagement();
  const shareable = useMusicPlaylistShareAvailable();
  const members = useMusicPlaylistMembersAvailable();
  const rules = usePlaylistSharingRules(playlist);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <FloatingLayer
      open
      anchor={anchor}
      onDismiss={onClose}
      role="menu"
      ariaLabel={t("playlistManage.more", { name: playlist.name })}
      side="bottom"
      align="end"
      className="w-60 p-1.5"
      // Un îlot d'encre PRUNE, opaque, comme le menu d'un titre (IDENTITE.md).
      style={{ background: "var(--oc-ink-raised)", borderRadius: "var(--oc-radius-panel)", boxShadow: "var(--oc-shadow-panel)" }}
    >
      {rules.isMember ? (
        <>
          {/* Une playlist qu'on m'a partagée : voir qui y a accès, ou la quitter — jamais la gérer. */}
          <button type="button" role="menuitem" className={itemClass} onClick={run(() => requestPlaylistManage({ kind: "members", playlist }))}>
            <Users className="h-4 w-4 text-content-tertiary" aria-hidden />
            {tm("people")}
          </button>
          <div role="separator" className="mx-2 my-1.5 h-px bg-line-subtle" />
          <button type="button" role="menuitem" className={`${itemClass} text-status-error-fg`} onClick={run(() => requestPlaylistManage({ kind: "leave", playlist }))}>
            <LogOut className="h-4 w-4" aria-hidden />
            {tm("leave")}
          </button>
        </>
      ) : (
      <>
      <button type="button" role="menuitem" className={itemClass} onClick={run(() => requestPlaylistManage({ kind: "edit", playlist }))}>
        <Pencil className="h-4 w-4 text-content-tertiary" aria-hidden />
        {t("playlistManage.editDetails")}
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(() => void duplicate(playlist))}>
        <Copy className="h-4 w-4 text-content-tertiary" aria-hidden />
        {t("playlistManage.duplicate")}
      </button>
      {members && (
        <button type="button" role="menuitem" className={itemClass} onClick={run(() => requestPlaylistManage({ kind: "members", playlist }))}>
          <Users className="h-4 w-4 text-content-tertiary" aria-hidden />
          {tm("shareWith")}
        </button>
      )}
      {shareable && (
        <button type="button" role="menuitem" className={itemClass} onClick={run(() => requestPlaylistManage({ kind: "share", playlist }))}>
          <Link2 className="h-4 w-4 text-content-tertiary" aria-hidden />
          {ts("action")}
        </button>
      )}
      <div role="separator" className="mx-2 my-1.5 h-px bg-line-subtle" />
      <button type="button" role="menuitem" className={`${itemClass} text-status-error-fg`} onClick={run(() => requestPlaylistManage({ kind: "delete", playlist }))}>
        <Trash2 className="h-4 w-4" aria-hidden />
        {t("playlistManage.delete")}
      </button>
      </>
      )}
    </FloatingLayer>
  );
}

interface PlaylistMenuButtonProps {
  playlist: MusicPlaylist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/** Le bouton « … » ; rien pour une playlist que le compte ne peut ni gérer ni quitter. */
export function PlaylistMenuButton({ playlist, open, onOpenChange, className = "h-11 w-11" }: PlaylistMenuButtonProps) {
  const { t } = useTranslation("music");
  const anchor = useRef<HTMLButtonElement>(null);
  const { isMember } = usePlaylistSharingRules(playlist);
  if (!playlist.editable && !isMember) return null;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("playlistManage.more", { name: playlist.name })}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(!open);
        }}
        className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open && <PlaylistMenuPanel playlist={playlist} anchor={anchor as RefObject<HTMLButtonElement | null>} onClose={() => onOpenChange(false)} />}
    </>
  );
}
