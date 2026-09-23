/**
 * Où la barre de navigation mène — et dans quel ordre.
 *
 * Par défaut, la barre montre TOUT ce qui compte d'un coup d'œil : l'accueil,
 * les recommandations, puis les bibliothèques elles-mêmes — plus de menu à
 * ouvrir pour atteindre « Films ». Ma liste, Mes favoris et les pages
 * d'extensions y entrent quand on les épingle (`usePinnedNav`, que le mobile
 * lit aussi). Ce qui ne tient pas en largeur passe dans « Plus » (`NavTabs`).
 *
 * Chacun la dispose ensuite à sa main (`useNavBarLayout`) : toute destination
 * se retire — bibliothèques comprises —, s'épingle, se réordonne. `editor`
 * porte ces gestes pour le panneau « Personnaliser la barre ».
 *
 * Une bibliothèque vide n'a rien à offrir : elle n'est proposée nulle part
 * dans la barre, seulement dans « Plus ».
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
import { useNavBarLayout } from "../../hooks/useNavBarLayout";
import { appendPinned, applyOrder, nudge, reorderPinned, type NavEntryKind } from "./navLayout";

export type NavIcon = ComponentType<LucideProps>;

export interface NavDestination {
  key: string;
  label: string;
  path: string;
  icon: NavIcon;
}

/** Une destination qui peut être dans la barre. */
export interface NavEntry extends NavDestination {
  kind: NavEntryKind;
  pinned: boolean;
}

export interface NavLibrary extends NavDestination {
  count: number;
  /** Une œuvre de la bibliothèque dont le fond illustre sa tuile. */
  artworkId: string | null;
  /** Elle a des titres : elle a sa place dans la barre. */
  watchable: boolean;
  pinned: boolean;
}

export interface NavListEntry extends NavDestination {
  pinned: boolean;
  toggle: () => void;
}

export interface NavBarEditor {
  pin: (key: string) => void;
  unpin: (key: string) => void;
  /** Le nouvel ordre des destinations DE la barre. */
  reorder: (pinnedKeys: string[]) => void;
  nudge: (key: string, delta: -1 | 1) => void;
  reset: () => void;
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
  const bar = useNavBarLayout();

  return useMemo(() => {
    const { layout } = bar;
    const shownByDefault = (key: string) => !layout.hidden.includes(key);

    const libs: NavLibrary[] = (libraries ?? []).map((lib) => {
      const key = `lib-${lib.Id}`;
      const count = lib.RecursiveItemCount ?? 0;
      const art = lib._randomItems?.find((item) => item.hasBackdrop) ?? null;
      return {
        key,
        label: lib.Name,
        path: `/library/${lib.Id}`,
        icon: libraryIcon(lib.CollectionType),
        count,
        artworkId: art?.id ?? null,
        watchable: count > 0,
        pinned: count > 0 && shownByDefault(key),
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

    // L'ordre par défaut, puis celui qu'on a choisi.
    const defaults: Array<NavEntry & { setPinned: (on: boolean) => void }> = [
      { key: "home", label: t("home"), path: "/", icon: House, kind: "core", pinned: shownByDefault("home"), setPinned: (on) => bar.setHidden("home", !on) },
      { key: "recommendations", label: t("forYou"), path: "/recommendations", icon: Sparkles, kind: "core", pinned: shownByDefault("recommendations"), setPinned: (on) => bar.setHidden("recommendations", !on) },
      ...lists.map((entry) => ({ ...entry, kind: "list" as const, setPinned: (on: boolean) => { if (on !== entry.pinned) entry.toggle(); } })),
      ...libs.filter((lib) => lib.watchable).map((lib) => ({
        key: lib.key, label: lib.label, path: lib.path, icon: lib.icon, kind: "library" as const, pinned: lib.pinned,
        setPinned: (on: boolean) => bar.setHidden(lib.key, !on),
      })),
      ...extensions.map((entry) => ({ ...entry, kind: "extension" as const, setPinned: (on: boolean) => { if (on !== entry.pinned) entry.toggle(); } })),
    ];
    const entries = applyOrder(defaults, layout.order);
    const allKeys = entries.map((e) => e.key);
    const pinnedKeys = entries.filter((e) => e.pinned).map((e) => e.key);
    const byKey = new Map(entries.map((e) => [e.key, e]));

    const editor: NavBarEditor = {
      pin: (key) => {
        byKey.get(key)?.setPinned(true);
        bar.setOrder(appendPinned(allKeys, pinnedKeys, key));
      },
      unpin: (key) => byKey.get(key)?.setPinned(false),
      reorder: (keys) => bar.setOrder(reorderPinned(allKeys, keys)),
      nudge: (key, delta) => bar.setOrder(reorderPinned(allKeys, nudge(pinnedKeys, key, delta))),
      // La barre d'origine : tout ce qui y est par défaut, rien d'autre.
      reset: () => {
        bar.reset();
        for (const entry of lists) if (entry.pinned) entry.toggle();
        for (const entry of extensions) if (!entry.pinned) entry.toggle();
      },
    };

    const toEntry = ({ setPinned: _setPinned, ...entry }: (typeof defaults)[number]): NavEntry => entry;
    return {
      /** La barre, dans l'ordre : ce qui y est épinglé. */
      primary: entries.filter((e) => e.pinned).map(toEntry),
      /** Tout ce qui peut y entrer, dans l'ordre choisi. */
      entries: entries.map(toEntry),
      libraries: libs,
      lists,
      extensions,
      editor,
    };
  }, [libraries, plugins, pinned, bar, t, i18n.language]);
}

/** La destination courante : l'accueil à l'égalité stricte, les autres par préfixe. */
export function isActivePath(path: string, pathname: string): boolean {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
