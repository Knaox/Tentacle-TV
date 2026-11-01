/**
 * Octave — les rangées d'une collection ouverte dans « Sur cet appareil ».
 *
 * Une playlist de la bibliothèque gardée est la playlist EN LIGNE en version
 * hors ligne : ses rangées comme `PlaylistView` les construit (`mergePlaylist`,
 * `libraryFirst`, relues du cache d'Octave sans réseau), chacune avec sa copie
 * gardée (`keptPlaylistRows.ts`), puis les MÊMES outils — la préférence du
 * compte (tri, sens, ordre personnalisé : `useListOrder`, gardée dans le cache
 * d'Octave pour valoir sans réseau), les dates de « Date d'ajout »
 * (`makeStatsOf`), la recherche et les filtres. Le GLISSER aussi (lot « ol ») :
 * appliqué tout de suite, il entre dans la file d'envoi des ordres et part au
 * retour du réseau, fusionné (`orderOutbox`) ; un titre glissé parmi les seules
 * copies gardées se place parmi TOUS (`full` : les rangées en ligne). Pas de
 * retrait : il écrit la playlist, ce que fait la vue en ligne.
 *
 * Un album ou une playlist d'ailleurs : leur ordre gardé, sans barre (leur vue
 * en ligne n'en a pas non plus).
 */

import { useCallback, useMemo } from "react";
import { useLibraryFirstRows, useListOrder, useMusicPlaylist, usePlaylistSharingRules, useReorderMusicPlaylist } from "@tentacle-tv/api-client";
import { parseListKey } from "@tentacle-tv/shared/music";
import { makeStatsOf, mergePlaylist, type JellyfinOrder, type ListRow } from "@tentacle-tv/shared/octave";
import { usePendingMusic } from "../pending/usePendingMusic";
import { playlistTarget } from "./autosync/syncInputs";
import { type DeviceCollection, keptPlaylistRows } from "@tentacle-tv/offline-core/music";

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
  // Comme en ligne (`PlaylistView`) : une playlist modifiable et non partagée prend aussi l'ordre glissé dans Jellyfin.
  const shared = usePlaylistSharingRules(libraryId ? playlist.data : undefined);
  const reorderPlaylist = useReorderMusicPlaylist();
  const onJellyfinOrder = useCallback(
    (next: JellyfinOrder) => {
      if (libraryId) reorderPlaylist(libraryId, next);
    },
    [libraryId, reorderPlaylist],
  );
  const editable = playlist.data?.editable === true && !shared.isShared;
  // « Titres likés » gardés : leur ordre est celui du compte aussi (`liked`).
  const listKey = libraryId ? parseListKey(`playlist:${libraryId}`) : target?.kind === "liked" ? "liked" : null;
  const order = useListOrder(listKey, natural, statsOf, {
    complete: true,
    onJellyfinOrder: editable ? onJellyfinOrder : undefined,
    newcomers: shared.isShared ? "end" : undefined,
    full: online.length > 0 ? online : undefined,
  });
  // Sans clé de liste, `useListOrder` prendrait le tri des likés : l'ordre gardé, tel quel.
  const listed = listKey !== null;
  return {
    natural,
    rows: listed ? order.rows : natural,
    order,
    toolbar: listed && order.capable,
    /** La préférence du compte est connue : jamais une liste qui se réordonne sous les yeux. */
    ready: !listed || order.ready,
  };
}
