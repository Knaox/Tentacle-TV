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

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMusicGestures, useToggleMusicFavorite } from "@tentacle-tv/api-client";
import type { ExternalActionOutcome, MusicTrack } from "@tentacle-tv/shared/music";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../contexts/ToastContext";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
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

  const failed = useCallback((reason: string = "failed") => toast.show("error", t(`refusal.${reason}`), { title: t("refusal.title") }), [t, toast]);

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
      gestures.like(track.external.id, liked).then(
        (outcome: ExternalActionOutcome) => {
          if (!outcome.ok) return revert(), failed(outcome.reason);
          if (liked && outcome.state === "pending" && !options?.quiet) toast.show("success", t("track.likedPending"));
        },
        () => (revert(), failed()),
      );
    },
    [failed, gestures, ownsTrack, player, t, toast, toggleFavorite],
  );

  return useMemo(
    () => ({
      ...playlists,
      canLike: (track: MusicTrack) => isLibraryTrack(track) || (ownsTrack(track) && gestures.canLike),
      toggleLike,
    }),
    [gestures.canLike, ownsTrack, playlists, toggleLike],
  );
}
