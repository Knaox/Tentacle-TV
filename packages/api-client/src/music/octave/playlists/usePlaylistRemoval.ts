/**
 * Octave — retirer des titres de CETTE playlist d'un geste (le bouton de la rangée, le menu, la sélection), et
 * l'avis « Retiré de X — Annuler » qui les remet à leur place (`removalPlan`, shared). Une entrée Jellyfin se
 * retire ; une attente hors bibliothèque aussi (sa demande s'annule chez l'extension, « Annuler » la redemande).
 * L'avis passe par l'interface de l'application (`OctaveActionsUi` : le toast du web, l'avis du mobile).
 */

import { useCallback, useEffect, useRef } from "react";
import type { PendingMusicItem } from "@tentacle-tv/shared/music";
import { applyRemoval, applyRestore, removalCount, removalPlan, type ListRow, type RemovalDeps } from "@tentacle-tv/shared/octave";
import { useMusicGestures, useMusicPending } from "../../../pluginMusic/useMusicActions";
import type { MusicProvider } from "../../../pluginMusic/musicProvider";
import { useAddToMusicPlaylist, useRemoveMusicPlaylistEntry } from "../../useMusicPlaylists";
import type { OctaveActionsUi } from "../actions/actionsUi";

export interface PlaylistTarget {
  jellyfinId: string;
  name: string;
}

export function usePlaylistRemoval(
  provider: MusicProvider | null,
  playlist: PlaylistTarget | null,
  ui: Pick<OctaveActionsUi, "t" | "notify" | "onRemovedFromPlaylist" | "onRestoredToPlaylist">,
): (rows: readonly ListRow[], keys: ReadonlySet<string>) => Promise<boolean> {
  const { t, notify, onRemovedFromPlaylist, onRestoredToPlaylist } = ui;
  const gestures = useMusicGestures(provider);
  const { mutateAsync: removeEntry } = useRemoveMusicPlaylistEntry();
  const { mutateAsync: insertEntries } = useAddToMusicPlaylist();
  // Lue au geste : le rappel reste stable pendant que les attentes se relisent.
  const pending = useMusicPending(provider).data.items;
  const pendingRef = useRef<readonly PendingMusicItem[]>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const deps = useCallback(
    (target: PlaylistTarget): RemovalDeps => ({
      removeEntry: (e) => removeEntry({ playlistId: target.jellyfinId, entryId: e.entryId }),
      removeWait: (w) => gestures.removePending(w.operationId),
      insertEntry: (e) => insertEntries({ playlistId: target.jellyfinId, itemIds: [e.itemId as string], position: e.position, tracks: [e.track] }),
      addWait: async (w) => (await gestures.playlistAdd(w.externalId as string, target.jellyfinId, w.position ?? Number.MAX_SAFE_INTEGER, w.duplicate)).ok,
    }),
    [gestures, insertEntries, removeEntry],
  );
  const failed = useCallback(() => notify("error", t("refusal.failed"), { title: t("refusal.title") }), [notify, t]);

  return useCallback(
    async (rows, keys) => {
      if (!playlist) return false;
      const target = playlist;
      const plan = removalPlan(rows, keys, pendingRef.current);
      const count = removalCount(plan);
      if (count === 0) return false;
      const done = await applyRemoval(deps(target), plan);
      const removed = removalCount(done);
      if (removed === 0) {
        failed();
        return false;
      }
      const removedTracks = [...done.entries, ...done.waits].map((r) => r.track);
      // Ce qui reste listé : toute rangée qui n'est pas VRAIMENT partie (non visée, refusée, l'autre occurrence d'un doublon).
      const goneEntries = new Set(done.entries.map((e) => e.entryId));
      const goneWaits = new Set(done.waits.map((w) => w.operationId));
      const stillListed = new Set(
        rows.filter((r) => !(r.entryId !== null && goneEntries.has(r.entryId)) && !(r.pending && goneWaits.has(r.pending.operationId))).map((r) => r.track.key),
      );
      onRemovedFromPlaylist?.(target.jellyfinId, removedTracks, stillListed);
      const single = removed === 1 ? (done.entries[0] ?? done.waits[0])?.track : undefined;
      const message = single ? t("playlist.removedOne", { title: single.title, name: target.name }) : t("playlist.removedMany", { count: removed, name: target.name });
      const undo = async () => {
        if (await applyRestore(deps(target), done)) {
          onRestoredToPlaylist?.(target.jellyfinId, removedTracks);
          notify("success", t("playlist.restored", { name: target.name }));
        }
        else failed();
      };
      notify("success", message, { action: { label: t("playlist.undo"), onPress: () => void undo() } });
      return true;
    },
    [deps, failed, notify, onRemovedFromPlaylist, onRestoredToPlaylist, playlist, t],
  );
}
