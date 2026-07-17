import { useEffect, useMemo } from "react";
import { ticksToSeconds, extractSourceQuality } from "@tentacle-tv/shared";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { usePlaybackReporting } from "@tentacle-tv/api-client";
import { parseStart } from "../utils/playerHelpers";
import { useTVPlaybackQuality } from "./useTVPlaybackQuality";
import { useTVReloadState } from "./useTVReloadState";
import { useTVPlayerRouting } from "./useTVPlayerRouting";
import { useTVAudioTrack } from "./useTVAudioTrack";
import { useTVSubtitleControl } from "./useTVSubtitleControl";
import { useTVInitialResume } from "./useTVInitialResume";
import { useTVStreamUrl } from "./useTVStreamUrl";
import { useTVRemuxInfo } from "./useTVRemuxInfo";
import { useTVRemuxLogPump } from "./useTVRemuxLogPump";
import { useTVRemuxStallRecovery } from "./useTVRemuxStallRecovery";
import { useTVRemuxFamineWatchdog } from "./useTVRemuxFamineWatchdog";
import { useTVRemuxPause } from "./useTVRemuxPause";
import { useTVTrackResolution } from "./useTVTrackResolution";
import { useTVMpvTracks } from "./useTVMpvTracks";
import { useTVSeekControl } from "./useTVSeekControl";
import { useTVRemuxSeek } from "./useTVRemuxSeek";
import type { PlayerMediaState } from "./usePlayerMediaState";

type Ancestors = Parameters<typeof useTVTrackResolution>[0]["ancestors"];
type PlayerRefs = Pick<Parameters<typeof useTVPlayerRouting>[0], "exoRef" | "mpvRef">;

/**
 * PIPELINE DE FLUX du PlayerScreen — extrait VERBATIM (budget 300 lignes) : qualité →
 * état de reload → routage lecteur → pistes audio/sous-titres → reprise → URL de flux
 * (remux local / PlaybackInfo) → sync des refs miroir → info remux → récupération de
 * stall → pause permanente → reporting → résolution de pistes → seek (natif/remux).
 * L'ordre des hooks et leurs branchements sont ceux du composant plat d'origine ;
 * `s` (usePlayerMediaState) est le bus d'état partagé.
 */
