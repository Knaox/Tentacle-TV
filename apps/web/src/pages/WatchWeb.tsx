import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlaybackReporting } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import { PlayerLoadingScreen } from "../components/player/PlayerLoadingScreen";
import { PlaybackProblemScreen } from "../components/problems/PlaybackProblemScreen";
import { useWebPlaybackProblem } from "../hooks/useWebPlaybackProblem";
import { useWatchSession } from "../hooks/useWatchSession";
import { useSupersededSessionKill } from "../hooks/useSupersededSessionKill";
import { useWatchStopCleanup } from "../hooks/useWatchStopCleanup";
import { nextEpisodeCard } from "../hooks/watchSessionMedia";
import { needsBurnIn } from "../hooks/useWebPlaybackFallbacks";
import { preferNativeHls } from "../hooks/useNativeHlsPreference";
import { useGroupSyncEngine } from "../watchTogether/useGroupSyncEngine";
import { useGroupIntroSkip } from "../watchTogether/introSkipRefusal";
import { useGroupPlaybackHandlers } from "../watchTogether/useGroupPlaybackHandlers";
import { GroupPlaybackOverlay } from "../watchTogether/GroupPlaybackOverlay";
import type { PlayerTransport } from "../watchTogether/playerTransport";
import { useApplyToSeries } from "../hooks/useApplyToSeries";
import { useRememberItemTracks } from "../hooks/useRememberItemTracks";
import { wtLog } from "../watchTogether/wtLog";
import { useReportPlayerOverlay } from "../watchTogether/chat/chatUiStore";
import { markPlayerExit } from "../components/detail/detailTransition";
import { useMirror } from "../mirror/useFormFactor";
import { MirrorPlayerLoadingScreen } from "../mirror/player";

