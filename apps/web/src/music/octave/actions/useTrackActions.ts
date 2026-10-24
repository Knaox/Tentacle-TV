/**
 * Octave — les gestes sur un titre : le cœur et l'ajout à une playlist.
 *
 * Bibliothèque : le favori Jellyfin du compte, la playlist Jellyfin (routes du
 * cœur). Hors bibliothèque : l'extension (point 3), réponse immédiate
 * `pending` — le cœur est plein AU CLIC, le titre paraît « en attente » dans
 * Titres likés et la playlist, lisible par le cache, jusqu'à `music:resolved`.
 * Un geste qu'aucune extension ne sait faire n'est pas proposé.
 */

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { ExternalActionOutcome, MusicPlaylist, MusicTrack } from "@tentacle-tv/shared/music";
import { useToast } from "../../../contexts/ToastContext";
import { libraryApi } from "../data/libraryApi";
import { octaveKeys } from "../data/libraryQueries";
import { externalApi } from "../extension/externalApi";
import { useMusicProviders, type MusicProvider } from "../extension/musicProviders";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { clearLikeOverride, likeOverrideOf, setLikeOverride } from "./likeOverrides";

export interface TrackActions {
  canLike: (track: MusicTrack) => boolean;
  toggleLike: (track: MusicTrack) => void;
  canAddToPlaylist: (track: MusicTrack) => boolean;
  addToPlaylist: (track: MusicTrack, playlist: MusicPlaylist) => Promise<boolean>;
}

function isLibrary(track: MusicTrack): track is MusicTrack & { jellyfinId: string } {
  return track.availability === "library" && track.jellyfinId !== null;
}

export function useTrackActions(): TrackActions {
  const { t } = useTranslation("music");
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useUserId();
  const player = useOctavePlayer();
  const providers = useMusicProviders();

  const providerOf = useCallback(
    (track: MusicTrack): MusicProvider | null => providers.find((p) => p.pluginId === track.external?.pluginId) ?? null,
    [providers],
  );

  const refused = useCallback(
    (outcome: ExternalActionOutcome) => {
      if (!outcome.ok) toast.show("error", t(`refusal.${outcome.reason}`), { title: t("refusal.title") });
    },
    [t, toast],
  );

  const toggleLike = useCallback(
    (track: MusicTrack) => {
      const liked = !(likeOverrideOf(track.key) ?? track.favorite);
      setLikeOverride(track.key, liked);
      queueActions.patchFavorite(player, track.key, liked);
      const settle = (ok: boolean) => {
        if (!ok) {
          setLikeOverride(track.key, !liked);
          queueActions.patchFavorite(player, track.key, !liked);
        }
        void queryClient.invalidateQueries({ queryKey: octaveKeys.liked(user) });
        void queryClient.invalidateQueries({ queryKey: octaveKeys.pending(user) });
      };
      if (isLibrary(track)) {
        libraryApi.setFavorite(track.jellyfinId, liked).then(
          () => settle(true),
          () => {
            settle(false);
            toast.show("error", t("refusal.failed"), { title: t("refusal.title") });
          },
        );
        return;
      }
      const provider = providerOf(track);
      if (!provider || !track.external) {
        clearLikeOverride(track.key);
        return;
      }
      externalApi.like(provider, track.external.id, liked).then(
        (outcome) => {
          refused(outcome);
          settle(outcome.ok);
          // Un « j'aime » hors bibliothèque le dit : il s'ajoute, et s'écoute déjà.
          if (outcome.ok && liked && outcome.state === "pending") toast.show("success", t("track.likedPending"));
        },
        () => {
          settle(false);
          toast.show("error", t("refusal.failed"), { title: t("refusal.title") });
        },
      );
    },
    [player, providerOf, queryClient, refused, t, toast, user],
  );

  const addToPlaylist = useCallback(
    async (track: MusicTrack, playlist: MusicPlaylist): Promise<boolean> => {
      const done = (pending = false) => {
        void queryClient.invalidateQueries({ queryKey: octaveKeys.playlist(user, playlist.jellyfinId) });
        void queryClient.invalidateQueries({ queryKey: octaveKeys.playlists(user) });
        void queryClient.invalidateQueries({ queryKey: octaveKeys.pending(user) });
        toast.show("success", t(pending ? "playlist.addedPending" : "playlist.added", { name: playlist.name }));
        return true;
      };
      try {
        if (isLibrary(track)) {
          await libraryApi.addToPlaylist(playlist.jellyfinId, [track.jellyfinId]);
          return done();
        }
        const provider = providerOf(track);
        if (!provider || !track.external) return false;
        const outcome = await externalApi.playlistAdd(provider, track.external.id, playlist.jellyfinId, playlist.trackCount);
        if (!outcome.ok) {
          refused(outcome);
          return false;
        }
        return done(outcome.state === "pending");
      } catch {
        toast.show("error", t("refusal.failed"), { title: t("refusal.title") });
        return false;
      }
    },
    [providerOf, queryClient, refused, t, toast, user],
  );

  return useMemo(
    () => ({
      canLike: (track: MusicTrack) => isLibrary(track) || !!providerOf(track)?.manifest.like,
      toggleLike,
      canAddToPlaylist: (track: MusicTrack) => isLibrary(track) || !!providerOf(track)?.manifest.playlistAdd,
      addToPlaylist,
    }),
    [addToPlaylist, providerOf, toggleLike],
  );
}
