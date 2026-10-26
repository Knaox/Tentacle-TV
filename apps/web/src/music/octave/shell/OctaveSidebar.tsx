/**
 * Octave — la barre latérale (bureau, fenêtre large) : la marque — signée
 * Tentacle — et ‹ › en tête, juste dessous la BASCULE du mode et le retour aux
 * films (`OctaveModeSlot` : la première chose qu'on voit, jamais perdue en pied
 * de rail), puis les cinq destinations, vos playlists, et en pied les réglages
 * d'Octave (discrets) et le profil (`OctaveProfileButton`). Au téléphone, les mêmes destinations passent
 * dans une barre d'onglets.
 *
 * L'identité : un RAIL posé sur l'encre, sans dalle ni bordure ; l'entrée
 * active prend la pastille de Tentacle, rose en tête, son icône rose
 * (`shell.css`, sur `aria-current` que pose `NavLink`). En verre natif, le
 * rail devient un panneau de verre posé sur le fond coloré d'Octave, comme dans
 * la maquette « Octave · Playlist » : le verre `pane` du socle, avec son givre
 * qui AVIVE les taches (sans lui, un panneau gris) — gratuit ici : ni le rail ni
 * le fond ne bougent, la passe ne se refait pas. Ses entrées en `lg-pane-nav`.
 * Mesures : `glass/octaveRail.css`.
 */

import { memo, useState, type DragEvent, type ReactNode } from "react";
import { Heart, Home, Library, ListMusic, Search, Settings2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicPlaylists } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { carriesTrack, draggedTrack } from "../actions/dragTrack";
import { useTrackActions } from "../actions/useTrackActions";
import { useLiquidGlassMode, useLiquidGlassSurface } from "../../../theme/glass";
import { Artwork } from "../components/Artwork";
import { octavePaths } from "../octavePaths";
import { HistoryButtons } from "./HistoryButtons";
import { OctaveWordmark } from "./OctaveWordmark";
import { OctaveModeSlot } from "./OctaveModeSlot";
import { DeviceNavItem } from "../offline/DeviceNavItem";
import { OctaveProfileButton } from "../profiles";

export const OCTAVE_DESTINATIONS = [
  { to: octavePaths.home, key: "nav.home", Icon: Home, end: true },
  { to: octavePaths.search, key: "nav.search", Icon: Search, end: false },
  { to: octavePaths.library, key: "nav.library", Icon: Library, end: false },
  { to: octavePaths.liked, key: "nav.liked", Icon: Heart, end: false },
  { to: octavePaths.playlists, key: "nav.playlists", Icon: ListMusic, end: false },
] as const;

const linkClass =
  "octave-nav-link lg-pane-nav flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold text-content-tertiary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

const settingsClass =
  "octave-nav-link -mb-3 flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-content-tertiary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

const playlistClass =
  "octave-nav-link octave-nav-playlist lg-pane-nav flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const OctaveSidebar = memo(function OctaveSidebar({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation(["music", "octaveShell"]);
  const playlists = useMusicPlaylists();
  const native = useLiquidGlassMode() === "native";
  // Le verre de la maquette en mode natif ; ailleurs, le rail sur l'encre.
  const glass = useLiquidGlassSurface({
    material: "pane",
    radius: "xl",
    className: `flex shrink-0 flex-col w-[var(--oc-sidebar-width)] ${native ? "octave-stage-rail" : "h-full gap-5 px-3 pb-3 pt-4"}`,
  });
  return (
    <nav aria-label={t("nav.main")} {...glass.props}>
      {glass.layers}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 pl-3">
          <OctaveWordmark />
          <HistoryButtons />
        </div>
        <OctaveModeSlot onExit={onExit} />
      </div>
      <ul className="octave-rail-destinations flex flex-col gap-0.5">
        {OCTAVE_DESTINATIONS.map(({ to, key, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={linkClass}>
              <Icon className="octave-nav-icon h-5 w-5" aria-hidden />
              {t(key)}
            </NavLink>
          </li>
        ))}
        <DeviceNavItem className={linkClass} />
      </ul>
      <div className="octave-rail-playlists min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <h2 className="octave-rail-heading px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-content-quaternary">{t("nav.yourPlaylists")}</h2>
        <ul className="flex flex-col gap-0.5">
          {(playlists.data ?? []).map((p) => (
            <PlaylistDropTarget key={p.jellyfinId} playlist={p}>
              <NavLink to={octavePaths.playlist(p.jellyfinId)} className={playlistClass}>
                <Artwork url={p.artworkUrl} className="h-9 w-9" />
                <span className="truncate">{p.name}</span>
              </NavLink>
            </PlaylistDropTarget>
          ))}
        </ul>
      </div>
      {/* Les réglages d'Octave, DANS Octave : une entrée discrète au pied du rail, au-dessus du profil. */}
      <NavLink to={octavePaths.settings} className={settingsClass}>
        <Settings2 className="octave-nav-icon h-4 w-4" aria-hidden />
        {t("octaveShell:settings.nav")}
      </NavLink>
      <OctaveProfileButton />
    </nav>
  );
});

/**
 * Une playlist du rail qui ACCUEILLE un titre glissé (bureau, web) : contour rose pendant le survol, l'ajout au
 * dépôt — un doublon demande confirmation, comme tout ajout. Une playlist qu'on ne peut pas modifier ne réagit pas.
 */
function PlaylistDropTarget({ playlist, children }: { playlist: MusicPlaylist; children: ReactNode }) {
  const actions = useTrackActions();
  const [over, setOver] = useState(false);
  const accepts = (e: DragEvent) => playlist.editable && carriesTrack(e);
  return (
    <li
      className={`rounded-xl transition-shadow duration-150 ${over ? "ring-2 ring-octave-accent-text" : ""}`}
      onDragOver={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const track = accepts(e) ? draggedTrack(e) : null;
        if (!track) return;
        e.preventDefault();
        void actions.addToPlaylist(track, playlist);
      }}
    >
      {children}
    </li>
  );
}

/** La barre d'onglets du téléphone : les mêmes cinq destinations, l'active en rose. */
export const OctaveTabBar = memo(function OctaveTabBar() {
  const { t } = useTranslation("music");
  return (
    <nav aria-label={t("nav.main")} className="grid grid-cols-5 border-t border-octave-line bg-octave-ink pb-[env(safe-area-inset-bottom,0px)]">
      {OCTAVE_DESTINATIONS.map(({ to, key, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${isActive ? "text-content-primary" : "text-content-tertiary"}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`h-5 w-5 ${isActive ? "text-octave-accent-text" : ""}`} aria-hidden />
              <span className="truncate">{t(key)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
});
