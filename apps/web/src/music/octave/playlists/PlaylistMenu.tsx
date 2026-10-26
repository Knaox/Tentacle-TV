/**
 * Octave — le menu « … » d'une playlist (sa page, ses cartes, le rail ; au clic droit aussi) : modifier les
 * détails, dupliquer, supprimer. Seulement sur une playlist que le compte peut modifier (`editable`, la règle
 * du serveur) : ailleurs, ni bouton ni menu. La suppression est à part, en rouge, et demande confirmation.
 */

import { useRef, type RefObject } from "react";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { FloatingLayer } from "../../../components/floating/FloatingLayer";
import type { FloatingAnchor } from "../../../components/floating/useFloatingPlacement";
import { requestPlaylistManage } from "./playlistManageStore";
import { usePlaylistManagement } from "./usePlaylistManagement";

const itemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none";

export function PlaylistMenuPanel({ playlist, anchor, onClose }: { playlist: MusicPlaylist; anchor: FloatingAnchor; onClose: () => void }) {
  const { t } = useTranslation("music");
  const { duplicate } = usePlaylistManagement();
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
      <button type="button" role="menuitem" className={itemClass} onClick={run(() => requestPlaylistManage({ kind: "edit", playlist }))}>
        <Pencil className="h-4 w-4 text-content-tertiary" aria-hidden />
        {t("playlistManage.editDetails")}
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(() => void duplicate(playlist))}>
        <Copy className="h-4 w-4 text-content-tertiary" aria-hidden />
        {t("playlistManage.duplicate")}
      </button>
      <div role="separator" className="mx-2 my-1.5 h-px bg-line-subtle" />
      <button type="button" role="menuitem" className={`${itemClass} text-status-error-fg`} onClick={run(() => requestPlaylistManage({ kind: "delete", playlist }))}>
        <Trash2 className="h-4 w-4" aria-hidden />
        {t("playlistManage.delete")}
      </button>
    </FloatingLayer>
  );
}

interface PlaylistMenuButtonProps {
  playlist: MusicPlaylist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/** Le bouton « … » ; rien pour une playlist que le compte ne peut pas modifier. */
export function PlaylistMenuButton({ playlist, open, onOpenChange, className = "h-11 w-11" }: PlaylistMenuButtonProps) {
  const { t } = useTranslation("music");
  const anchor = useRef<HTMLButtonElement>(null);
  if (!playlist.editable) return null;
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
