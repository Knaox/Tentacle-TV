/**
 * Octave — le menu « Plus » d'un titre : file (ensuite, à la fin), playlist
 * (ajouter, retirer — un titre hors bibliothèque compris), album, artiste. Un
 * geste impossible pour ce titre n'apparaît pas. Monté partout où un titre est
 * montré : listes, lecteur, plein écran, accès rapide (`visible="always"` hors
 * d'une rangée survolée).
 */

import { useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Disc3, ListEnd, ListMinus, ListPlus, ListStart, MoreHorizontal, Plus, Trash2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MusicPlaylist, MusicTrack } from "@tentacle-tv/shared/music";
import { usePlaylistChooserSections } from "@tentacle-tv/api-client";
import { FloatingLayer } from "../../../components/floating/FloatingLayer";
import type { TrackActions } from "../actions/useTrackActions";
import { albumPathOf, linkedArtistsOf } from "./trackTargets";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { openPlaylistChooser } from "../actions/playlistChooserStore";
import { KeepMenuItem } from "../offline/KeepMenuItem";

interface TrackMenuProps {
  track: MusicTrack;
  actions: TrackActions;
  /** Retirer de la playlist courante, si elle le permet. */
  onRemove?: () => void;
  /** `hover` (défaut) : révélé au survol de la rangée ; `always` : le lecteur, le plein écran, l'accès rapide. */
  visible?: "hover" | "always";
  /** Taille et teinte du bouton hors d'une rangée (le lecteur, la feuille plein écran). */
  buttonClassName?: string;
  /** « Voir l'album / l'artiste » mène ailleurs : ce qui entoure se referme aussi (la feuille « en cours »). */
  onNavigate?: () => void;
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none";

const HOVER_CLASS = "octave-hover-reveal opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100";

export function TrackMenu({ track, actions, onRemove, visible = "hover", buttonClassName = "h-8 w-8 text-content-tertiary", onNavigate }: TrackMenuProps) {
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
        className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${buttonClassName} ${visible === "hover" ? HOVER_CLASS : ""}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {/* Monté seulement ouvert : une liste de 500 titres ne porte pas 500 requêtes de playlists. */}
      {open && <TrackMenuPanel track={track} actions={actions} onRemove={onRemove} anchor={anchor} onClose={() => setOpen(false)} onNavigate={onNavigate} />}
    </>
  );
}

