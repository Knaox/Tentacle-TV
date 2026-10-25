/**
 * Octave — les gestes sur un titre : le cœur et l'ajout à une playlist.
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
import { useAddToMusicPlaylist, useMusicGestures, useToggleMusicFavorite } from "@tentacle-tv/api-client";
import type { ExternalActionOutcome, MusicPlaylist, MusicTrack } from "@tentacle-tv/shared/music";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../contexts/ToastContext";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { likeOverrideOf, setLikeOverride } from "./likeOverrides";

export interface TrackActions {
  canLike: (track: MusicTrack) => boolean;
  toggleLike: (track: MusicTrack) => void;
  canAddToPlaylist: (track: MusicTrack) => boolean;
  /** `position` : la place voulue (0 = en tête) ; absente, à la fin. */
  addToPlaylist: (track: MusicTrack, playlist: MusicPlaylist, position?: number) => Promise<boolean>;
}

function isLibrary(track: MusicTrack): track is MusicTrack & { jellyfinId: string } {
  return track.availability === "library" && track.jellyfinId !== null;
}

export function useTrackActions(): TrackActions {
  const { t } = useTranslation("music");
  const toast = useToast();
  const player = useOctavePlayer();
  const provider = useOctaveProvider();
  const gestures = useMusicGestures(provider);
  const { mutate: toggleFavorite } = useToggleMusicFavorite();
  const { mutateAsync: insertEntries } = useAddToMusicPlaylist();

  const failed = useCallback((reason: string = "failed") => toast.show("error", t(`refusal.${reason}`), { title: t("refusal.title") }), [t, toast]);

  const ownsTrack = useCallback((track: MusicTrack) => isFromProvider(provider, track.external?.pluginId), [provider]);

  const toggleLike = useCallback(
    (track: MusicTrack) => {
      const liked = !(likeOverrideOf(track.key) ?? track.favorite);
      setLikeOverride(track.key, liked);
      queueActions.patchFavorite(player, track.key, liked);
      const revert = () => {
        setLikeOverride(track.key, !liked);
        queueActions.patchFavorite(player, track.key, !liked);
      };
      if (isLibrary(track)) {
        toggleFavorite({ track, favorite: liked }, { onError: () => (revert(), failed()) });
        return;
      }
      if (!track.external || !ownsTrack(track)) return revert();
      gestures.like(track.external.id, liked).then(
        (outcome: ExternalActionOutcome) => {
          if (!outcome.ok) return revert(), failed(outcome.reason);
          if (liked && outcome.state === "pending") toast.show("success", t("track.likedPending"));
        },
        () => (revert(), failed()),
      );
    },
    [failed, gestures, ownsTrack, player, t, toast, toggleFavorite],
  );

  const addToPlaylist = useCallback(
    async (track: MusicTrack, playlist: MusicPlaylist, position?: number): Promise<boolean> => {
      try {
        if (isLibrary(track)) {
          await insertEntries({ playlistId: playlist.jellyfinId, itemIds: [track.jellyfinId], position, tracks: [track] });
          toast.show("success", t("playlist.added", { name: playlist.name }));
          return true;
        }
        if (!track.external || !ownsTrack(track)) return false;
        const outcome = await gestures.playlistAdd(track.external.id, playlist.jellyfinId, position ?? playlist.trackCount);
        if (!outcome.ok) {
          failed(outcome.reason);
          return false;
        }
        toast.show("success", t(outcome.state === "pending" ? "playlist.addedPending" : "playlist.added", { name: playlist.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [failed, gestures, insertEntries, ownsTrack, t, toast],
  );

  return useMemo(
    () => ({
      canLike: (track: MusicTrack) => isLibrary(track) || (ownsTrack(track) && gestures.canLike),
      toggleLike,
      canAddToPlaylist: (track: MusicTrack) => isLibrary(track) || (ownsTrack(track) && gestures.canPlaylistAdd),
      addToPlaylist,
    }),
    [addToPlaylist, gestures.canLike, gestures.canPlaylistAdd, ownsTrack, toggleLike],
  );
}