export function WatchWeb() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  // La sortie de l'écran de chargement — le MÊME geste que le bouton Retour du
  // lecteur (`VideoPlayer`), qui n'est pas encore monté à ce moment-là.
  const cancelLoading = useCallback(() => { markPlayerExit(); navigate(-1); }, [navigate]);
  // Miroir de l'app mobile : son écran de chargement, et pas de bandeau « reprendre à ».
  const mirror = useMirror();
  const {
    itemId, item, isLoading, client, streams, mediaSourceId,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    qualityKey, setQualityKey, sourceQuality, qualityPresets, autoModeArmed, qualityDrop, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef, subtitleOverrideRef,
    isDirectPlay, isDirectStream, playSessionId, streamUrl, streamOffset, onDirectPlayNonFiable,
    pgsSubtitleUrl, pgsClientOk, reportPgsFailure, restartPlayback, releaseEncoding,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    segments, getPositionTicks, itemError, negotiationError,
  } = useWatchSession({ isDesktop: false });

  // Décidé par `useNativeHlsPreference` : les coquilles dont le décodage passe
  // par le matériel répondent oui, sans que ce fichier ait à les connaître.
  const useNativeHls = preferNativeHls();

  // `killTranscode` et `releaseEncoding` ne font pas double emploi, et la fusion
  // des deux branches a failli le laisser croire : le premier tue une session
  // SUPPLANTÉE, qu'on désigne par son identifiant une fois qu'une autre a pris
  // sa place ; le second libère la session COURANTE avant un changement voulu.
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
  // Le refus du saut d'intro voyage avec le groupe : la position de lecture
  // est commune, laisser partir le décompte de l'autre annulerait la croix.
  useGroupIntroSkip(groupSync.notifySkipIntroDismiss);

  // Rebuild de source local (changement qualité/audio/burn-in → nouvelle URL de
  // stream) : signaler le buffering pour que le groupe ATTENDE ce membre
  // pendant le rechargement (le canplay renverra buffering:false).
  const firstSrcRef = useRef(true);
  useEffect(() => {
    if (!streamUrl) return;
    if (firstSrcRef.current) { firstSrcRef.current = false; return; }
    wtLog("page", "rebuild de source → déclarer buffering au groupe", { playSessionId });
    // Gel à la position que le rechargement VISE : le lecteur qui se détruit
    // rapporterait la sienne, en retard de ce que la boucle ne rattraperait
    // qu'après la reprise.
    groupSync.notifyBuffering(true, getPositionTicks() / TICKS_PER_SECOND);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  // Une session supplantée par une autre : son ffmpeg orphelin est tué (cf. le hook).
  useSupersededSessionKill(playSessionId, killTranscode);

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

  // À la sortie : la fiche relue, et « vu » décidé APRÈS l'arrêt signalé (cf. le hook).
  useWatchStopCleanup({ itemId, item, positionRef, lastStopPromiseRef });

  // `releaseEncoding` vient de `useWatchSession` : les gestes ci-dessous et les
  // filets de lecture renégocient la même session, et doivent la libérer de la
  // même façon. Deux implémentations auraient fini par diverger — c'est
  // exactement ce qui laissait fuir le chemin des filets (cf. le hook).

  // Audio change: save position for potential transcode restart.
  // Server decides direct play vs transcode via PlaybackInfo.
  //
  // En lecture directe, il n'y a RIEN à redémarrer : le fichier porte toutes ses
  // pistes et le lecteur bascule seul. Libérer un encodage qui n'existe pas et
  // reposer une position qui ne bouge pas ne ferait que déclencher une
  // renégociation pour rien — cf. `useWebPlaybackInfoFetch`, qui tient la garde.
  const handleAudioChange = useCallback((idx: number) => {
    audioOverrideRef.current = true;
    if (!isDirectPlay) {
      releaseEncoding();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
    }
    setAudioIndex(idx);
  }, [getPositionTicks, setStartTicks, setAudioIndex, audioOverrideRef, releaseEncoding, isDirectPlay]);

  /**
   * La bascule native a échoué : la piste est dans le conteneur mais la puce ne
   * sait pas la décoder. C'est au serveur de la transcoder, et il faut donc bien
   * redemander une session — le compteur de relance garantit que la requête
   * repart même si la position n'a pas bougé d'un tick.
   */
  const handleAudioTrackNotFound = useCallback(() => {
    console.warn("[Tentacle:Playback] piste audio absente du lecteur — session neuve");
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    restartPlayback();
  }, [getPositionTicks, setStartTicks, restartPlayback]);

  const handleSubtitleChange = useCallback((idx: number | null) => {
    subtitleOverrideRef.current = true;
    if (idx != null) {
      const sub = streams.find((s: JfStream) => s.Type === "Subtitle" && s.Index === idx);
      // Un PGS rendu côté client reste une piste ordinaire : pas d'incrustation,
      // donc pas de ré-encodage de l'image pour un sous-titre.
      if (needsBurnIn(sub?.Codec, pgsClientOk)) {
        releaseEncoding();
        const ticks = getPositionTicks();
        if (ticks > 0) setStartTicks(ticks);
        setBurnInSubtitleIndex(idx);
        setSubtitleIndex(idx);
        return;
      }
    }
    if (burnInSubtitleIndex != null) {
      releaseEncoding();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
      setBurnInSubtitleIndex(undefined);
    }
    setSubtitleIndex(idx);
  }, [streams, getPositionTicks, burnInSubtitleIndex, pgsClientOk, setStartTicks, setBurnInSubtitleIndex, setSubtitleIndex, releaseEncoding]);

  const handleQualityChange = useCallback((key: QualityKey) => {
    releaseEncoding();
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setQualityKey(key);
  }, [getPositionTicks, setStartTicks, setQualityKey, releaseEncoding]);

  // HLS seek fallback: PlaybackInfo re-fetches with new position. L'ancien
  // encodage est tué par `restartPlayback` lui-même — le kill vivait ici, il
  // vit désormais au point unique où la session est renégociée.
  //
  // `restartPlayback` n'est pas une précaution : ce callback sert AUSSI de
  // rattrapage au repli CORS de `useVideoSource`, qui le déclenche à la
  // position 0 alors que `startTicks` vaut déjà 0. Sans compteur, React ne
  // rejouait rien, hls.js venait d'être détruit, et la lecture ne démarrait
  // jamais — le « parfois ça ne se lance pas » du premier démarrage.
  const handleSeekRequest = useCallback((targetSeconds: number) => {
    setStartTicks(Math.floor(targetSeconds * TICKS_PER_SECOND));
    restartPlayback();
  }, [setStartTicks, restartPlayback]);

  const handleProgress = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    updatePosition(seconds, paused);
  }, [updatePosition, positionRef]);

  const handleSeekComplete = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    reportSeek(seconds, paused);
    // Le lecteur web rapporte ses seeks à la demande (useSmartSeek) : tous explicites.
    groupSync.notifySeek(seconds, { explicit: true });
  }, [reportSeek, positionRef, groupSync.notifySeek]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un échec que plus rien ne rattrape (fiche, négociation, moteur) : dit, avec ses gestes.
  const playback = useWebPlaybackProblem({
    client, itemId, item, itemError, negotiationError, streamUrl, isDirectPlay,
    burningSubtitles: burnInSubtitleIndex != null, subtitlesActive: subtitleIndex != null,
    mediaSourceId, qualityKey, qualityPresets, positionRef,
    restartAt: handleSeekRequest, setQuality: handleQualityChange, dropSubtitles: () => handleSubtitleChange(null), leave: cancelLoading,
  });

  const [showResumeIndicator, setShowResumeIndicator] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showPlayer = !isLoading && !!streamUrl && !playback.problem;

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
  const nextCard = nextEpisodeCard(client, nextEpisode);

  const resumeTimeFormatted = startPositionSeconds && startPositionSeconds > 0
    ? formatDuration(Math.round(startPositionSeconds) * 10_000_000) : null;

  return (
    // Toile du lecteur (bg-black) + toast « reprendre à » posé sur la vidéo :
    // volontairement en dur (text-white, rgba noir) dans les deux thèmes.
    <div className="relative h-screen w-screen bg-black">
      {showResumeIndicator && resumeTimeFormatted && !mirror && (
        <div
          /* Flou en CLASSE : un style en ligne échappe à la passe de verre du
             téléviseur (cf. `Toast.tsx`). */
          className="absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white/80 backdrop-blur-sm transition-opacity duration-500"
          style={{
            background: "rgba(0,0,0,0.6)",
            opacity: showResumeIndicator ? 1 : 0,
          }}
        >
          {t("common:resumeAt", { time: resumeTimeFormatted })}
        </div>
      )}
      {playback.problem ? (
        <PlaybackProblemScreen
          model={playback.problem} posterUrl={posterUrl} title={title || undefined} subtitle={epSubtitle}
          onAction={playback.onAction} onBack={cancelLoading}
        />
      ) : showPlayer ? (
        <VideoPlayer
          key={itemId} src={streamUrl} title={title} subtitle={epSubtitle}
          startPositionSeconds={group.groupStartPositionSeconds ?? playback.resumeAt ?? startPositionSeconds} jellyfinDuration={jellyfinDuration}
          audioTracks={audioTracks} subtitleTracks={subtitleTracks}
          currentAudio={audioIndex} currentSubtitle={subtitleIndex} currentQuality={qualityKey} sourceQuality={sourceQuality} autoQualityActive={autoModeArmed} qualityDrop={qualityDrop}
          qualityPresets={qualityPresets}
          onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange} onQualityChange={handleQualityChange}
          onProgress={handleProgress} onStarted={() => { playback.markStarted(); reportStart(group.groupStartPositionSeconds ?? startPositionSeconds); }}
          hasNextEpisode={!!nextEpisode} hasPreviousEpisode={!!previousEpisode}
          nextEpisodeTitle={nextCard.title} nextEpisodeImageUrl={nextCard.imageUrl}
          nextEpisodeDescription={nextCard.description}
          onNextEpisode={group.handleNextEpisode} onPreviousEpisode={group.handlePreviousEpisode}
          itemId={itemId!} item={item} mediaSourceId={mediaSourceId} posterUrl={posterUrl}
          isDirectPlay={isDirectPlay} streamOffset={streamOffset} useNativeHls={useNativeHls}
          onSeekRequest={handleSeekRequest} onSeekComplete={handleSeekComplete}
          onDirectPlayNonFiable={onDirectPlayNonFiable}
          onTrackNotFound={handleAudioTrackNotFound}
          pgsSubtitleUrl={pgsSubtitleUrl} onPgsFailure={reportPgsFailure}
          segments={segments.segments} runtimeMs={segments.runtimeMs} libraryId={segments.libraryId}
          transportRef={transportRef} onPlayStateChange={groupSync.notifyPlayState}
          onBufferingChange={groupSync.notifyBuffering} onFatalError={groupSync.notifyFatalError} onFailure={playback.report}
          onAutoNextDismiss={groupSync.notifyAutoNextDismiss} onRequestPlay={groupSync.requestPlay}
          inGroupSession={group.groupActive}
          onControlsVisibilityChange={setControlsVisible}
          applyToSeries={applyToSeries}
        />
      ) : mirror ? (
        <MirrorPlayerLoadingScreen item={item} onCancel={cancelLoading} />
      ) : (
        <PlayerLoadingScreen
          posterUrl={posterUrl} title={title || undefined} subtitle={epSubtitle}
          onCancel={cancelLoading}
        />
      )}
      <GroupPlaybackOverlay itemId={itemId} controlsVisible={controlsVisible} />
    </div>
  );
}
