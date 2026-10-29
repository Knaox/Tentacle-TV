/**
 * Octave — les gestes GROUPÉS d'une sélection, côté web : ceux vers une playlist viennent d'api-client
 * (`useBulkTrackGestures`, les mêmes que le mobile : règle de doublon groupée, ordre gardé) ; ici, la file
 * (« Lire ensuite », « Ajouter à la file ») et le cœur, branchés sur le lecteur et les cœurs du web.
 */

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useBulkTrackGestures } from "@tentacle-tv/api-client";
import type { MusicPlaylist, MusicTrack } from "@tentacle-tv/shared/music";
import { bulkLikePlan, queueActions } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../../contexts/ToastContext";
import { useOctaveProvider } from "../../mode/useOctaveProvider";
import { useOctavePlayer } from "../../player/OctavePlayerProvider";
import { likeOverrideOf } from "../likeOverrides";
import { useOctaveActionsUi } from "../useOctaveActionsUi";
import { useTrackActions } from "../useTrackActions";

export interface BulkTrackActions {
  addToPlaylist: (tracks: readonly MusicTrack[], playlist: MusicPlaylist) => Promise<boolean>;
  createPlaylistAndAdd: (tracks: readonly MusicTrack[], name: string) => Promise<boolean>;
  /** Aime ceux qui ne le sont pas ; tous déjà aimés, les retire des likés. */
  like: (tracks: readonly MusicTrack[]) => void;
  playNext: (tracks: readonly MusicTrack[]) => void;
  enqueue: (tracks: readonly MusicTrack[]) => void;
}

export function useBulkTrackActions(): BulkTrackActions {
  const { t } = useTranslation("music");
  const toast = useToast();
  const player = useOctavePlayer();
  const actions = useTrackActions();
  const { addToPlaylist, createPlaylistAndAdd } = useBulkTrackGestures(useOctaveProvider(), useOctaveActionsUi(), actions.canAddToPlaylist);

  const like = useCallback(
    (tracks: readonly MusicTrack[]) => {
      const plan = bulkLikePlan(tracks, (tr) => likeOverrideOf(tr.key) ?? tr.favorite, actions.canLike);
      if (plan.tracks.length === 0) return;
      for (const track of plan.tracks) actions.toggleLike(track, { quiet: true });
      toast.show("success", t(plan.liked ? "selection.liked" : "selection.unliked", { count: plan.tracks.length }));
    },
    [actions, t, toast],
  );

  const playNext = useCallback(
    (tracks: readonly MusicTrack[]) => {
      if (tracks.length === 0) return;
      queueActions.playNext(player, tracks);
      toast.show("success", t("selection.playNext", { count: tracks.length }));
    },
    [player, t, toast],
  );

  const enqueue = useCallback(
    (tracks: readonly MusicTrack[]) => {
      if (tracks.length === 0) return;
      queueActions.enqueue(player, tracks);
      toast.show("success", t("selection.queued", { count: tracks.length }));
    },
    [player, t, toast],
  );

  return useMemo(() => ({ addToPlaylist, createPlaylistAndAdd, like, playNext, enqueue }), [addToPlaylist, createPlaylistAndAdd, enqueue, like, playNext]);
}