function TrackMenuPanel({ track, actions, onRemove, anchor, onClose, onNavigate }: TrackMenuProps & { anchor: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const { t } = useTranslation(["music", "octaveShell"]);
  const [picking, setPicking] = useState<"add" | "remove" | null>(null);
  const player = useOctavePlayer();
  const navigate = useNavigate();
  const sections = usePlaylistChooserSections();
  const close = onClose;
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  // Bibliothèque ou ailleurs (la vue de l'extension) ; rien où aller : pas d'entrée.
  const albumPath = albumPathOf(track);
  const artists = linkedArtistsOf(track);
  // Les favorites d'abord, dans l'ordre personnel (lot fl) ; le retrait vise aussi bien l'une que l'autre.
  const editable = [...sections.favorites, ...sections.others];

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
        className="w-64 overflow-y-auto overscroll-contain p-1.5"
        // Un îlot d'encre PRUNE, opaque (IDENTITE.md) : ni verre ni flou derrière un fond plein.
        style={{
          background: "var(--oc-ink-raised)",
          borderRadius: "var(--oc-radius-panel)",
          boxShadow: "var(--oc-shadow-panel)",
          maxHeight: 360,
        }}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {picking ? (
            <PlaylistPicker
              mode={picking}
              playlists={editable}
              favorites={picking === "add" ? sections.favorites.length : 0}
              onBack={() => setPicking(null)}
              onCreate={picking === "add" ? run(() => openPlaylistChooser(track)) : undefined}
              onPick={(p, position) =>
                run(() => void (picking === "add" ? actions.addToPlaylist(track, p, position) : actions.removeFromPlaylist(track, p)))()
              }
            />
          ) : (
            <>
              {/* Dans une playlist qui le permet : le retrait EN TÊTE (lot fl, 30/10 — il se perdait en bas du menu). */}
              {onRemove && (
                <>
                  <button type="button" role="menuitem" className={`${itemClass} text-status-error-fg`} onClick={run(onRemove)}>
                    <Trash2 className="h-4 w-4" />
                    {t("playlist.remove")}
                  </button>
                  <div className="my-1 h-px bg-line-subtle" />
                </>
              )}
              <button type="button" role="menuitem" className={itemClass} onClick={run(() => queueActions.playNext(player, [track]))}>
                <ListStart className="h-4 w-4 text-content-tertiary" />
                {t("track.playNext")}
              </button>
              <button type="button" role="menuitem" className={itemClass} onClick={run(() => queueActions.enqueue(player, [track]))}>
                <ListEnd className="h-4 w-4 text-content-tertiary" />
                {t("track.addToQueue")}
              </button>
              {actions.canAddToPlaylist(track) && (
                <button type="button" role="menuitem" className={itemClass} onClick={() => setPicking("add")}>
                  <ListPlus className="h-4 w-4 text-content-tertiary" />
                  <span className="flex-1">{t("playlist.addTo")}</span>
                  <ChevronRight className="h-4 w-4 text-content-tertiary" />
                </button>
              )}
              {actions.canRemoveFromPlaylist(track) && editable.length > 0 && (
                <button type="button" role="menuitem" className={itemClass} onClick={() => setPicking("remove")}>
                  <ListMinus className="h-4 w-4 text-content-tertiary" />
                  <span className="flex-1">{t("playlist.removeFrom")}</span>
                  <ChevronRight className="h-4 w-4 text-content-tertiary" />
                </button>
              )}
              <KeepMenuItem track={track} className={itemClass} onDone={close} />
              {(albumPath || artists.length > 0) && <div className="my-1 h-px bg-line-subtle" />}
              {albumPath && (
                <button type="button" role="menuitem" className={itemClass} onClick={run(() => { navigate(albumPath); onNavigate?.(); })}>
                  <Disc3 className="h-4 w-4 text-content-tertiary" />
                  {t("track.goToAlbum")}
                </button>
              )}
              {/* Un artiste : « Voir l'artiste » ; plusieurs crédités : une entrée chacun, à son nom. */}
              {artists.map((artist) => (
                <button key={artist.path} type="button" role="menuitem" className={itemClass} onClick={run(() => { navigate(artist.path); onNavigate?.(); })}>
                  <User className="h-4 w-4 shrink-0 text-content-tertiary" />
                  <span className="truncate">{artists.length > 1 ? t("octaveShell:track.goToArtistNamed", { artist: artist.name }) : t("track.goToArtist")}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </FloatingLayer>
    </>
  );
}

/** Le choix d'une playlist modifiable : pour y ajouter (à la fin, ou « En tête »), ou pour en retirer le titre. */
function PlaylistPicker({ mode, playlists, favorites = 0, onBack, onPick, onCreate }: {
  mode: "add" | "remove";
  playlists: readonly MusicPlaylist[];
  /** Les `favorites` premières sont les favorites : un titre les sépare des autres. */
  favorites?: number;
  onBack: () => void;
  onPick: (playlist: MusicPlaylist, position?: number) => void;
  /** « Nouvelle playlist… » (ajout seulement) : un nom, puis le titre y entre aussitôt. */
  onCreate?: () => void;
}) {
  const { t } = useTranslation(["music", "musicFavorites"]);
  const heading = (label: string) => <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">{label}</p>;
  return (
    <>
      <button type="button" role="menuitem" className={itemClass} onClick={onBack}>
        <ChevronLeft className="h-4 w-4 text-content-tertiary" />
        {t(mode === "add" ? "playlist.addTo" : "playlist.removeFrom")}
      </button>
      <div className="my-1 h-px bg-line-subtle" />
      {onCreate && (
        <button type="button" role="menuitem" className={itemClass} onClick={onCreate}>
          <Plus className="h-4 w-4 text-content-tertiary" />
          {t("playlist.newEllipsis")}
        </button>
      )}
      {playlists.length === 0 && !onCreate && <p className="px-3 py-2 text-sm text-content-tertiary">{t("playlist.none")}</p>}
      {playlists.map((p, i) => (
        <div key={p.jellyfinId}>
          {favorites > 0 && i === 0 && heading(t("musicFavorites:chooser.favorites"))}
          {favorites > 0 && i === favorites && heading(t("musicFavorites:chooser.others"))}
          <div className="flex items-center gap-1">
            {/* Le nom ajoute (en tête si le serveur le sait : `music.addOnTop`, sinon à la fin) ou retire ; « En tête » : position 0. */}
            <button type="button" role="menuitem" className={`${itemClass} min-w-0 flex-1`} onClick={() => onPick(p)}>
              <span className="truncate">{p.name}</span>
            </button>
            {mode === "add" && (
              <button
                type="button"
                role="menuitem"
                title={t("playlist.addFirst")}
                onClick={() => onPick(p, 0)}
                className="shrink-0 cursor-pointer rounded-md px-2 py-2 text-xs font-semibold text-content-tertiary hover:bg-octave-hover hover:text-content-primary focus-visible:bg-octave-hover focus-visible:outline-none"
              >
                {t("playlist.first")}
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

