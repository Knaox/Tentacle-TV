/**
 * Où la barre de navigation mène — et dans quel ordre.
 *
 * La barre montre TOUT ce qui compte d'un coup d'œil : l'accueil, les
 * recommandations, puis les bibliothèques elles-mêmes — plus de menu à ouvrir
 * pour atteindre « Films ». Ma liste, Mes favoris et les pages d'extensions y
 * entrent quand on les épingle (`usePinnedNav`, inchangé : le mobile le lit
 * aussi). Ce qui ne tient pas en largeur passe dans « Plus » (`NavTabs`).
 *
 * Une bibliothèque sans film ni série (musique, livres) n'a rien à offrir
 * ici : elle reste dans « Plus ».
 */

import { useMemo, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Bookmark, Clapperboard, Film, FolderOpen, Heart, House, Layers, Music, Puzzle, Sparkles, Tv,
  type LucideProps,
} from "lucide-react";
import { useLibraries } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { resolvePluginLabel } from "../lucideIcon";
import { pluginNavKey, usePinnedNav } from "../../hooks/usePinnedNav";

export type NavIcon = ComponentType<LucideProps>;

export interface NavDestination {
  key: string;
  label: string;
  path: string;
  icon: NavIcon;
}

export interface NavLibrary extends NavDestination {
  count: number;
  /** Une œuvre de la bibliothèque dont le fond illustre sa tuile. */
  artworkId: string | null;
  /** Des films ou des séries : elle a sa place dans la barre. */
  watchable: boolean;
}

export interface NavListEntry extends NavDestination {
  pinned: boolean;
  toggle: () => void;
}

/** L'icône d'une bibliothèque selon ce qu'elle contient. */
export function libraryIcon(collectionType: string | undefined): NavIcon {
  switch (collectionType) {
    case "movies": return Film;
    case "tvshows": return Tv;
    case "boxsets": return Layers;
    case "homevideos": return Clapperboard;
    case "music": return Music;
    case "books": return BookOpen;
    default: return FolderOpen;
  }
}

export function useNavDestinations() {
  const { t, i18n } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const plugins = useActivePluginsMeta();
  const pinned = usePinnedNav();

  return useMemo(() => {
    const libs: NavLibrary[] = (libraries ?? []).map((lib) => {
      const count = lib.RecursiveItemCount ?? 0;
      const art = lib._randomItems?.find((item) => item.hasBackdrop) ?? null;
      return {
        key: `lib-${lib.Id}`,
        label: lib.Name,
        path: `/library/${lib.Id}`,
        icon: libraryIcon(lib.CollectionType),
        count,
        artworkId: art?.id ?? null,
        watchable: count > 0,
      };
    });

    const lists: NavListEntry[] = [
      { key: "watchlist", label: t("myList"), path: "/watchlist", icon: Bookmark, pinned: pinned.watchlist, toggle: pinned.toggleWatchlist },
      { key: "favorites", label: t("myFavorites"), path: "/favorites", icon: Heart, pinned: pinned.favorites, toggle: pinned.toggleFavorites },
    ];

    const extensions: NavListEntry[] = [];
    for (const plugin of plugins) {
      if (plugin.configEnabled !== true) continue;
      for (const nav of plugin.navItems ?? []) {
        if (nav.admin || !nav.platforms?.includes("web")) continue;
        const key = pluginNavKey(plugin.pluginId, nav.path);
        extensions.push({
          key: `plugin-${key}`,
          label: resolvePluginLabel(nav.labels ?? nav.label, i18n.language),
          path: nav.path,
          icon: Puzzle,
          pinned: pinned.isPluginNavPinned(key),
          toggle: () => pinned.togglePluginNav(key),
        });
      }
    }

    const primary: NavDestination[] = [
      { key: "home", label: t("home"), path: "/", icon: House },
      { key: "recommendations", label: t("forYou"), path: "/recommendations", icon: Sparkles },
      ...lists.filter((entry) => entry.pinned),
      ...libs.filter((lib) => lib.watchable),
      ...extensions.filter((entry) => entry.pinned),
    ];

    return { primary, libraries: libs, lists, extensions };
  }, [libraries, plugins, pinned, t, i18n.language]);
}

/** La destination courante : l'accueil à l'égalité stricte, les autres par préfixe. */
export function isActivePath(path: string, pathname: string): boolean {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
