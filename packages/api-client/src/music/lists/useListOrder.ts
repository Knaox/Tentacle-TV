/**
 * Octave — l'ordre d'une liste affichée : la préférence du COMPTE (tri, sens,
 * ordre personnalisé), la recherche et le filtre de l'écran, et le glisser.
 * Sans la capacité `music.listOrder` : la liste telle quelle, aucune barre.
 */

import { useCallback, useMemo, useState } from "react";
import { useMusicListPrefs, useSaveMusicListPrefs } from "../useMusicListOrder";
import { MUSIC_LIST_SORT_KEYS, type MusicListDirection, type MusicListKey, type MusicListNewcomers, type MusicListSortKey } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { jellyfinOrderOf, mergeOrder, movedRows, prefsAfterMove, reorderBlock, usefulFilters, visibleListRows, type JellyfinOrder, type ListFilter, type StatsOf } from "@tentacle-tv/shared/octave";

export type ReorderBlock = "search" | "filter" | "loading";

export interface ListOrderOptions {
  /** Toute la liste est là (les likés arrivent par pages) : sinon, pas de glisser. */
  complete: boolean;
  /** Une playlist modifiable : l'ordre glissé devient aussi celui de la playlist Jellyfin. */
  onJellyfinOrder?: (order: JellyfinOrder) => void;
  /**
   * La liste COMPLÈTE quand `natural` n'en montre qu'une partie (« Sur cet appareil » : les seules copies
   * gardées) : un glisser y déplace le titre parmi tous, les titres cachés gardent leur place.
   */
  full?: readonly ListRow[];
  /** Une playlist partagée : un titre que mon ordre ne connaît pas va à la fin (`musicListOrder.ts`). */
  newcomers?: MusicListNewcomers;
}

/** Le glisser d'une partie (`shown` → `moved`) appliqué à la liste entière : les rangées cachées restent à leur place. */
function movedAmong(all: readonly ListRow[], shown: readonly ListRow[], moved: readonly ListRow[]): ListRow[] {
  const byKey = new Map(all.map((r) => [r.rowKey, r]));
  const keys = mergeOrder(shown.map((r) => r.rowKey), moved.map((r) => r.rowKey), all.map((r) => r.rowKey), "union");
  const shownByKey = new Map(shown.map((r) => [r.rowKey, r]));
  return keys.flatMap((k) => shownByKey.get(k) ?? byKey.get(k) ?? []);
}

export function useListOrder(key: MusicListKey | null, natural: readonly ListRow[], statsOf: StatsOf, options: ListOrderOptions) {
  const { capable, prefs, ready } = useMusicListPrefs(key);
  const save = useSaveMusicListPrefs(key);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const filters = useMemo(() => (capable ? usefulFilters(natural, statsOf) : []), [capable, natural, statsOf]);
  const activeFilter = filters.includes(filter) ? filter : "all";
  // La barre envoie la frappe en transition : ce rendu-ci ne retient jamais une touche.
  const newcomers = options.newcomers;
  const state = useMemo(() => ({ prefs, query, filter: activeFilter, newcomers }), [activeFilter, query, prefs, newcomers]);
  const rows = useMemo(() => (capable ? visibleListRows(natural, statsOf, state) : [...natural]), [capable, natural, statsOf, state]);
  // Sans écoutes connues (aucune statistique), les tris d'écoute ne montreraient rien.
  const sorts = useMemo<MusicListSortKey[]>(
    () => (natural.some((r) => statsOf(r) !== null) ? [...MUSIC_LIST_SORT_KEYS] : MUSIC_LIST_SORT_KEYS.filter((s) => s !== "plays" && s !== "lastPlayed" && s !== "added")),
    [natural, statsOf],
  );

  const onSort = useCallback((sort: MusicListSortKey, direction: MusicListDirection) => save({ ...prefs, sort, direction }), [prefs, save]);
  const { onJellyfinOrder, complete, full } = options;
  const block: ReorderBlock | null = reorderBlock({ prefs, query, filter: activeFilter }) ?? (complete ? null : "loading");
  const onMove = useCallback(
    (from: number, to: number) => {
      if (block) return;
      const before = full ? visibleListRows(full, statsOf, state) : rows;
      const moved = full ? movedAmong(before, rows, movedRows(rows, from, to)) : movedRows(rows, from, to);
      // La base : ce qui était MONTRÉ (la file d'envoi lit contre elle ce que ce geste a déplacé).
      save(prefsAfterMove(prefs, moved), before.map((r) => r.track.key));
      const jellyfin = jellyfinOrderOf(full ?? natural, moved);
      if (jellyfin.entryIds.length > 0) onJellyfinOrder?.(jellyfin);
    },
    [block, full, natural, onJellyfinOrder, prefs, rows, save, state, statsOf],
  );

  // Stable : la liste (mémoïsée) ne se redessine pas à chaque frappe.
  const reorder = useMemo(() => (capable ? { block, onMove } : null), [block, capable, onMove]);
  const reset = useCallback(() => {
    setQuery("");
    setFilter("all");
  }, []);

  return {
    capable,
    reset,
    ready,
    prefs,
    rows,
    query,
    setQuery,
    filter: activeFilter,
    setFilter,
    filters,
    sorts,
    onSort,
    reorder,
  };
}
