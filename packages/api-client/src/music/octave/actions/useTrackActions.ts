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
 * Web, bureau et mobile : les MÊMES gestes ; l'application passe son extension, son lecteur (`null` : la file
 * n'est simplement pas retouchée) et son interface.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ExternalActionOutcome, ExternalActionRefusal, MusicTrack } from "@tentacle-tv/shared/music";
import { queueActions, type OctavePlayer } from "@tentacle-tv/shared/octave";
import type { MusicProvider } from "../../../pluginMusic/musicProvider";
import { useMusicGestures } from "../../../pluginMusic/useMusicActions";
import { useToggleMusicFavorite } from "../../useMusicFavorite";
import { isFromMusicProvider } from "../useMusicEntities";
import type { OctaveActionsUi } from "./actionsUi";
import { useAcquireRights } from "./useAcquireRights";
import { likeOverrideOf, setLikeOverride } from "./likeOverrides";
import { isLibraryTrack, usePlaylistGestures, type PlaylistGestures } from "./usePlaylistGestures";

export interface TrackActions extends PlaylistGestures {
  canLike: (track: MusicTrack) => boolean;
  /** `quiet` : pas d'avis par titre (un geste groupé dit le sien). */
  toggleLike: (track: MusicTrack, options?: { quiet?: boolean }) => void;
}

export function useTrackActions(provider: MusicProvider | null, player: OctavePlayer | null, ui: OctaveActionsUi): TrackActions {
  const { t } = ui;
  const toast = useMemo(() => ({ show: ui.notify }), [ui.notify]);
  const gestures = useMusicGestures(provider);
  const playlists = usePlaylistGestures(provider, ui);
  const { mutate: toggleFavorite } = useToggleMusicFavorite();
  // Aimer un titre hors bibliothèque l'AJOUTE à la bibliothèque : le droit et la limite du jour (rights/).
  // Lu au geste (une référence) : les gestes restent STABLES quand les droits se relisent après un ajout.
  const acquire = useAcquireRights(provider, t);
  const acquireRef = useRef(acquire);
  useEffect(() => {
    acquireRef.current = acquire;
  }, [acquire]);

  const failed = useCallback((reason: ExternalActionRefusal = "failed") => {
    const said = acquireRef.current.refusal(reason);
    toast.show("error", said.message, { title: said.title });
  }, [toast]);

  const ownsTrack = useCallback((track: MusicTrack) => isFromMusicProvider(provider, track.external?.pluginId), [provider]);

  const toggleLike = useCallback(
    (track: MusicTrack, options?: { quiet?: boolean }) => {
      const liked = !(likeOverrideOf(track.key) ?? track.favorite);
      setLikeOverride(track.key, liked);
      if (player) queueActions.patchFavorite(player, track.key, liked);
      const revert = () => {
        setLikeOverride(track.key, !liked);
        if (player) queueActions.patchFavorite(player, track.key, !liked);
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
