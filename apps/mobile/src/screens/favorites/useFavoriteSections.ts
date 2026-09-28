import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { favoritesGroupLabel, groupFavorites, type FavoritesGroup, type FavoritesGroupMode } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

export interface FavoriteSection {
  key: string;
  title: string;
  count: number;
  headed: boolean;
  collapsed: boolean;
  first: boolean;
  /** Les RANGÉES de la grille — `numColumns` titres chacune ; vide si la section est repliée. */
  data: MediaItem[][];
}

/**
 * Les sections de la `SectionList` de Mes favoris : le regroupement partagé
 * (`groupFavorites`, l'ordre du tri gardé), découpé en rangées de
 * `numColumns` affiches — une `SectionList` n'a pas de `numColumns`. Une
 * section repliée garde son en-tête et rend zéro rangée.
 *
 * Le mode vit dans un `useState`, comme les filtres de cet écran : pas
 * d'adresse sur un téléphone, et la liste fermée des clés préchargées
 * (`RNStorageAdapter`) n'est pas à rallonger pour une habitude de lecture.
 */
export function useFavoriteSections(items: MediaItem[], numColumns: number) {
  const { t } = useTranslation("favorites");
  const [mode, setMode] = useState<FavoritesGroupMode>("none");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const sections = useMemo<FavoriteSection[]>(() => {
    const title = (g: FavoritesGroup) => {
      const label = favoritesGroupLabel(g);
      return "text" in label ? label.text : t(label.key, label.params);
    };
    return groupFavorites(items, mode).map((g, i) => {
      const isCollapsed = collapsed.has(g.key);
      const rows: MediaItem[][] = [];
      if (!isCollapsed) for (let k = 0; k < g.items.length; k += numColumns) rows.push(g.items.slice(k, k + numColumns));
      return {
        key: g.key,
        title: g.mode === "none" ? "" : title(g),
        count: g.items.length,
        headed: g.mode !== "none",
        collapsed: isCollapsed,
        first: i === 0,
        data: rows,
      };
    });
  }, [items, mode, collapsed, numColumns, t]);

  return { mode, setMode, sections, toggle };
}
