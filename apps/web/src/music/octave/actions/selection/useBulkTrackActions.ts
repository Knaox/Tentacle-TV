/**
 * Octave — les gestes GROUPÉS d'une sélection (bulkRules.ts) : ajouter à une playlist (règle de doublon : tous,
 * sans les doublons, ou rien), créer une playlist avec eux, aimer, ajouter à la file. Les titres de la
 * bibliothèque entrent d'une seule requête ; ceux d'ailleurs, un à un par l'extension (« en attente »).
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAddToMusicPlaylist, useCreateMusicPlaylist, useMusicGestures, useMusicPlaylistReader } from "@tentacle-tv/api-client";
import type { MusicPlaylist, MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../../contexts/ToastContext";
import { useOctaveProvider } from "../../mode/useOctaveProvider";
import { usePendingMusic } from "../../pending/usePendingMusic";
import { useOctavePlayer } from "../../player/OctavePlayerProvider";
import { rememberPlaylist } from "../lastPlaylist";
import { likeOverrideOf } from "../likeOverrides";
import { isLibraryTrack } from "../usePlaylistGestures";
import { useTrackActions } from "../useTrackActions";
import { askBulkDuplicates } from "./bulkDuplicateConfirm";
import { bulkAddPlan, bulkLikePlan, tracksToAdd } from "./bulkRules";

export interface BulkTrackActions {
  addToPlaylist: (tracks: readonly MusicTrack[], playlist: MusicPlaylist) => Promise<boolean>;
  createPlaylistAndAdd: (tracks: readonly MusicTrack[], name: string) => Promise<boolean>;
  /** Aime ceux qui ne le sont pas ; tous déjà aimés, les retire des likés. */
  like: (tracks: readonly MusicTrack[]) => void;
  enqueue: (tracks: readonly MusicTrack[]) => void;
}

interface Item {
  track: MusicTrack;
  duplicate: boolean;
}

export function useBulkTrackActions(): BulkTrackActions {
  const { t } = useTranslation("music");
  const toast = useToast();
  const player = useOctavePlayer();
  const actions = useTrackActions();
  const gestures = useMusicGestures(useOctaveProvider());
  const readPlaylist = useMusicPlaylistReader();
  const { mutateAsync: insertEntries } = useAddToMusicPlaylist();
  const { mutateAsync: createPlaylist } = useCreateMusicPlaylist();
  const pending = usePendingMusic();
  const pendingRef = useRef<readonly PendingMusicItem[]>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const failed = useCallback((reason: string = "failed") => toast.show("error", t(`refusal.${reason}`), { title: t("refusal.title") }), [t, toast]);

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
        const plan = bulkAddPlan(tracks, detail?.entries ?? [], pendingRef.current, playlist.jellyfinId, actions.canAddToPlaylist);
        const choice = plan.duplicates.length > 0 ? await askBulkDuplicates(plan.duplicates.length, plan.fresh.length + plan.duplicates.length, playlist.name) : "all";
        const items = tracksToAdd(plan, choice);
        if (!items || items.length === 0) return false;
        const waiting = await insert(playlist.jellyfinId, items, detail?.entries.length ?? playlist.trackCount);
        if (waiting === null) return false;
        rememberPlaylist(playlist.jellyfinId);
        toast.show("success", t(waiting > 0 ? "selection.addedPending" : "selection.added", { count: items.length, name: playlist.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [actions.canAddToPlaylist, failed, insert, readPlaylist, t, toast],
  );

  const createPlaylistAndAdd = useCallback(
    async (tracks: readonly MusicTrack[], name: string): Promise<boolean> => {
      try {
        const able = tracks.filter(actions.canAddToPlaylist);
        const library = able.filter(isLibraryTrack);
        const created = await createPlaylist({ name, itemIds: library.map((tr) => tr.jellyfinId) });
        const waiting = await insert(created.jellyfinId, able.filter((tr) => !isLibraryTrack(tr)).map((track) => ({ track, duplicate: false })), library.length);
        if (waiting === null) return false;
        rememberPlaylist(created.jellyfinId);
        toast.show("success", t(waiting > 0 ? "selection.addedPending" : "selection.added", { count: able.length, name: created.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [actions.canAddToPlaylist, createPlaylist, failed, insert, t, toast],
  );

  const like = useCallback(
    (tracks: readonly MusicTrack[]) => {
      const plan = bulkLikePlan(tracks, (tr) => likeOverrideOf(tr.key) ?? tr.favorite, actions.canLike);
      if (plan.tracks.length === 0) return;
      for (const track of plan.tracks) actions.toggleLike(track, { quiet: true });
      toast.show("success", t(plan.liked ? "selection.liked" : "selection.unliked", { count: plan.tracks.length }));
    },
    [actions, t, toast],
  );

  const enqueue = useCallback(
    (tracks: readonly MusicTrack[]) => {
      if (tracks.length === 0) return;
      queueActions.enqueue(player, tracks);
      toast.show("success", t("selection.queued", { count: tracks.length }));
    },
    [player, t, toast],
  );

  return useMemo(() => ({ addToPlaylist, createPlaylistAndAdd, like, enqueue }), [addToPlaylist, createPlaylistAndAdd, enqueue, like]);
}
