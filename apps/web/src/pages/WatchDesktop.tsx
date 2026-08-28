import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePlaybackReporting, useWatchStopInvalidation } from "@tentacle-tv/api-client";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import { useConnectivity } from "../offline/useConnectivity";
import { useLocalPlaybackReporting } from "../hooks/useLocalPlaybackReporting";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { DesktopPlayer } from "../components/DesktopPlayer";
import { PlayerLoadingScreen } from "../components/player/PlayerLoadingScreen";
import { MediaMissingScreen } from "../components/player/MediaMissingScreen";
import { markPlayerExit } from "../components/detail/detailTransition";
import { invoke } from "../desktop/bridge";
import { useWatchSession, BURN_IN_SUBTITLE_CODECS } from "../hooks/useWatchSession";
import { useGroupSyncEngine } from "../watchTogether/useGroupSyncEngine";
import { useSautIntroGroupe } from "../watchTogether/refusSautIntro";
import { useGroupPlaybackHandlers } from "../watchTogether/useGroupPlaybackHandlers";
import { GroupPlaybackOverlay } from "../watchTogether/GroupPlaybackOverlay";
import type { PlayerTransport } from "../watchTogether/playerTransport";
import { useApplyToSeries } from "../hooks/useApplyToSeries";
import { useRememberItemTracks } from "../hooks/useRememberItemTracks";
import { wtLog } from "../watchTogether/wtLog";
import { useReportPlayerOverlay } from "../watchTogether/chat/chatUiStore";
import { useNextEpisodeArtwork } from "../hooks/useNextEpisodeArtwork";

