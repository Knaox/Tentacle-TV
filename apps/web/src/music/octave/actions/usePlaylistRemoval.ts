/**
 * Octave — retirer des titres de CETTE playlist d'un geste (le bouton de la rangée, le menu, la sélection), et
 * l'avis « Retiré de X — Annuler » qui les remet à leur place (removalPlan.ts). Une entrée Jellyfin se retire ;
 * une attente hors bibliothèque aussi (sa demande s'annule chez l'extension, « Annuler » la redemande).
 */

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAddToMusicPlaylist, useMusicGestures, useRemoveMusicPlaylistEntry } from "@tentacle-tv/api-client";
import type { PendingMusicItem } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../contexts/ToastContext";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { usePendingMusic } from "../pending/usePendingMusic";
import { applyRemoval, applyRestore, removalCount, removalPlan, type RemovalDeps } from "./removalPlan";

export interface PlaylistTarget {
  jellyfinId: string;
  name: string;
}

export function usePlaylistRemoval(playlist: PlaylistTarget | null): (rows: readonly ListRow[], keys: ReadonlySet<string>) => Promise<boolean> {
  const { t } = useTranslation("music");
  const toast = useToast();
  const gestures = useMusicGestures(useOctaveProvider());
  const { mutateAsync: removeEntry } = useRemoveMusicPlaylistEntry();
  const { mutateAsync: insertEntries } = useAddToMusicPlaylist();
  // Lue au geste : le rappel reste stable pendant que les attentes se relisent.
  const pending = usePendingMusic();
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
  const failed = useCallback(() => toast.show("error", t("refusal.failed"), { title: t("refusal.title") }), [t, toast]);

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
      const single = removed === 1 ? (done.entries[0] ?? done.waits[0])?.track : undefined;
      const message = single ? t("playlist.removedOne", { title: single.title, name: target.name }) : t("playlist.removedMany", { count: removed, name: target.name });
      const undo = async () => {
        if (await applyRestore(deps(target), done)) toast.show("success", t("playlist.restored", { name: target.name }));
        else failed();
      };
      toast.show("success", message, { action: { label: t("playlist.undo"), onPress: () => void undo() } });
      return true;
    },
    [deps, failed, playlist, t, toast],
  );
}
