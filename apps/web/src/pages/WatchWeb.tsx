import { useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { usePlaybackReporting, useWatchStopInvalidation } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import { PlayerLoadingScreen } from "../components/player/PlayerLoadingScreen";
import { useWatchSession } from "../hooks/useWatchSession";
import { necessiteIncrustation } from "../hooks/useWebPlaybackFallbacks";
import { isMacOS } from "../hooks/useDesktopPlayer";
import { isTauriShell } from "../desktop/bridge";
import { useGroupSyncEngine } from "../watchTogether/useGroupSyncEngine";
import { useGroupPlaybackHandlers } from "../watchTogether/useGroupPlaybackHandlers";
import { GroupPlaybackOverlay } from "../watchTogether/GroupPlaybackOverlay";
import type { PlayerTransport } from "../watchTogether/playerTransport";
import { useApplyToSeries } from "../hooks/useApplyToSeries";
import { useRememberItemTracks } from "../hooks/useRememberItemTracks";
import { wtLog } from "../watchTogether/wtLog";
import { useReportPlayerOverlay } from "../watchTogether/chat/chatUiStore";
import { stripOverviewHtml } from "../lib/overviewHtml";

export function WatchWeb() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const {
    itemId, item, isLoading, client, streams, mediaSourceId,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    qualityKey, setQualityKey, sourceQuality, qualityPresets, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef, subtitleOverrideRef,
    isDirectPlay, isDirectStream, playSessionId, streamUrl, streamOffset, onDirectPlayNonFiable,
    pgsSubtitleUrl, pgsClientOk, signalerEchecPgs,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    skipSegments, autoplayNextEnabled, maxResumePct, getPositionTicks,
  } = useWatchSession({ isDesktop: false });

  // Le HLS natif est celui de WEBKIT. `isTauri()` répondant OUI sous Electron
  // aussi, la coquille Electron macOS l'activait — alors que son moteur est
  // Chromium, qui n'a pas de HLS natif et a besoin de hls.js. Même piège que
  // dans `usePlaybackInfo`, et invisible sous Windows où `isMacOS()` est faux.
  const useNativeHls = isTauriShell() && isMacOS();

  const { reportStart, updatePosition, reportSeek, killTranscode, lastStopPromiseRef } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex, subtitleStreamIndex: subtitleIndex,
  });

  // ── Watch Together : transport + handlers de groupe + moteur de sync ──
  const transportRef = useRef<PlayerTransport | null>(null);
  const group = useGroupPlaybackHandlers({
    itemId, itemReady: !!item, resumePositionSeconds: startPositionSeconds,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode, setStartTicks,
  });
  const groupSync = useGroupSyncEngine({
    itemId, transportRef, claimStartSeconds: group.groupStartPositionSeconds,
  });

  // Rebuild de source local (changement qualité/audio/burn-in → nouvelle URL de
  // stream) : signaler le buffering pour que le groupe ATTENDE ce membre
  // pendant le rechargement (le canplay renverra buffering:false).
  const firstSrcRef = useRef(true);
  useEffect(() => {
    if (!streamUrl) return;
    if (firstSrcRef.current) { firstSrcRef.current = false; return; }
    wtLog("page", "rebuild de source → déclarer buffering au groupe", { playSessionId });
    groupSync.notifyBuffering(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  // Épisode : case « Appliquer à cette série » (préférence de langues par série).
  const applyToSeries = useApplyToSeries({
    item, streams, audioIndex, subtitleIndex, audioOverrideRef, subtitleOverrideRef,
  });
  // Et, sans rien à cocher, mémorisation du choix pour CE contenu — film compris.
  useRememberItemTracks({
    item, streams, audioIndex, subtitleIndex, audioOverrideRef, subtitleOverrideRef,
  });

  // Avatars du groupe affichés uniquement quand l'overlay lecteur est actif.
  const [controlsVisible, setControlsVisible] = useState(true);
  // La bulle de chat de groupe suit le même fondu que les contrôles.
  useReportPlayerOverlay(controlsVisible);

  const runStopInvalidation = useWatchStopInvalidation();
  // Snapshot de l'item lu pour le cleanup, sans le mettre en dépendance de
  // l'effet (sinon le cleanup tournerait à chaque maj UserData de l'item).
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    return () => {
      const id = itemId;
      const snap = itemRef.current;
      queryClient.removeQueries({ queryKey: ["item", id] });
      // Cleanups React s'exécutent en ordre inverse d'enregistrement : ce
      // cleanup tourne AVANT celui de usePlaybackReporting qui assigne le vrai
      // stop promise. On défère donc la lecture du ref à un microtask pour
      // chaîner l'invalidation APRÈS le /Sessions/Playing/Stopped (Jellyfin a
      // alors mis à jour Played/DatePlayed → décision « 100% vu » fiable).
      queueMicrotask(() => {
        const run = () =>
          runStopInvalidation({ itemId: id, seriesId: snap?.SeriesId, itemType: snap?.Type });
        lastStopPromiseRef.current.then(run, run);
      });
    };
  }, [itemId, queryClient, lastStopPromiseRef, runStopInvalidation]);

  // Audio change: save position for potential transcode restart.
  // Server decides direct play vs transcode via PlaybackInfo.
  const handleAudioChange = useCallback((idx: number) => {
    audioOverrideRef.current = true;
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setAudioIndex(idx);
  }, [getPositionTicks, setStartTicks, setAudioIndex, audioOverrideRef]);

  const handleSubtitleChange = useCallback((idx: number | null) => {
    subtitleOverrideRef.current = true;
    if (idx != null) {
      const sub = streams.find((s: JfStream) => s.Type === "Subtitle" && s.Index === idx);
      // Un PGS rendu côté client reste une piste ordinaire : pas d'incrustation,
      // donc pas de ré-encodage de l'image pour un sous-titre.
      if (necessiteIncrustation(sub?.Codec, pgsClientOk)) {
        const ticks = getPositionTicks();
        if (ticks > 0) setStartTicks(ticks);
        setBurnInSubtitleIndex(idx);
        setSubtitleIndex(idx);
        return;
      }
    }
    if (burnInSubtitleIndex != null) {
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
      setBurnInSubtitleIndex(undefined);
    }
    setSubtitleIndex(idx);
  }, [streams, getPositionTicks, burnInSubtitleIndex, pgsClientOk, setStartTicks, setBurnInSubtitleIndex, setSubtitleIndex]);

  const handleQualityChange = useCallback((key: QualityKey) => {
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setQualityKey(key);
  }, [getPositionTicks, setStartTicks, setQualityKey]);

  // HLS seek fallback: kill old transcode, PlaybackInfo re-fetches with new position.
  const handleSeekRequest = useCallback((targetSeconds: number) => {
    if (!isDirectPlay) killTranscode();
    setStartTicks(Math.floor(targetSeconds * TICKS_PER_SECOND));
  }, [isDirectPlay, killTranscode, setStartTicks]);

  const handleProgress = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    updatePosition(seconds, paused);
  }, [updatePosition, positionRef]);

  const handleSeekComplete = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    reportSeek(seconds, paused);
    groupSync.notifySeek(seconds);
  }, [reportSeek, positionRef, groupSync.notifySeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showResumeIndicator, setShowResumeIndicator] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showPlayer = !isLoading && !!streamUrl;

  useEffect(() => {
    if (showPlayer && startPositionSeconds && startPositionSeconds > 0 && !group.groupActive) {
      setShowResumeIndicator(true);
      resumeTimerRef.current = setTimeout(() => setShowResumeIndicator(false), 3000);
    }
    return () => clearTimeout(resumeTimerRef.current);
  }, [showPlayer, startPositionSeconds, group.groupActive]);

  const title = item?.Type === "Episode" ? item.SeriesName ?? item.Name : item?.Name ?? "";
  const epSubtitle = item?.Type === "Episode"
    ? `${formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })} — ${item.Name}` : undefined;
  const nextEpTitle = nextEpisode
    ? `${formatEpisodeCode(nextEpisode.ParentIndexNumber, nextEpisode.IndexNumber, { style: "padded" })} — ${nextEpisode.Name}` : undefined;
  const nextEpisodeImageUrl = (() => {
    if (!nextEpisode?.Id) return undefined;
    const hasOwnBackdrop = (nextEpisode.BackdropImageTags?.length ?? 0) > 0;
    const hasParentBackdrop = (nextEpisode.ParentBackdropImageTags?.length ?? 0) > 0;
    const isEpisode = nextEpisode.Type === "Episode";
    const backdropId = isEpisode
      ? (hasOwnBackdrop ? nextEpisode.Id : (nextEpisode.ParentBackdropItemId ?? nextEpisode.SeriesId ?? nextEpisode.Id))
      : nextEpisode.Id;
    const imageType = (hasOwnBackdrop || hasParentBackdrop) ? "Backdrop" : "Primary";
    return client.getImageUrl(backdropId, imageType, { width: 720, quality: 85 });
  })();
  // stripOverviewHtml AVANT le slice : couper du HTML brut sectionnerait une balise.
  const nextOverviewText = nextEpisode?.Overview ? stripOverviewHtml(nextEpisode.Overview) : undefined;
  const nextEpisodeDescription = nextOverviewText
    ? (nextOverviewText.length > 120 ? nextOverviewText.slice(0, 120) + "…" : nextOverviewText) : undefined;

  const resumeTimeFormatted = startPositionSeconds && startPositionSeconds > 0
    ? formatDuration(Math.round(startPositionSeconds) * 10_000_000) : null;

  return (
    // Toile du lecteur (bg-black) + toast « reprendre à » posé sur la vidéo :
    // volontairement en dur (text-white, rgba noir) dans les deux thèmes.
    <div className="relative h-screen w-screen bg-black">
      {showResumeIndicator && resumeTimeFormatted && (
        <div
          className="absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white/80 transition-opacity duration-500"
          style={{
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            opacity: showResumeIndicator ? 1 : 0,
          }}
        >
          {t("common:resumeAt", { time: resumeTimeFormatted })}
        </div>
      )}
      {showPlayer ? (
        <VideoPlayer
          key={itemId} src={streamUrl} title={title} subtitle={epSubtitle}
          startPositionSeconds={group.groupStartPositionSeconds ?? startPositionSeconds} jellyfinDuration={jellyfinDuration}
          audioTracks={audioTracks} subtitleTracks={subtitleTracks}
          currentAudio={audioIndex} currentSubtitle={subtitleIndex} currentQuality={qualityKey} sourceQuality={sourceQuality}
          qualityPresets={qualityPresets}
          onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange} onQualityChange={handleQualityChange}
          onProgress={handleProgress} onStarted={() => reportStart(group.groupStartPositionSeconds ?? startPositionSeconds)}
          hasNextEpisode={!!nextEpisode} hasPreviousEpisode={!!previousEpisode}
          nextEpisodeTitle={nextEpTitle} nextEpisodeImageUrl={nextEpisodeImageUrl}
          nextEpisodeDescription={nextEpisodeDescription} autoplayNextEnabled={autoplayNextEnabled} maxResumePct={maxResumePct}
          onNextEpisode={group.handleNextEpisode} onPreviousEpisode={group.handlePreviousEpisode}
          itemId={itemId!} item={item} mediaSourceId={mediaSourceId} posterUrl={posterUrl}
          isDirectPlay={isDirectPlay} streamOffset={streamOffset} useNativeHls={useNativeHls}
          onSeekRequest={handleSeekRequest} onSeekComplete={handleSeekComplete}
          onDirectPlayNonFiable={onDirectPlayNonFiable}
          pgsSubtitleUrl={pgsSubtitleUrl} onPgsEchec={signalerEchecPgs}
          introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
          transportRef={transportRef} onPlayStateChange={groupSync.notifyPlayState}
          onBufferingChange={groupSync.notifyBuffering} onFatalError={groupSync.notifyFatalError}
          onAutoNextDismiss={groupSync.notifyAutoNextDismiss}
          onControlsVisibilityChange={setControlsVisible}
          applyToSeries={applyToSeries}
        />
      ) : (
        <PlayerLoadingScreen posterUrl={posterUrl} title={title || undefined} subtitle={epSubtitle} />
      )}
      <GroupPlaybackOverlay itemId={itemId} controlsVisible={controlsVisible} />
    </div>
  );
}
