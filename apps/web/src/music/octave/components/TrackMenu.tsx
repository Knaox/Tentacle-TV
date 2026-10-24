/**
 * Octave — le menu « Plus » d'un titre : file (ensuite, à la fin), playlist,
 * album, artiste. Un geste impossible pour ce titre n'apparaît pas.
 */

import { useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Disc3, ListEnd, ListPlus, ListStart, MoreHorizontal, Trash2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { FloatingLayer } from "../../../components/floating/FloatingLayer";
import type { TrackActions } from "../actions/useTrackActions";
import { useMusicPlaylists } from "../data/libraryQueries";
import { octavePaths } from "../octavePaths";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

interface TrackMenuProps {
  track: MusicTrack;
  actions: TrackActions;
  /** Retirer de la playlist courante, si elle le permet. */
  onRemove?: () => void;
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:outline-none";

export function TrackMenu({ track, actions, onRemove }: TrackMenuProps) {
  const { t } = useTranslation("music");
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("track.more", { title: track.title })}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-tertiary opacity-0 transition-opacity duration-150 hover:text-content-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus group-hover:opacity-100 aria-expanded:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {/* Monté seulement ouvert : une liste de 500 titres ne porte pas 500 requêtes de playlists. */}
      {open && <TrackMenuPanel track={track} actions={actions} onRemove={onRemove} anchor={anchor} onClose={() => setOpen(false)} />}
    </>
  );
}

function TrackMenuPanel({ track, actions, onRemove, anchor, onClose }: TrackMenuProps & { anchor: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const { t } = useTranslation("music");
  const [picking, setPicking] = useState(false);
  const player = useOctavePlayer();
  const navigate = useNavigate();
  const playlists = useMusicPlaylists();
  const close = onClose;
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  const albumId = track.album?.jellyfinId ?? null;
  const artistId = track.artists[0]?.jellyfinId ?? null;
  const editable = (playlists.data ?? []).filter((p) => p.editable);

  return (
    <>
      <FloatingLayer
        open
        anchor={anchor}
        onDismiss={close}
        role="menu"
        ariaLabel={t("track.more", { title: track.title })}
        side="bottom"
        align="end"
        className="lg-menu w-64 overflow-y-auto overscroll-contain p-1.5"
        style={{
          background: "var(--surface-dropdown)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-dropdown)",
          backdropFilter: "blur(var(--blur-dropdown))",
          WebkitBackdropFilter: "blur(var(--blur-dropdown))",
          maxHeight: 360,
        }}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {picking ? (
            <>
              <button type="button" role="menuitem" className={itemClass} onClick={() => setPicking(false)}>
                <ChevronLeft className="h-4 w-4 text-content-tertiary" />
                {t("playlist.addTo")}
              </button>
              <div className="my-1 h-px bg-line-subtle" />
              {editable.length === 0 && <p className="px-3 py-2 text-sm text-content-tertiary">{t("playlist.none")}</p>}
              {editable.map((p) => (
                <button key={p.jellyfinId} type="button" role="menuitem" className={itemClass} onClick={run(() => void actions.addToPlaylist(track, p))}>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button type="button" role="menuitem" className={itemClass} onClick={run(() => queueActions.playNext(player, [track]))}>
                <ListStart className="h-4 w-4 text-content-tertiary" />
                {t("track.playNext")}
              </button>
              <button type="button" role="menuitem" className={itemClass} onClick={run(() => queueActions.enqueue(player, [track]))}>
                <ListEnd className="h-4 w-4 text-content-tertiary" />
                {t("track.addToQueue")}
              </button>
              {actions.canAddToPlaylist(track) && (
                <button type="button" role="menuitem" className={itemClass} onClick={() => setPicking(true)}>
                  <ListPlus className="h-4 w-4 text-content-tertiary" />
                  <span className="flex-1">{t("playlist.addTo")}</span>
                  <ChevronRight className="h-4 w-4 text-content-tertiary" />
                </button>
              )}
              {(albumId || artistId) && <div className="my-1 h-px bg-line-subtle" />}
              {albumId && (
                <button type="button" role="menuitem" className={itemClass} onClick={run(() => navigate(octavePaths.album(albumId)))}>
                  <Disc3 className="h-4 w-4 text-content-tertiary" />
                  {t("track.goToAlbum")}
                </button>
              )}
              {artistId && (
                <button type="button" role="menuitem" className={itemClass} onClick={run(() => navigate(octavePaths.artist(artistId)))}>
                  <User className="h-4 w-4 text-content-tertiary" />
                  {t("track.goToArtist")}
                </button>
              )}
              {onRemove && (
                <>
                  <div className="my-1 h-px bg-line-subtle" />
                  <button type="button" role="menuitem" className={`${itemClass} text-status-error-fg`} onClick={run(onRemove)}>
                    <Trash2 className="h-4 w-4" />
                    {t("playlist.remove")}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </FloatingLayer>
    </>
  );
}
