import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePlaybackReporting, useWatchStopInvalidation } from "@tentacle-tv/api-client";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import { useConnectivity } from "../offline/useConnectivity";
import { useLocalPlaybackReporting } from "../hooks/useLocalPlaybackReporting";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { DesktopPlayer } from "../components/DesktopPlayer";
import { PlayerLoadingScreen } from "../components/player/PlayerLoadingScreen";
import { useWatchSession, BURN_IN_SUBTITLE_CODECS } from "../hooks/useWatchSession";
import { useGroupSyncEngine } from "../watchTogether/useGroupSyncEngine";
import { useGroupPlaybackHandlers } from "../watchTogether/useGroupPlaybackHandlers";
import { GroupPlaybackOverlay } from "../watchTogether/GroupPlaybackOverlay";
import type { PlayerTransport } from "../watchTogether/playerTransport";
import { useApplyToSeries } from "../hooks/useApplyToSeries";
import { wtLog } from "../watchTogether/wtLog";
import { useReportPlayerOverlay } from "../watchTogether/chat/chatUiStore";
import { stripOverviewHtml } from "../lib/overviewHtml";

export function WatchDesktop({ onFallbackToWeb }: { onFallbackToWeb?: () => void } = {}) {
  const queryClient = useQueryClient();
  const {
    itemId, item, isLoading, client, streams, mediaSourceId,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    qualityKey, setQualityKey, sourceQuality, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef, subtitleOverrideRef,
    isDirectPlay, isDirectStream, playSessionId, streamUrl, streamOffset,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    skipSegments, autoplayNextEnabled, maxResumePct, getPositionTicks,
    isLocalPlayback, localSource,
  } = useWatchSession({ isDesktop: true, checkAudioTranscode: () => false });
  const { t: tDownloads } = useTranslation("downloads");

  const { reportStart, updatePosition, reportSeek: _reportSeek, killTranscode, lastStopPromiseRef } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex, subtitleStreamIndex: subtitleIndex,
  });

  // Hors ligne : aucun reporting réseau — la progression est persistée
  // localement (et resynchronisée vers Jellyfin au retour en ligne).
  const { state: connectivityState } = useConnectivity();
  const online = connectivityState === "online" || connectivityState === "checking";
  useLocalPlaybackReporting({
    enabled: isLocalPlayback,
    itemId,
    localSource,
    positionRef,
    durationSeconds: jellyfinDuration,
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

  // Rebuild de source local (changement qualité/audio/burn-in) : le groupe
  // attend ce membre pendant le rechargement (fileLoaded+playing → false).
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

  // Avatars du groupe affichés uniquement quand l'overlay lecteur est actif.
  const [controlsVisible, setControlsVisible] = useState(true);
  // La bulle de chat de groupe suit le même fondu que les contrôles.
  useReportPlayerOverlay(controlsVisible);

  const runStopInvalidation = useWatchStopInvalidation();
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

  const handleAudioChange = useCallback(async (idx: number) => {
    audioOverrideRef.current = true;
    // In transcode mode (quality override), kill old ffmpeg before URL rebuild
    if (qualityKey !== "original") {
      await killTranscode();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
    }
    setAudioIndex(idx);
  }, [qualityKey, killTranscode, getPositionTicks, setStartTicks, setAudioIndex, audioOverrideRef]);

  const handleSubtitleChange = useCallback(async (idx: number | null) => {
    subtitleOverrideRef.current = true;
    // In direct play, mpv handles all subtitle types natively — just update state
    if (isDirectPlay) { setSubtitleIndex(idx); return; }
    // In transcode mode, bitmap subtitles need server burn-in
    if (idx != null) {
      const sub = streams.find((s: JfStream) => s.Type === "Subtitle" && s.Index === idx);
      if (BURN_IN_SUBTITLE_CODECS.test(sub?.Codec ?? "")) {
        await killTranscode();
        const ticks = getPositionTicks();
        if (ticks > 0) setStartTicks(ticks);
        setBurnInSubtitleIndex(idx);
        setSubtitleIndex(idx);
        return;
      }
    }
    if (burnInSubtitleIndex != null) {
      await killTranscode();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
      setBurnInSubtitleIndex(undefined);
    }
    setSubtitleIndex(idx);
  }, [isDirectPlay, streams, killTranscode, getPositionTicks, burnInSubtitleIndex, setStartTicks, setBurnInSubtitleIndex, setSubtitleIndex]);

  const handleQualityChange = useCallback(async (key: QualityKey) => {
    await killTranscode();
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setQualityKey(key);
  }, [killTranscode, getPositionTicks, setQualityKey, setStartTicks]);

  const handleProgress = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    // Hors ligne : pas d'appels réseau de playstate (persistance locale via
    // useLocalPlaybackReporting) ; en ligne, reporting normal — y compris en
    // lecture locale (la source est le disque, la progression va au serveur).
    if (online) updatePosition(seconds, paused);
  }, [updatePosition, positionRef, online]);

  // Titre : DTO serveur, sinon méta locale (démarrage 100 % hors ligne).
  const title = item
    ? (item.Type === "Episode" ? item.SeriesName ?? item.Name : item.Name ?? "")
    : (localSource?.seriesName ?? localSource?.title ?? "");
  // Sous-titre : DTO serveur, sinon numéros de la méta locale (hors ligne).
  // Sans numéros connus, on n'invente pas de « S00E00 » — titre seul.
  const epSubtitle = (() => {
    if (item?.Type === "Episode") {
      return `${formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })} — ${item.Name}`;
    }
    if (item || !localSource?.seriesName) return undefined;
    const code = localSource.parentIndexNumber != null && localSource.indexNumber != null
      ? formatEpisodeCode(localSource.parentIndexNumber, localSource.indexNumber, { style: "padded" })
      : null;
    const name = localSource.title ?? "";
    return code ? `${code} — ${name}` : name || undefined;
  })();

  if (isLoading || !streamUrl) {
    return <PlayerLoadingScreen posterUrl={posterUrl} title={title || undefined} subtitle={epSubtitle} />;
  }

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
    return client.getImageUrl(backdropId, imageType, { width: 1920, quality: 85 });
  })();
  // Fond immersif de l'affiche de fin = bannière de la SÉRIE (fallback : backdrop épisode).
  const nextSeriesBackdropUrl = (() => {
    if (!nextEpisode?.Id) return undefined;
    const seriesId = nextEpisode.SeriesId ?? nextEpisode.ParentBackdropItemId;
    if (seriesId) return client.getImageUrl(seriesId, "Backdrop", { width: 1920, quality: 85 });
    return (nextEpisode.BackdropImageTags?.length ?? 0) > 0
      ? client.getImageUrl(nextEpisode.Id, "Backdrop", { width: 1920, quality: 85 })
      : nextEpisodeImageUrl;
  })();
  // Vignette de l'épisode suivant = image Primary (miniature).
  const nextEpisodeThumbUrl = nextEpisode?.Id
    ? client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 90 })
    : nextEpisodeImageUrl;
  // stripOverviewHtml AVANT le slice : couper du HTML brut sectionnerait une balise.
  const nextOverviewText = nextEpisode?.Overview ? stripOverviewHtml(nextEpisode.Overview) : undefined;
  const nextEpisodeDescription = nextOverviewText
    ? (nextOverviewText.length > 300 ? nextOverviewText.slice(0, 300) + "…" : nextOverviewText) : undefined;

  return (
    <div className="relative h-screen w-screen">
      <DesktopPlayer
        key={itemId} src={streamUrl} title={title} subtitle={epSubtitle}
        startPositionSeconds={group.groupStartPositionSeconds ?? startPositionSeconds} jellyfinDuration={jellyfinDuration}
        audioTracks={audioTracks} subtitleTracks={subtitleTracks}
        currentAudio={audioIndex} currentSubtitle={subtitleIndex} currentQuality={qualityKey} sourceQuality={sourceQuality}
        onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange}
        /* Lecture locale : le fichier EST la source — changer la « qualité »
           n'a aucun sens, le sélecteur est retiré (TrackSelector le masque
           quand onQualityChange est absent). */
        onQualityChange={isLocalPlayback ? undefined : handleQualityChange}
        isLocalPlayback={isLocalPlayback} offline={!online}
        localLibraryId={localSource?.libraryId ?? null}
        localSubtitleFiles={localSource?.subtitleFiles}
        onProgress={handleProgress} onStarted={() => { if (online) reportStart(group.groupStartPositionSeconds ?? startPositionSeconds); }}
        hasNextEpisode={!!nextEpisode} hasPreviousEpisode={!!previousEpisode}
        nextEpisodeTitle={nextEpTitle} nextEpisodeImageUrl={nextEpisodeImageUrl}
        nextSeriesBackdropUrl={nextSeriesBackdropUrl} nextEpisodeThumbUrl={nextEpisodeThumbUrl}
        nextEpisodeDescription={nextEpisodeDescription} autoplayNextEnabled={autoplayNextEnabled} maxResumePct={maxResumePct}
        onNextEpisode={group.handleNextEpisode} onPreviousEpisode={group.handlePreviousEpisode}
        isDirectPlay={isDirectPlay} streamOffset={streamOffset} posterUrl={posterUrl}
        introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
        itemId={itemId!} item={item} mediaSourceId={mediaSourceId}
        onFallbackToWeb={onFallbackToWeb}
        transportRef={transportRef} onPlayStateChange={groupSync.notifyPlayState}
        onBufferingChange={groupSync.notifyBuffering}
        onSeekComplete={(seconds) => groupSync.notifySeek(seconds)}
        onAutoNextDismiss={groupSync.notifyAutoNextDismiss}
        onControlsVisibilityChange={setControlsVisible}
        applyToSeries={applyToSeries}
      />
      <GroupPlaybackOverlay itemId={itemId} controlsVisible={controlsVisible} />
      {/* Indicateur discret « Lecture locale » — suit le fondu des contrôles. */}
      {isLocalPlayback && controlsVisible && (
        <div className="pointer-events-none absolute right-4 top-4 z-40 rounded-full bg-status-success-bg px-3 py-1 text-xs font-semibold text-status-success-fg">
          {tDownloads("localPlayback")}
        </div>
      )}
    </div>
  );
}