export function usePlayerStreamPipeline(args: {
  itemId: string;
  item: MediaItem | undefined;
  ancestors: Ancestors;
  refs: PlayerRefs;
  s: PlayerMediaState;
}) {
  const { itemId, item, ancestors, refs, s } = args;
  const {
    paused, hasStarted, isLoading,
    positionRef, displayTimeRef, lastDisplayUpdate, lastProgressTime, pausedStateRef,
    controlsCurrentTimeRef, deadSessionRef, endedRef, handleEndRef, sessionStartRef,
    setDisplayTime, setVideoError, setPauseFrameUri, capturePauseFrame,
    reloadHoldRef, holdForReload,
    isDirectPlayRef, isLocalRemuxRef, mpvTrackMapRef,
    notifySeekRef, checkTriggerRef, setAudioIndexRef, setSubtitleIndexRef,
    resetPrefsAppliedRef, resetLoadedRef,
  } = s;

  const quality = useTVPlaybackQuality();
  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = useMemo(() => mediaSource?.MediaStreams ?? [], [mediaSource]);

  const defaultAudio = useMemo(() =>
    streams.find((st) => st.Type === "Audio" && st.IsDefault)?.Index
    ?? streams.find((st) => st.Type === "Audio")?.Index ?? 0,
    [streams],
  );

  // État de reload (nonce/startTicks/forceTranscode/softReload/reloadFrame…) +
  // reset au changement d'itemId. PRODUIT avant useTVStreamUrl (qui le consomme).
  const reload = useTVReloadState({
    itemId, defaultAudio, isLoading,
    positionRef, setAudioIndexRef, setSubtitleIndexRef, setVideoError,
    resetPrefsAppliedRef, qualityReset: quality.reset, deadSessionRef,
  });
  const {
    reloadNonce, setReloadNonce, softReloadRef, reloadFrameSec, setReloadFrameSec,
    startTicks, setStartTicks, forceTranscode, setForceTranscode, captureReloadTicks,
  } = reload;

  // Routage lecteur (ExoPlayer surface vs MPV) + dérivés de mode de lecture.
  const { useExoPlayer, playerRef, requestedDirectPlay, isDirectStream } = useTVPlayerRouting({
    forceTranscode, isTranscodingQuality: quality.isTranscodingQuality,
    exoRef: refs.exoRef, mpvRef: refs.mpvRef,
  });

  const audio = useTVAudioTrack({
    defaultAudio, isDirectPlayRef, isLocalRemuxRef, mpvTrackMapRef, playerRef,
    positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, captureReloadTicks,
  });
  const { audioIndex, setAudioIndex, handleAudioChange } = audio;
  setAudioIndexRef.current = setAudioIndex;

  const subtitle = useTVSubtitleControl({
    streams, isDirectPlayRef,
    positionRef, softReloadRef, setReloadFrameSec, setForceTranscode, captureReloadTicks,
  });
  const { subtitleIndex, setSubtitleIndex, handleSubtitleChange } = subtitle;
  setSubtitleIndexRef.current = setSubtitleIndex;

  // Position de DÉMARRAGE du player (#tnt-start) : reprise initiale figée ou
  // position posée par un changement de piste/qualité (startTicks).
  const { startSeconds } = useTVInitialResume({ item, startTicks, started: hasStarted });

  const { streamUrl, playSessionId, isDirectPlay, isLocalRemux, failed } = useTVStreamUrl({
    itemId, mediaSourceId, container: mediaSource?.Container, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds,
    forceTranscode, isTranscodingQuality: quality.isTranscodingQuality,
    maxBitrate: quality.maxBitrate, maxHeight: quality.maxHeight,
    isDirectPlay: requestedDirectPlay,
    reloadNonce,
  });

  // Synchronisation des refs miroir lues par les handlers/callbacks.
  isDirectPlayRef.current = isDirectPlay;
  isLocalRemuxRef.current = isLocalRemux;
  // Début (absolu) RÉEL de la session courante : le frag #tnt-start de l'URL porte
  // l'origine exacte renvoyée par le natif (keyframe ≤ T) — plus le T demandé.
  sessionStartRef.current = streamUrl ? parseStart(streamUrl).startSec : (startSeconds ?? 0);

  // État de production du remux (poll 1 Hz sessionInfo) : borne la fenêtre de seek natif
  // à l'ÉCRIT réel + alimente stall-recovery et détecteur de fin. Inerte hors remux.
  const remuxInfoRef = useTVRemuxInfo(isLocalRemux);
  // Dev : déverse les logs NATIFS [TVLR] du remux dans Metro (diagnostic device).
  useTVRemuxLogPump();

  // Récupération de stall remux (-11866) — sauf à ≤5 s de la fin d'un remux terminé (= FIN).
  const { onRemuxStall } = useTVRemuxStallRecovery({
    pausedStateRef, positionRef, softReloadRef, reloadHoldRef, deadSessionRef,
    setReloadFrameSec, setReloadNonce, setStartTicks, holdForReload, notifySeekRef, resetLoadedRef,
    infoRef: remuxInfoRef, endedRef, onEndRef: handleEndRef,
  });

  // Vraie pause permanente du remux on-device (anti -11866) : keepalive puis snapshot
  // VOD+ENDLIST après 20 s — la reprise post-VOD remonte une session fraîche à P.
  useTVRemuxPause({
    paused, isLocalRemux, positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, setStartTicks, holdForReload,
    notifySeekRef, resetLoadedRef, deadSessionRef, capturePauseFrame, infoRef: remuxInfoRef,
  });

  // Filet ANTI-FAMINE : un stall SANS -11866 (famine post-reprise, race de production)
  // n'avait aucune récupération (spinner infini) — même chemin de remount que le -11866.
  useTVRemuxFamineWatchdog({
    isLocalRemux, hasStarted,
    pausedStateRef, endedRef, deadSessionRef, softReloadRef, reloadHoldRef,
    lastProgressTime, positionRef, infoRef: remuxInfoRef,
    onRemuxStall, setVideoError,
  });

  // Capture de pause consommée : invalidée dès que la lecture reprend réellement.
  useEffect(() => {
    if (!paused && reloadFrameSec == null) setPauseFrameUri(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reloadFrameSec]);

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  const trackRes = useTVTrackResolution({
    streams, item, ancestors,
    positionRef, setAudioIndex, setSubtitleIndex, setStartTicks,
    // Préférence audio ≠ défaut → reload INCONDITIONNEL. L'ancien gate
    // (`!isDirectPlayRef || isLocalRemuxRef`) se fermait à tort pendant le
    // DÉMARRAGE : la résolution des préférences (async backend) arrive souvent
    // AVANT que le mode soit établi (result init isDirectPlay=true, remux pas
    // encore résolu) → aucun reload, l'UI affichait la préférence (VFQ) mais le
    // flux gardait l'audio par défaut (eng). En direct play natif établi, le
    // bump est un no-op d'URL (même stream, image figée auto-retirée) — sans
    // danger ; en remux/transcode il relance avec la bonne piste.
    onAudioReloadNeeded: () => {
      softReloadRef.current = true; setReloadFrameSec(positionRef.current); setReloadNonce((n) => n + 1);
    },
  });
  resetPrefsAppliedRef.current = trackRes.resetPrefsApplied;

  const mpvTracks = useTVMpvTracks({
    playerRef, streams, audioIndex, subtitleIndex,
    isDirectPlay, itemId, mediaSourceId,
  });
  mpvTrackMapRef.current = mpvTracks.mpvTrackMap;

  const { handleSeek } = useTVSeekControl({
    jellyfinDuration, playerRef, paused,
    displayTimeRef, positionRef, lastDisplayUpdate, lastProgressTime,
    reportSeek, setDisplayTime, notifySeekRef, checkTriggerRef, controlsCurrentTimeRef,
  });

  // SEEK tvOS REMUX : natif dans la fenêtre ÉCRITE, différé devant l'écrit, re-remux hors fenêtre.
  const seekOrRemux = useTVRemuxSeek({
    jellyfinDuration, handleSeek, isLocalRemuxRef, sessionStartRef, infoRef: remuxInfoRef,
    positionRef, displayTimeRef,
    lastDisplayUpdate, lastProgressTime, pausedStateRef, softReloadRef, setReloadFrameSec,
    setDisplayTime, notifySeekRef, reportSeek, setStartTicks, holdForReload,
    controlsCurrentTimeRef, deadSessionRef,
  });

  return {
    quality, sourceQuality, mediaSource, mediaSourceId, streams, jellyfinDuration,
    reloadNonce, setReloadNonce, softReloadRef, reloadFrameSec, setReloadFrameSec,
    startTicks, setStartTicks, forceTranscode, setForceTranscode, captureReloadTicks,
    useExoPlayer, playerRef, isDirectStream,
    audioIndex, handleAudioChange, subtitleIndex, handleSubtitleChange,
    startSeconds, streamUrl, playSessionId, isDirectPlay, isLocalRemux, failed,
    remuxInfoRef, onRemuxStall,
    reportStart, reportStop, updatePosition, reportSeek,
    mpvTracks, handleSeek, seekOrRemux,
  };
}
