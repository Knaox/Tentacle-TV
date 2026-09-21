import { useCallback, useMemo } from "react";
import { ticksToSeconds, extractSourceQuality } from "@tentacle-tv/shared";
import type { MediaItem, MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { usePlaybackReporting } from "@tentacle-tv/api-client";
import { useTVPlaybackQuality } from "./useTVPlaybackQuality";
import { useTVAutoQualityCap } from "./useTVAutoQualityCap";
import { useTVReloadState } from "./useTVReloadState";
import { useTVPlayerRouting } from "./useTVPlayerRouting";
import { useTVAudioTrack } from "./useTVAudioTrack";
import { useTVSubtitleControl } from "./useTVSubtitleControl";
import { useTVInitialResume } from "./useTVInitialResume";
import { useTVStreamUrl } from "./useTVStreamUrl";
import { useTVTrackResolution } from "./useTVTrackResolution";
import { useTVMpvTracks } from "./useTVMpvTracks";
import { useTVSeekControl } from "./useTVSeekControl";
import type { PlayerMediaState } from "./usePlayerMediaState";

type Ancestors = Parameters<typeof useTVTrackResolution>[0]["ancestors"];
type PlayerRefs = Pick<Parameters<typeof useTVPlayerRouting>[0], "exoRef" | "mpvRef">;

/**
 * PIPELINE DE FLUX du PlayerScreen — extrait VERBATIM (budget 300 lignes) : qualité →
 * état de reload → routage lecteur → pistes audio/sous-titres → reprise → URL de flux
 * (lecture directe / PlaybackInfo) → sync des refs miroir → reporting → résolution de
 * pistes → seek natif. L'ordre des hooks et leurs branchements sont ceux du composant
 * plat d'origine ; `s` (usePlayerMediaState) est le bus d'état partagé.
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
    positionRef, displayTimeRef, lastDisplayUpdate, lastProgressTime,
    controlsCurrentTimeRef,
    setDisplayTime, setVideoError,
    isDirectPlayRef, isPrismCoreRef, mpvTrackMapRef, subtitleTrackMapRef,
    notifySeekRef, setAudioIndexRef, setSubtitleIndexRef,
    resetPrefsAppliedRef,
  } = s;

  const mediaSource = item?.MediaSources?.[0];

  const rawQuality = useTVPlaybackQuality(mediaSource);
  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);

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
    resetPrefsAppliedRef, qualityReset: rawQuality.reset,
  });
  const {
    reloadNonce, setReloadNonce, softReloadRef, reloadFrameSec, setReloadFrameSec,
    startTicks, setStartTicks, forceTranscode, setForceTranscode, captureReloadTicks,
  } = reload;

  // Cap automatique selon le débit mesuré : traité comme un choix de qualité
  // par tout l'aval — le choix MANUEL de l'utilisateur prime (cf. hook).
  // `startTicks` : le cap se re-photographie à chaque reconstruction de session
  // (reload) — une lecture partie en Originale parce que la mesure n'était pas
  // prête bascule au premier reload au lieu de ramer à vie.
  const cap = useTVAutoQualityCap({ mediaSource, itemId, qualityKey: rawQuality.qualityKey, startTicks });
  const transcodingQuality = rawQuality.isTranscodingQuality || cap.active;
  const effectiveMaxBitrate = rawQuality.maxBitrate ?? cap.maxBitrate;
  const effectiveMaxHeight = rawQuality.maxHeight ?? cap.maxHeight;
  // Sélection EXPOSÉE à l'UI : la clé affichée est le palier réellement servi
  // (cap compris — « Originale » cochée pendant un cap mentait au sélecteur),
  // et tout choix du menu désarme d'abord le cap : re-choisir « Originale »
  // redevient possible et définitif pour cet item.
  const setQualityKeyManual = useCallback((k: QualityKey) => {
    cap.disarm();
    rawQuality.setQualityKey(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap.disarm, rawQuality.setQualityKey]);
  const quality = useMemo(() => ({
    ...rawQuality,
    qualityKey: cap.active && cap.key ? cap.key : rawQuality.qualityKey,
    setQualityKey: setQualityKeyManual,
  }), [rawQuality, cap.active, cap.key, setQualityKeyManual]);

  // Routage lecteur (ExoPlayer surface vs MPV) + dérivés de mode de lecture.
  const { useExoPlayer, playerRef, requestedDirectPlay, isDirectStream } = useTVPlayerRouting({
    forceTranscode, isTranscodingQuality: transcodingQuality,
    exoRef: refs.exoRef, mpvRef: refs.mpvRef,
  });

  const audio = useTVAudioTrack({
    defaultAudio, isDirectPlayRef, mpvTrackMapRef, playerRef,
    positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, captureReloadTicks,
  });
  const { audioIndex, setAudioIndex, handleAudioChange } = audio;
  setAudioIndexRef.current = setAudioIndex;

  const subtitle = useTVSubtitleControl({
    streams, isDirectPlayRef, subtitleTrackMapRef,
    positionRef, softReloadRef, setReloadFrameSec, setForceTranscode, captureReloadTicks,
  });
  const { subtitleIndex, setSubtitleIndex, handleSubtitleChange } = subtitle;
  setSubtitleIndexRef.current = setSubtitleIndex;

  // Position de DÉMARRAGE du player (#tnt-start) : reprise initiale figée ou
  // position posée par un changement de piste/qualité (startTicks).
  const { startSeconds } = useTVInitialResume({ item, startTicks, started: hasStarted });

  const { streamUrl, playSessionId, isDirectPlay, isPrismCore, prism, failed, retryMuxed } = useTVStreamUrl({
    itemId, mediaSourceId, container: mediaSource?.Container, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds,
    forceTranscode, isTranscodingQuality: transcodingQuality,
    maxBitrate: effectiveMaxBitrate, maxHeight: effectiveMaxHeight,
    isDirectPlay: requestedDirectPlay,
    reloadNonce,
  });

  // Synchronisation des refs miroir lues par les handlers/callbacks.
  isDirectPlayRef.current = isDirectPlay;
  isPrismCoreRef.current = isPrismCore;

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek, lastStopPromiseRef } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  const trackRes = useTVTrackResolution({
    streams, item, ancestors,
    positionRef, setAudioIndex, setSubtitleIndex, setStartTicks,
    // Préférence audio ≠ défaut → reload INCONDITIONNEL. L'ancien gate
    // (`!isDirectPlayRef`) se fermait à tort pendant le DÉMARRAGE : la
    // résolution des préférences (async backend) arrive souvent AVANT que le
    // mode soit établi (result init isDirectPlay=true) → aucun reload, l'UI
    // affichait la préférence (VFQ) mais le flux gardait l'audio par défaut
    // (eng). En direct play natif établi, le bump est un no-op d'URL (même
    // stream, image figée auto-retirée) — sans danger ; en transcode il
    // relance avec la bonne piste.
    onAudioReloadNeeded: () => {
      softReloadRef.current = true; setReloadFrameSec(positionRef.current); setReloadNonce((n) => n + 1);
    },
  });
  resetPrefsAppliedRef.current = trackRes.resetPrefsApplied;

  const mpvTracks = useTVMpvTracks({
    playerRef, streams, audioIndex, subtitleIndex,
    isDirectPlay, itemId, mediaSourceId, prismAudio: prism?.audioTracks,
  });
  mpvTrackMapRef.current = mpvTracks.mpvTrackMap;
  subtitleTrackMapRef.current = mpvTracks.subtitleTrackMap;

  const { handleSeek } = useTVSeekControl({
    jellyfinDuration, playerRef, paused,
    displayTimeRef, positionRef, lastDisplayUpdate, lastProgressTime,
    reportSeek, setDisplayTime, notifySeekRef, controlsCurrentTimeRef,
  });

  return {
    quality, autoCapActive: cap.active, sourceQuality, mediaSource, mediaSourceId, streams, jellyfinDuration,
    reloadNonce, setReloadNonce, softReloadRef, reloadFrameSec, setReloadFrameSec,
    startTicks, setStartTicks, forceTranscode, setForceTranscode, captureReloadTicks,
    useExoPlayer, playerRef, isDirectStream,
    audioIndex, handleAudioChange, subtitleIndex, handleSubtitleChange,
    startSeconds, streamUrl, playSessionId, isDirectPlay, isPrismCore, prism, failed, retryMuxed,
    reportStart, reportStop, updatePosition, reportSeek, lastStopPromiseRef,
    mpvTracks, handleSeek,
  };
}