export function WatchDesktop({ onFallbackToWeb }: { onFallbackToWeb?: () => void } = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Erreur de MÉDIA (fichier local disparu) : le lecteur est DÉMONTÉ — son
  // cleanup éprouvé fait le destroy/detach (pas d'orpheline) — et cet écran
  // prend sa place. La bascule de secours n'est PAS mémorisée.
  const [mediaMissing, setMediaMissing] = useState(false);
  const {
    itemId, item, isLoading, client, streams, mediaSourceId,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    qualityKey, setQualityKey, sourceQuality, qualityPresets, setStartTicks,
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

  // Changement d'épisode : l'écran « fichier introuvable » ne survit pas à
  // l'item qui l'a causé (la route /watch/:itemId ne remonte pas WatchDesktop).
  useEffect(() => { setMediaMissing(false); }, [itemId]);

  const handleMediaMissing = useCallback(() => setMediaMissing(true), []);
  const handleMediaRetry = useCallback(async () => {
    // Re-résolution AVANT le remontage : remonter sur la donnée périmée du
    // cache rejouerait le même chemin local mort. Fichier revenu → lecture
    // locale ; toujours absent → localSource null → l'URL distante prend.
    await queryClient.refetchQueries({ queryKey: ["local-source"] });
    setMediaMissing(false);
  }, [queryClient]);
  const handleMediaBack = useCallback(async () => {
    // Les trois gestes de useDesktopAutoNext.goBack — le lecteur est démonté,
    // son hook n'est plus là pour les faire.
    try { await invoke("player_fullscreen_leave"); } catch { /* on navigue quand même */ }
    markPlayerExit();
    navigate(-1);
  }, [navigate]);

  const { reportStart, updatePosition, reportSeek: _reportSeek, killTranscode, lastStopPromiseRef } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex, subtitleStreamIndex: subtitleIndex,
    // Fichier local + mode économie → reporting « bords » (début/fin) au lieu
    // d'un battement toutes les 10 s. La progression fine reste en SQLite.
    localPlayback: isLocalPlayback,
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
    // Le même seuil que la bannière « épisode suivant » : hors ligne, un
    // épisode passe « vu » à l'instant précis où il passerait vu en ligne.
    maxResumePct,
    stopPromiseRef: lastStopPromiseRef,
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
  // Le refus du saut d'intro voyage avec le groupe : la position de lecture
  // est commune, laisser partir le décompte de l'autre annulerait la croix.
  useSautIntroGroupe(groupSync.notifySkipIntroDismiss);

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
  // Et, sans rien à cocher, mémorisation du choix pour CE contenu — film compris.
  useRememberItemTracks({
    item, streams, audioIndex, subtitleIndex, audioOverrideRef, subtitleOverrideRef,
  });

  // Avatars du groupe affichés uniquement quand l'overlay lecteur est actif.
  const [controlsVisible, setControlsVisible] = useState(true);
  // La bulle de chat de groupe suit le même fondu que les contrôles.
  useReportPlayerOverlay(controlsVisible);

  // Visuels de l'épisode suivant : disque en lecture locale ou hors ligne
  // (zéro réseau), Jellyfin en streaming.
  const nextArtwork = useNextEpisodeArtwork(nextEpisode, client, !online || isLocalPlayback);

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
    // Lecture locale ou hors ligne : AUCUN appel réseau de playstate pendant
    // la lecture (zéro bande passante) — la progression vit en SQLite via
    // useLocalPlaybackReporting et la file est drainée vers Jellyfin en fin
    // de lecture. En streaming en ligne, reporting live normal.
    if (online && !isLocalPlayback) updatePosition(seconds, paused);
  }, [updatePosition, positionRef, online, isLocalPlayback]);

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

  // Lecture locale + hors ligne : le DTO serveur ne viendra pas — on ne
  // l'attend pas (titre, durée, position et pistes viennent du local, la page
  // est conçue pour). En ligne, on l'attend : position de reprise cross-device
  // et pistes serveur doivent être là au montage.
  const waitForServerItem = isLoading && !(isLocalPlayback && !online);
  if (waitForServerItem || !streamUrl) {
    return <PlayerLoadingScreen posterUrl={posterUrl} title={title || undefined} subtitle={epSubtitle} />;
  }

  if (mediaMissing) {
    return (
      <MediaMissingScreen
        onRetry={() => { void handleMediaRetry(); }}
        onBack={() => { void handleMediaBack(); }}
      />
    );
  }

  const nextEpTitle = nextEpisode
    ? `${formatEpisodeCode(nextEpisode.ParentIndexNumber, nextEpisode.IndexNumber, { style: "padded" })} — ${nextEpisode.Name}` : undefined;

  return (
    <div className="relative h-screen w-screen">
      <DesktopPlayer
        key={itemId} src={streamUrl} title={title} subtitle={epSubtitle}
        startPositionSeconds={group.groupStartPositionSeconds ?? startPositionSeconds} jellyfinDuration={jellyfinDuration}
        audioTracks={audioTracks} subtitleTracks={subtitleTracks}
        currentAudio={audioIndex} currentSubtitle={subtitleIndex} currentQuality={qualityKey} sourceQuality={sourceQuality}
        qualityPresets={qualityPresets}
        onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange}
        /* Lecture locale : le fichier EST la source — changer la « qualité »
           n'a aucun sens, le sélecteur est retiré (TrackSelector le masque
           quand onQualityChange est absent). */
        onQualityChange={isLocalPlayback ? undefined : handleQualityChange}
        isLocalPlayback={isLocalPlayback} offline={!online}
        localLibraryId={localSource?.libraryId ?? null}
        localSubtitleFiles={localSource?.subtitleFiles}
        onProgress={handleProgress} onStarted={() => { if (online && !isLocalPlayback) reportStart(group.groupStartPositionSeconds ?? startPositionSeconds); }}
        hasNextEpisode={!!nextEpisode} hasPreviousEpisode={!!previousEpisode}
        nextEpisodeTitle={nextEpTitle} nextEpisodeImageUrl={nextArtwork.imageUrl}
        nextSeriesBackdropUrl={nextArtwork.seriesBackdropUrl} nextEpisodeThumbUrl={nextArtwork.thumbUrl}
        nextEpisodeDescription={nextArtwork.description} autoplayNextEnabled={autoplayNextEnabled} maxResumePct={maxResumePct}
        onNextEpisode={group.handleNextEpisode} onPreviousEpisode={group.handlePreviousEpisode}
        isDirectPlay={isDirectPlay} streamOffset={streamOffset} posterUrl={posterUrl}
        introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
        itemId={itemId!} item={item} mediaSourceId={mediaSourceId}
        onFallbackToWeb={onFallbackToWeb} onMediaMissing={handleMediaMissing}
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
