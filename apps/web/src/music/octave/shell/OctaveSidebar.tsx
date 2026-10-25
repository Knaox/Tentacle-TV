/**
 * Octave — la barre latérale (bureau, fenêtre large) : la marque, les cinq
 * destinations, vos playlists, et la SORTIE du mode, toujours visible en bas.
 * Au téléphone, les mêmes destinations passent dans une barre d'onglets.
 */

import { memo } from "react";
import { Heart, Home, Library, ListMusic, Search } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Artwork } from "../components/Artwork";
import { OctaveLogo } from "../components/OctaveLogo";
import { OctaveModeSwitch } from "../mode/OctaveModeSwitch";
import { useMusicPlaylists } from "@tentacle-tv/api-client";
import { octavePaths } from "../octavePaths";

export const OCTAVE_DESTINATIONS = [
  { to: octavePaths.home, key: "nav.home", Icon: Home, end: true },
  { to: octavePaths.search, key: "nav.search", Icon: Search, end: false },
  { to: octavePaths.library, key: "nav.library", Icon: Library, end: false },
  { to: octavePaths.liked, key: "nav.liked", Icon: Heart, end: false },
  { to: octavePaths.playlists, key: "nav.playlists", Icon: ListMusic, end: false },
] as const;

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
    isActive ? "bg-fill-soft text-content-primary" : "text-content-tertiary hover:text-content-primary"
  }`;

/** La marque du mode : le logo, puis le nom écrit (le logo seul ne se lit pas encore). */
export function OctaveWordmark({ className = "", logoSize = 36 }: { className?: string; logoSize?: number }) {
  return (
    <span className="flex items-center gap-2">
      <OctaveLogo size={logoSize} />
      <span className={`octave-brand-text text-2xl font-black tracking-tight ${className}`}>Octave</span>
    </span>
  );
}

export const OctaveSidebar = memo(function OctaveSidebar({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation("music");
  const playlists = useMusicPlaylists();
  return (
    <nav aria-label={t("nav.main")} className="flex h-full w-[248px] shrink-0 flex-col gap-4 border-r border-line-subtle bg-surface-1 px-3 pb-3 pt-5">
      <div className="px-3">
        <OctaveWordmark />
      </div>
      <ul className="flex flex-col gap-0.5">
        {OCTAVE_DESTINATIONS.map(({ to, key, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={linkClass}>
              <Icon className="h-5 w-5" aria-hidden />
              {t(key)}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mx-3 h-px bg-line-subtle" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-content-quaternary">{t("nav.yourPlaylists")}</h2>
        <ul className="flex flex-col">
          {(playlists.data ?? []).map((p) => (
            <li key={p.jellyfinId}>
              <NavLink
                to={octavePaths.playlist(p.jellyfinId)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${isActive ? "bg-fill-subtle text-content-primary" : "text-content-secondary hover:text-content-primary"}`
                }
              >
                <Artwork url={p.artworkUrl} className="h-9 w-9" />
                <span className="truncate">{p.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <OctaveModeSwitch placement="octave" onExit={onExit} showLabel className="w-full justify-between rounded-lg px-3" />
    </nav>
  );
});

/** La barre d'onglets du téléphone : les mêmes cinq destinations. */
export const OctaveTabBar = memo(function OctaveTabBar() {
  const { t } = useTranslation("music");
  return (
    <nav aria-label={t("nav.main")} className="grid grid-cols-5 border-t border-line-subtle bg-surface-1 pb-[env(safe-area-inset-bottom,0px)]">
      {OCTAVE_DESTINATIONS.map(({ to, key, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${isActive ? "text-content-primary" : "text-content-tertiary"}`
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
          <span className="truncate">{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
});
