import { useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { OnLoadData, OnProgressData, VideoRef } from "react-native-video";
import { invalidateSeriesWatchViews, useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import type { PlayerPlayback } from "./usePlayerPlayback";

/**
 * Gestionnaires du lecteur mobile : chargement, progression, fin, erreur,
 * déplacement, navigation d'épisode, sortie d'écran et nettoyage au démontage.
 *
 * Extraits de `PlayerScreen`, qui dépassait la limite de 300 lignes par
 * fichier. Extraction mécanique, à une exception près signalée sur `handleEnd`.
 */
export interface PlayerHandlersOptions {
  itemId: string;
  pb: PlayerPlayback;
  videoRef: { current: VideoRef | null };
  paused: boolean;
  /** Refs de cycle de vie portés par l'écran, repris tels quels. */
  resumeApplied: { current: boolean };
  retryCount: { current: number };
  retryingRef: { current: boolean };
  hasEverPlayed: { current: boolean };
  setCurrentTime: (v: number) => void;
  setBufferedTime: (v: number) => void;
  setIsBuffering: (v: boolean) => void;
  setVideoReady: (v: boolean) => void;
  setPlayerError: (v: string | null) => void;
  /** Le flux est arrivé au bout — l'écran le donne à l'arbitre, qui décide. */
  onEnded: () => void;
}

export function usePlayerHandlers({
  itemId, pb, videoRef, paused,
  resumeApplied, retryCount, retryingRef, hasEverPlayed,
  setCurrentTime, setBufferedTime, setIsBuffering, setVideoReady, setPlayerError,
  onEnded,
}: PlayerHandlersOptions) {
  const { t } = useTranslation("player");
  const router = useRouter();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const userId = useUserId();

  // Invalidate home queries so watch state refreshes
  const invalidateAndGoBack = useCallback(() => {
    pb.reporting.reportStop();
    // Remove from personal watchlist if fully watched
    jfClient.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    // La fiche de la série : le téléphone n'en invalidait AUCUNE clé, donc
    // l'épisode qu'on venait de terminer y restait décoché. Règle partagée
    // avec le web et le téléviseur.
    invalidateSeriesWatchViews(queryClient, pb.item?.SeriesId);
    backOrHome(router);
  }, [router, pb.reporting, pb.item?.SeriesId, queryClient, itemId, jfClient, userId]);

  const handleLoad = useCallback((_data: OnLoadData) => {
    setIsBuffering(false);
    setVideoReady(true);
    hasEverPlayed.current = true;

    // First load: resume from metadata; subsequent loads (track change): use current position
    const targetPosition = resumeApplied.current
      ? pb.positionRef.current
      : (pb.item?.UserData?.PlaybackPositionTicks ?? 0) / TICKS_PER_SECOND;
    resumeApplied.current = true;

    if (targetPosition > 0) {
      if (pb.isDirectPlay) {
        // Direct play: seek absolute (startPosition should already have positioned,
        // but seek as backup)
        videoRef.current?.seek(targetPosition);
      } else {
        // Transcode: HLS stream starts at streamOffset,
        // so seek to (target - streamOffset) within the stream
        const seekInStream = targetPosition - pb.streamOffset;
        if (seekInStream > 1) {
          videoRef.current?.seek(seekInStream);
        }
      }
    }

    pb.reporting.reportStart(targetPosition);
  }, [pb.item, pb.reporting, pb.isDirectPlay, pb.streamOffset, pb.positionRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProgress = useCallback((data: OnProgressData) => {
    const raw = Math.max(0, data.currentTime);
    const pos = raw + pb.streamOffset;
    setCurrentTime(pos);
    setBufferedTime(data.playableDuration > 0 ? data.playableDuration + pb.streamOffset : 0);
    pb.positionRef.current = pos;
    pb.reporting.updatePosition(pos, paused);
  }, [paused, pb.reporting, pb.streamOffset, pb.positionRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // La fin du flux ne quitte plus l'écran : elle est ANNONCÉE à l'arbitre, qui
  // affiche l'écran de fin quand il y a une suite, et demande la sortie
  // (`onEndOfPlayback` → `invalidateAndGoBack`) quand il n'y en a pas. Sortir
  // ici privait le mobile de l'écran de fin que les autres surfaces ont.
  const handleEnd = useCallback(() => {
    onEnded();
  }, [onEnded]);

  const handleError = useCallback((e: unknown) => {
    // Guard against duplicate onError from ExoPlayer or race with retryingRef
    if (retryingRef.current) return;
    const errorDetail = e && typeof e === "object" ? JSON.stringify(e) : String(e);
    if (retryCount.current < 1) {
      // First error = expected on emulators / unsupported codecs → auto-retry with transcode
      console.log("[Tentacle:Player] onError — retrying with transcode fallback", errorDetail);
      retryCount.current++;
      retryingRef.current = true;
      pb.retry();
    } else {
      // All retries exhausted — show error screen
      console.error("[Tentacle:Player] onError — all retries exhausted", errorDetail);
      setPlayerError(t("playbackError"));
    }
  }, [pb, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeek = useCallback((seconds: number) => {
    const dur = pb.jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    const offset = pb.streamOffset;
    videoRef.current?.seek(Math.max(0, clamped - offset));
    pb.reporting.reportSeek(clamped, paused);
  }, [pb.jellyfinDuration, pb.streamOffset, paused, pb.reporting]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNextEpisode = useCallback(() => {
    const next = pb.episodeNav.nextEpisode;
    if (!next) return;
    pb.reporting.reportStop();
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    router.replace(`/watch/${next.Id}`);
  }, [pb.episodeNav.nextEpisode, pb.reporting, queryClient, router]);

  const handlePrevEpisode = useCallback(() => {
    const prev = pb.episodeNav.previousEpisode;
    if (!prev) return;
    pb.reporting.reportStop();
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    router.replace(`/watch/${prev.Id}`);
  }, [pb.episodeNav.previousEpisode, pb.reporting, queryClient, router]);

  // Cleanup on unmount — report stop + refresh resume lists
  // Note: don't invalidate ["item", itemId] here — it's already done in
  // invalidateAndGoBack, and double-invalidation resets MediaDetail animations
  useEffect(() => () => {
    pb.reporting.reportStop();
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    handleLoad, handleProgress, handleEnd, handleError, handleSeek,
    invalidateAndGoBack, handleNextEpisode, handlePrevEpisode,
  };
}
