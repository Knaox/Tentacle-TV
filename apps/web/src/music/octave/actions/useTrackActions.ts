/**
 * Octave — les gestes sur un titre : le cœur, et ceux de playlist (usePlaylistGestures.ts : ajouter, retirer).
 *
 * Bibliothèque : `useToggleMusicFavorite` (A3 : favori Jellyfin, optimiste dans
 * tout le cache, retour arrière sur refus) et `useAddToMusicPlaylist` (A3 :
 * insertion à une POSITION, optimiste). Hors bibliothèque : `useMusicGestures`
 * (A5, réponse immédiate `pending`) — le cœur est plein AU CLIC, le titre paraît
 * « en attente » dans Titres likés et la playlist jusqu'à `music:resolved`.
 * Le cœur affiché vit aussi dans `likeOverrides` : il couvre la file et la barre,
 * qui tiennent des copies des titres. Un geste impossible n'est pas proposé.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMusicGestures, useToggleMusicFavorite } from "@tentacle-tv/api-client";
import type { ExternalActionOutcome, ExternalActionRefusal, MusicTrack } from "@tentacle-tv/shared/music";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../contexts/ToastContext";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { useAcquireRights } from "../rights/useAcquireRights";
import { likeOverrideOf, setLikeOverride } from "./likeOverrides";
import { isLibraryTrack, usePlaylistGestures, type PlaylistGestures } from "./usePlaylistGestures";

export interface TrackActions extends PlaylistGestures {
  canLike: (track: MusicTrack) => boolean;
  /** `quiet` : pas d'avis par titre (un geste groupé dit le sien). */
  toggleLike: (track: MusicTrack, options?: { quiet?: boolean }) => void;
}

export function useTrackActions(): TrackActions {
  const { t } = useTranslation("music");
  const toast = useToast();
  const player = useOctavePlayer();
  const provider = useOctaveProvider();
  const gestures = useMusicGestures(provider);
  const playlists = usePlaylistGestures();
  const { mutate: toggleFavorite } = useToggleMusicFavorite();
  // Aimer un titre hors bibliothèque l'AJOUTE à la bibliothèque : le droit et la limite du jour (rights/).
  // Lu au geste (une référence) : les gestes restent STABLES quand les droits se relisent après un ajout.
  const acquire = useAcquireRights();
  const acquireRef = useRef(acquire);
  useEffect(() => {
    acquireRef.current = acquire;
  }, [acquire]);

  const failed = useCallback((reason: ExternalActionRefusal = "failed") => {
    const said = acquireRef.current.refusal(reason);
    toast.show("error", said.message, { title: said.title });
  }, [toast]);

  const ownsTrack = useCallback((track: MusicTrack) => isFromProvider(provider, track.external?.pluginId), [provider]);

  const toggleLike = useCallback(
    (track: MusicTrack, options?: { quiet?: boolean }) => {
      const liked = !(likeOverrideOf(track.key) ?? track.favorite);
      setLikeOverride(track.key, liked);
      queueActions.patchFavorite(player, track.key, liked);
      const revert = () => {
        setLikeOverride(track.key, !liked);
        queueActions.patchFavorite(player, track.key, !liked);
      };
      if (isLibraryTrack(track)) {
        toggleFavorite({ track, favorite: liked }, { onError: () => (revert(), failed()) });
        return;
      }
      if (!track.external || !ownsTrack(track)) return revert();
      if (liked && acquireRef.current.exhausted) return revert(), failed("quota");
      gestures.like(track.external.id, liked).then(
        (outcome: ExternalActionOutcome) => {
          if (!outcome.ok) return revert(), failed(outcome.reason);
          const left = liked && outcome.state === "pending" ? acquireRef.current.acquired() : null;
          if (liked && outcome.state === "pending" && !options?.quiet) toast.show("success", left ?? t("track.likedPending"), left ? { title: t("track.likedPending") } : undefined);
        },
        () => (revert(), failed()),
      );
    },
    [failed, gestures, ownsTrack, player, t, toast, toggleFavorite],
  );

  return useMemo(
    () => ({
      ...playlists,
      // Sans le droit d'ajouter, plus de cœur — sauf pour retirer un titre déjà aimé.
      canLike: (track: MusicTrack) =>
        isLibraryTrack(track) || (ownsTrack(track) && gestures.canLike && (acquire.canAcquire || (likeOverrideOf(track.key) ?? track.favorite))),
      toggleLike,
    }),
    [acquire.canAcquire, gestures.canLike, ownsTrack, playlists, toggleLike],
  );
}
