/**
 * Octave — les rangées d'une collection ouverte dans « Sur cet appareil ».
 *
 * Une playlist de la bibliothèque gardée est la playlist EN LIGNE en version
 * hors ligne : ses rangées comme `PlaylistView` les construit (`mergePlaylist`,
 * `libraryFirst`, relues du cache d'Octave sans réseau), chacune avec sa copie
 * gardée (`keptPlaylistRows.ts`), puis les MÊMES outils — la préférence du
 * compte (tri, sens, ordre personnalisé : `useListOrder`, gardée dans le cache
 * d'Octave pour valoir sans réseau), les dates de « Date d'ajout »
 * (`makeStatsOf`), la recherche et les filtres. Ni glisser ni retrait : ils
 * écrivent la playlist, ce que fait la vue en ligne.
 *
 * Un album ou une playlist d'ailleurs : leur ordre gardé, sans barre (leur vue
 * en ligne n'en a pas non plus).
 */

import { useMemo } from "react";
import { useMusicPlaylist } from "@tentacle-tv/api-client";
import { parseListKey } from "@tentacle-tv/shared/music";
import { mergePlaylist, type ListRow } from "@tentacle-tv/shared/octave";
import { useLibraryFirstRows } from "../library/useLibraryFirstRows";
import { makeStatsOf } from "../listOrder/listStats";
import { useListOrder } from "../listOrder/useListOrder";
import { usePendingMusic } from "../pending/usePendingMusic";
import { playlistTarget } from "./autosync/syncInputs";
import type { DeviceCollection } from "./deviceModel";
import { keptPlaylistRows } from "./keptPlaylistRows";

const NO_ROWS: readonly ListRow[] = [];

export function useKeptListRows(open: DeviceCollection | null) {
  const target = open ? playlistTarget(open.key) : null;
  const libraryId = target?.kind === "library" ? target.id : null;
  const playlist = useMusicPlaylist(libraryId);
  const pending = usePendingMusic();
  const entries = libraryId ? playlist.data?.entries : undefined;
  const online = useLibraryFirstRows(useMemo(() => (libraryId && entries ? mergePlaylist(entries, pending, libraryId) : NO_ROWS), [entries, libraryId, pending]));
  const natural = useMemo(() => {
    if (!open) return NO_ROWS;
    const kept = open.keys.map((key, i) => ({ key, track: open.tracks[i]! }));
    return keptPlaylistRows(kept, online.length > 0 ? online : null);
  }, [online, open]);
  const statsOf = useMemo(
    () => makeStatsOf({ byEntry: new Map((entries ?? []).flatMap((e) => (e.stats ? [[e.entryId, e.stats] as const] : []))), pending, natural }),
    [entries, natural, pending],
  );
  const order = useListOrder(libraryId ? parseListKey(`playlist:${libraryId}`) : null, natural, statsOf, { complete: true });
  // Sans clé de liste, `useListOrder` prendrait le tri des likés : l'ordre gardé, tel quel.
  const listed = libraryId !== null;
  return {
    natural,
    rows: listed ? order.rows : natural,
    order,
    toolbar: listed && order.capable,
    /** La préférence du compte est connue : jamais une liste qui se réordonne sous les yeux. */
    ready: !listed || order.ready,
  };
}
