import { useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { usePlaybackReporting, useWatchStopInvalidation } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import { PlayerLoadingScreen } from "../components/player/PlayerLoadingScreen";
import { useWatchSession } from "../hooks/useWatchSession";
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
    pgsSubtitleUrl, pgsClientOk, reportPgsFailure, restartPlayback, releaseEncoding,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    segments, autoplayNextEnabled, getPositionTicks,
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
    groupSync.notifyBuffering(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  // Une session de lecture qui en supplante une autre laisse un ffmpeg orphelin.
  //
  // Le serveur attribue un PlaySessionId NEUF à chaque PlaybackInfo, et y
  // accroche un transcodage distinct. Le lecteur, lui, n'en lit qu'un : dès que
  // `streamUrl` change, hls.js est détruit et repart sur la nouvelle URL. Le
  // précédent ffmpeg n'a alors plus un seul client — mais Jellyfin ne le sait
  // pas, et le garde vivant jusqu'à son minuteur d'inactivité (« Transcoding
  // kill timer », de l'ordre de la minute). Pendant tout ce temps le serveur
  // compte DEUX flux actifs pour un seul spectateur, avec deux ffmpeg sur le
  // dos — c'est le « 2 appareils au lieu d'1 » du tableau de bord.
  //
  // WatchDesktop tue l'ancien encodage à la main dans chacun de ses handlers.
  // Ici on le fait à la source : ce n'est pas le changement de qualité qui rend
  // un transcodage caduc, c'est le fait qu'un autre ait pris sa place. Une
  // seule garde couvre donc TOUS les chemins de reconstruction — qualité, piste
  // audio, incrustation de sous-titre, replis MKV et PGS, et le second
  // PlaybackInfo du démarrage quand les préférences arrivent après coup.
  //
  // Les effets des enfants s'exécutent AVANT ceux du parent : quand celui-ci
  // tourne, `useVideoSource` a déjà basculé sur la nouvelle source. On ne tue
  // jamais un encodage encore en cours de lecture.
  const previousSessionRef = useRef<string | null>(null);
  useEffect(() => {
    // Seul un identifiant RÉEL est mémorisé : `pbInfo.reset()` (changement
    // d'épisode) repasse par la chaîne vide, et l'oublier ici perdrait la trace
    // de l'encodage à tuer juste avant qu'il ne le soit.
    if (!playSessionId) return;
    const previous = previousSessionRef.current;
    previousSessionRef.current = playSessionId;
    if (!previous || previous === playSessionId) return;
    wtLog("session", "session supplantée → ancien transcodage tué", { previous, playSessionId });
    void killTranscode(previous);
  }, [playSessionId, killTranscode]);

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
          nextEpisodeDescription={nextEpisodeDescription} serverAutoplayEnabled={autoplayNextEnabled}
          onNextEpisode={group.handleNextEpisode} onPreviousEpisode={group.handlePreviousEpisode}
          itemId={itemId!} item={item} mediaSourceId={mediaSourceId} posterUrl={posterUrl}
          isDirectPlay={isDirectPlay} streamOffset={streamOffset} useNativeHls={useNativeHls}
          onSeekRequest={handleSeekRequest} onSeekComplete={handleSeekComplete}
          onDirectPlayNonFiable={onDirectPlayNonFiable}
          onTrackNotFound={handleAudioTrackNotFound}
          pgsSubtitleUrl={pgsSubtitleUrl} onPgsFailure={reportPgsFailure}
          segments={segments.segments} runtimeMs={segments.runtimeMs}
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
