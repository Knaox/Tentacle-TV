/**
 * Octave — les gestes GROUPÉS vers une playlist (une sélection, tout un album, toute une playlist), les MÊMES sur le
 * bureau et le mobile : ajouter à une playlist (règle de doublon groupée : tout, sans les doublons, ou rien —
 * `bulkAddPlan`), créer une playlist avec eux. Les titres de la bibliothèque entrent d'une seule requête, dans
 * l'ordre ; ceux d'ailleurs un à un par l'extension (« en attente »), à leur place.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MusicPlaylist, MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { bulkAddPlan, tracksToAdd } from "@tentacle-tv/shared/octave";
import type { MusicProvider } from "../../../pluginMusic/musicProvider";
import { useMusicGestures, useMusicPending } from "../../../pluginMusic/useMusicActions";
import { useAddToMusicPlaylist, useCreateMusicPlaylist, useMusicPlaylistReader } from "../../useMusicPlaylists";
import type { OctaveActionsUi } from "./actionsUi";
import { askBulkDuplicates } from "./bulkDuplicateAsk";
import { rememberPlaylistIn } from "./lastPlaylist";
import { isLibraryTrack } from "./usePlaylistGestures";

export interface BulkTrackGestures {
  addToPlaylist: (tracks: readonly MusicTrack[], playlist: MusicPlaylist) => Promise<boolean>;
  createPlaylistAndAdd: (tracks: readonly MusicTrack[], name: string) => Promise<boolean>;
}

interface Item {
  track: MusicTrack;
  duplicate: boolean;
}

/** `canAdd` : la règle d'un titre seul (`canAddToPlaylist` des gestes de titre) — un titre qu'elle refuse est laissé de côté. */
export function useBulkTrackGestures(provider: MusicProvider | null, ui: Pick<OctaveActionsUi, "t" | "notify" | "store">, canAdd: (track: MusicTrack) => boolean): BulkTrackGestures {
  const { t, notify, store } = ui;
  const gestures = useMusicGestures(provider);
  const readPlaylist = useMusicPlaylistReader();
  const { mutateAsync: insertEntries } = useAddToMusicPlaylist();
  const { mutateAsync: createPlaylist } = useCreateMusicPlaylist();
  const pending = useMusicPending(provider).data.items;
  const pendingRef = useRef<readonly PendingMusicItem[]>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const failed = useCallback((reason: string = "failed") => notify("error", t(`refusal.${reason}`), { title: t("refusal.title") }), [notify, t]);

  /** Les titres entrent à la fin de la playlist ; rend combien attendent la bibliothèque (`null` : refus). */
  const insert = useCallback(
    async (playlistId: string, items: readonly Item[], end: number): Promise<number | null> => {
      const library = items.map((i) => i.track).filter(isLibraryTrack);
      if (library.length > 0) await insertEntries({ playlistId, itemIds: library.map((tr) => tr.jellyfinId), tracks: library });
      let waiting = 0;
      let at = end + library.length;
      for (const { track, duplicate } of items) {
        if (isLibraryTrack(track) || !track.external) continue;
        const outcome = await gestures.playlistAdd(track.external.id, playlistId, at, duplicate);
        if (!outcome.ok) {
          failed(outcome.reason);
          return null;
        }
        at += 1;
        if (outcome.state === "pending") waiting += 1;
      }
      return waiting;
    },
    [failed, gestures, insertEntries],
  );

  const addToPlaylist = useCallback(
    async (tracks: readonly MusicTrack[], playlist: MusicPlaylist): Promise<boolean> => {
      try {
        const detail = await readPlaylist(playlist.jellyfinId).catch(() => null);
        const plan = bulkAddPlan(tracks, detail?.entries ?? [], pendingRef.current, playlist.jellyfinId, canAdd);
        const choice = plan.duplicates.length > 0 ? await askBulkDuplicates(plan.duplicates.length, plan.fresh.length + plan.duplicates.length, playlist.name) : "all";
        const items = tracksToAdd(plan, choice);
        if (!items || items.length === 0) return false;
        const waiting = await insert(playlist.jellyfinId, items, detail?.entries.length ?? playlist.trackCount);
        if (waiting === null) return false;
        rememberPlaylistIn(store, playlist.jellyfinId);
        notify("success", t(waiting > 0 ? "selection.addedPending" : "selection.added", { count: items.length, name: playlist.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [canAdd, failed, insert, notify, readPlaylist, store, t],
  );

  const createPlaylistAndAdd = useCallback(
    async (tracks: readonly MusicTrack[], name: string): Promise<boolean> => {
      try {
        const able = tracks.filter(canAdd);
        const library = able.filter(isLibraryTrack);
        const created = await createPlaylist({ name, itemIds: library.map((tr) => tr.jellyfinId) });
        const waiting = await insert(created.jellyfinId, able.filter((tr) => !isLibraryTrack(tr)).map((track) => ({ track, duplicate: false })), library.length);
        if (waiting === null) return false;
        rememberPlaylistIn(store, created.jellyfinId);
        notify("success", t(waiting > 0 ? "selection.addedPending" : "selection.added", { count: able.length, name: created.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [canAdd, createPlaylist, failed, insert, notify, store, t],
  );

  return useMemo(() => ({ addToPlaylist, createPlaylistAndAdd }), [addToPlaylist, createPlaylistAndAdd]);
}
