/**
 * Octave — la barre latérale (bureau, fenêtre large) : la marque et ‹ › en
 * tête, juste dessous la BASCULE du mode (`OctaveModeSlot` : la première
 * chose qu'on voit, jamais perdue en pied de rail), puis les cinq
 * destinations et vos playlists. Au téléphone, les mêmes destinations passent
 * dans une barre d'onglets.
 *
 * L'identité : un RAIL posé sur l'encre, sans dalle ni bordure ; l'entrée
 * active prend la pastille de Tentacle, rose en tête, son icône rose
 * (`shell.css`, sur `aria-current` que pose `NavLink`). En verre natif, le
 * rail devient un panneau qui flotte (surface de la primitive).
 */

import { memo } from "react";
import { Heart, Home, Library, ListMusic, Search } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicPlaylists } from "@tentacle-tv/api-client";
import { useLiquidGlassMode, useLiquidGlassSurface } from "../../../theme/glass";
import { Artwork } from "../components/Artwork";
import { OctaveLogo } from "../components/OctaveLogo";
import { octavePaths } from "../octavePaths";
import { HistoryButtons } from "./HistoryButtons";
import { OctaveModeSlot } from "./OctaveModeSlot";

export const OCTAVE_DESTINATIONS = [
  { to: octavePaths.home, key: "nav.home", Icon: Home, end: true },
  { to: octavePaths.search, key: "nav.search", Icon: Search, end: false },
  { to: octavePaths.library, key: "nav.library", Icon: Library, end: false },
  { to: octavePaths.liked, key: "nav.liked", Icon: Heart, end: false },
  { to: octavePaths.playlists, key: "nav.playlists", Icon: ListMusic, end: false },
] as const;

const linkClass =
  "octave-nav-link flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold text-content-tertiary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

const playlistClass =
  "octave-nav-link flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/** La marque du mode : le logo, puis le nom écrit au dégradé (le logo seul ne se lit pas encore). */
export function OctaveWordmark({ className = "", logoSize = 32 }: { className?: string; logoSize?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <OctaveLogo size={logoSize} />
      <span className={`oc-gradient-text truncate text-[22px] font-black tracking-tight ${className}`}>Octave</span>
    </span>
  );
}

export const OctaveSidebar = memo(function OctaveSidebar({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation("music");
  const playlists = useMusicPlaylists();
  const native = useLiquidGlassMode() === "native";
  // Un GRAND verre en mode natif (ton tenu) ; ailleurs, le rail sur l'encre.
  const glass = useLiquidGlassSurface({
    radius: "lg",
    scale: "surface",
    className: `flex shrink-0 flex-col gap-5 pb-3 pt-4 w-[var(--oc-sidebar-width)] ${native ? "octave-glass octave-rail-glass my-2 ml-2 px-2" : "h-full px-3"}`,
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
      <ul className="flex flex-col gap-0.5">
        {OCTAVE_DESTINATIONS.map(({ to, key, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={linkClass}>
              <Icon className="octave-nav-icon h-5 w-5" aria-hidden />
              {t(key)}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <h2 className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-content-quaternary">{t("nav.yourPlaylists")}</h2>
        <ul className="flex flex-col gap-0.5">
          {(playlists.data ?? []).map((p) => (
            <li key={p.jellyfinId}>
              <NavLink to={octavePaths.playlist(p.jellyfinId)} className={playlistClass}>
                <Artwork url={p.artworkUrl} className="h-9 w-9" />
                <span className="truncate">{p.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
});

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
