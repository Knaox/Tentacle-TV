import { useCallback, useEffect, useMemo, useRef, type ElementRef } from "react";
import { View, TouchableOpacity } from "react-native";
import { useMediaItem, useItemAncestors } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";
import { formatTrackLabel, parseStart } from "../utils/playerHelpers";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";
import { TVPlayerView } from "../components/player/TVPlayerView";
import { usePlayerMediaState } from "../hooks/usePlayerMediaState";
import { usePlayerStreamPipeline } from "../hooks/usePlayerStreamPipeline";
import { useTVPlaybackLifecycle } from "../hooks/useTVPlaybackLifecycle";
import { useTVPlayerEventHandlers } from "../hooks/useTVPlayerEventHandlers";
import { useTVTrickplay } from "../hooks/useTVTrickplay";
import { useTVPlayerStyle } from "../hooks/useTVPlayerStyle";
import { useTVQualityChange } from "../hooks/useTVQualityChange";
import { useTVEpisodeNav } from "../hooks/useTVEpisodeNav";
import { useTVEndFallback } from "../hooks/useTVEndFallback";
import { useTVPlayerBack } from "../hooks/useTVPlayerBack";
import { useTVErrorHandler } from "../hooks/useTVErrorHandler";
import { useTVPanelControls } from "../hooks/useTVPanelControls";
import { useTVSettingsBridge } from "../hooks/useTVSettingsBridge";
import { useTVSubtitleSync } from "../hooks/useTVSubtitleSync";
import { findCachedMediaItem } from "../utils/findCachedMediaItem";
import { TVPlayerLoadingScreen } from "../components/player/TVPlayerLoadingScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

/**
 * Écran lecteur TV — ORCHESTRATEUR mince (budget 300 lignes) : l'état média + refs
 * partagés vivent dans usePlayerMediaState, la chaîne qualité→URL→seek dans
 * usePlayerStreamPipeline ; ici on branche navigation, contrôles télécommande,
 * auto-play, événements player et rendu.
 */
export function PlayerScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);
  const queryClient = useQueryClient();
  // Pendant le fetch de l'item complet, la bannière de chargement s'appuie sur la
  // version déjà en cache (cartes Home, fiche, épisodes) : titre + affiche immédiats.
  // JAMAIS utilisé pour la lecture elle-même (UserData de reprise potentiellement périmé).
  const placeholderItem = useMemo(
    () => (item ? null : findCachedMediaItem(queryClient, itemId)),
    [item, queryClient, itemId],
  );

  const mpvRef = useRef<MPVPlayerHandle>(null);
  const exoRef = useRef<MPVPlayerHandle>(null);
  const backgroundRef = useRef<ElementRef<typeof TouchableOpacity>>(null);
  // Mis à jour plus bas (autoPlay est défini après) — lu dynamiquement par la
  // focus recovery : pendant l'écran « épisode suivant » (eof), recibler le
  // fond volerait le focus aux boutons de la fiche (innavigable sur Android).
  const eofActiveRef = useRef(false);

  // État des panneaux in-player (Réglages/Épisodes) + refocus OSD (usePreventRemove
  // du panneau épisodes vit dedans).
  const {
    showSettings, setShowSettings, showSettingsRef,
    showEpisodes, setShowEpisodes, showEpisodesRef,
    osdFocusSignal, bumpOsdFocus,
  } = useTVPanelControls({ backgroundRef, recoverySuppressedRef: eofActiveRef });

  // Bus d'état partagé (positions, gates, refs miroir) + pipeline de flux.
  const s = usePlayerMediaState();
  const p = usePlayerStreamPipeline({ itemId, item, ancestors, refs: { exoRef, mpvRef }, s });
  const {
    paused, setPaused, displayTime, setDisplayTime, bufferedTime, setBufferedTime,
    displayTimeRef, bufferedTimeRef, lastDisplayUpdate, positionRef, controlsCurrentTimeRef,
    pausedStateRef, deadSessionRef, endedRef, handleEndRef, pauseFrameUri,
    videoError, setVideoError, isLoading, setIsLoading, hasStarted, setHasStarted, lastProgressTime,
    reloadHold, reloadHoldRef,
    notifySeekRef, checkTriggerRef, resetLoadedRef, routeBackRef,
  } = s;
  const { streamUrl, isDirectPlay, isLocalRemux, jellyfinDuration, seekOrRemux, quality } = p;

  // Refs stables pour les listeners à deps [] (AppState de lifecycle).
  const reportSeekRef = useRef(p.reportSeek);
  reportSeekRef.current = p.reportSeek;
  const reportStartRef = useRef(p.reportStart);
  reportStartRef.current = p.reportStart;

  const lifecycle = useTVPlaybackLifecycle({
    itemId, seriesId: item?.SeriesId, navigation,
    reportStop: p.reportStop, positionRef, pausedStateRef, reportSeekRef, reportStartRef,
    onBackground: () => setPaused(true),
    // Retour au premier plan : refocus OSD (le focus natif tvOS meurt au background) — sauf panneau ouvert.
    onForeground: () => { if (!showSettingsRef.current && !showEpisodesRef.current) bumpOsdFocus(); },
  });

  // Navigation inter-épisodes : auto-play (générique → suivant), skip intro/crédits.
  const {
    autoPlay, skipSegments, previousEpisode,
    navigateToEpisode, handlePrevEpisode, handleNextEpisode, handlePlayPause,
  } = useTVEpisodeNav({
    item, jellyfinDuration, reportStop: p.reportStop, queryClient, itemId, navigation,
    handleSeek: seekOrRemux, setPaused,
  });

  const controls = useTVPlayerControls({
    paused, jellyfinDuration: jellyfinDuration ?? 0,
    currentTimeRef: controlsCurrentTimeRef,
    onSeek: seekOrRemux,
    onBack: () => {
      if (routeBackRef.current()) return;   // scrub/overlay auto-play/grâce (source unique)
      if (showSettingsRef.current) {
        setShowSettings(false);
        showSettingsRef.current = false;
        bumpOsdFocus();
        return;
      }
      if (showEpisodesRef.current) {
        setShowEpisodes(false);
        bumpOsdFocus();
        return;
      }
      lifecycle.invalidateAndGoBack();
    },
    onPlayPause: handlePlayPause,
    // Le scrub met la lecture en pause et la reprend à la confirmation/annulation
    onScrubPause: setPaused,
    // Écran de fin plein écran (eof) = panneau : neutralise pan/scrub/play-pause du
    // lecteur ET son Back JS — le Retour est routé par useTVPlayerBack (preventRemove).
    panelOpen: showSettings || showEpisodes || autoPlay.source === "eof",
  });

  // Fermeture de l'overlay auto-play : à la VRAIE fin (endedRef), « ignorer » l'écran de
  // fin = retour à la fiche média (avant : player gelé sur la dernière frame). Renvoie
  // true si une navigation part (la grâce Retour ne doit alors PAS être armée).
  // Dispatch différé d'un tick : usePreventRemove bloque un dispatch du même tick.
  const dismissAutoPlay = useCallback(() => {
    const wasEof = autoPlay.source === "eof";
    autoPlay.cancelAutoPlay();
    if (wasEof && endedRef.current) {
      setTimeout(() => { void lifecycle.handleFinished(); }, 0);
      return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, lifecycle]);

  // Interception du bouton Retour PHYSIQUE tvOS (usePreventRemove — le pop natif est la
  // seule voie de ce bouton, cf. hook) + source de vérité des chemins Retour JS.
  const back = useTVPlayerBack({
    scrubbing: controls.scrubbing, cancelScrub: controls.cancelScrub,
    countdown: autoPlay.countdown, countdownRef: autoPlay.countdownRef,
    dismissAutoPlay,
  });
  routeBackRef.current = back.routeBack;

  // L'OSD réapparaît → focus sur le dernier bouton de transport utilisé.
  const prevOverlayVisibleRef = useRef(true);
  useEffect(() => {
    if (controls.overlayVisible && !prevOverlayVisibleRef.current) bumpOsdFocus();
    prevOverlayVisibleRef.current = controls.overlayVisible;
  }, [controls.overlayVisible, bumpOsdFocus]);

  // Vignettes de prévisualisation (Jellyfin Trickplay) pour le mode scrub
  const trickplay = useTVTrickplay(item, p.mediaSource?.Id);

  // Sous-titres : pistes texte natives (Android) + overlay JS + synchro d'affichage.
  const { subtitleCue, textTracks } = useTVSubtitleSync({
    itemId, mediaSourceId: p.mediaSource?.Id, streams: p.streams,
    useExoPlayer: p.useExoPlayer, subtitleIndex: p.subtitleIndex,
    exoRef, subtitleTrackMap: p.mpvTracks.subtitleTrackMap,
    displayTimeRef, bufferedTimeRef, lastProgressTime, lastDisplayUpdate, pausedStateRef,
    overlayVisible: controls.overlayVisible, setDisplayTime, setBufferedTime,
  });

  const events = useTVPlayerEventHandlers({
    playerRef: p.playerRef, paused,
    positionRef, pausedStateRef, displayTimeRef, bufferedTimeRef,
    lastDisplayUpdate, lastProgressTime, controlsCurrentTimeRef,
    setDisplayTime, setBufferedTime, setIsLoading,
    reportStart: p.reportStart, updatePosition: p.updatePosition,
    // L'écran de chargement reste affiché jusqu'à la première position réelle
    onPlaybackActive: () => setHasStarted(true),
    autoPlay, handleFinished: lifecycle.handleFinished, endedRef,
  });
  const { handleLoad, handleProgress, handleEnd } = events;
  notifySeekRef.current = events.notifySeek;
  checkTriggerRef.current = events.checkTriggerRef.current;
  resetLoadedRef.current = events.resetLoaded;
  handleEndRef.current = handleEnd;

  // Filet de FIN (remux local uniquement) : l'onEnd AVPlayer peut ne JAMAIS venir sur la
  // playlist EVENT (bug durée indéfinie post-ENDLIST) → détecteur de stagnation près de
  // la fin réelle. No-op Android/direct play/transcode (cf. useTVEndFallback[.ios]).
  useTVEndFallback({
    isLocalRemux, paused, jellyfinDuration, positionRef, infoRef: p.remuxInfoRef,
    reloadHoldRef, softReloadRef: p.softReloadRef, endedRef, onEndRef: handleEndRef,
  });

  // À chaque (re)chargement de source : réafficher l'écran de chargement jusqu'à la
  // première position réelle du nouveau flux, et armer la fenêtre post-seek sur la
  // position de départ RÉELLE (frag de l'URL) — les progress parasites sont ignorés.
  useEffect(() => {
    if (!streamUrl) return;
    resetLoadedRef.current();
    endedRef.current = false;   // nouvelle source (épisode suivant, reload piste) → fin ré-armable
    // Reload DOUX (piste/qualité, même contenu) : garder la dernière image + spinner discret.
    if (p.softReloadRef.current) {
      p.softReloadRef.current = false;
    } else {
      setHasStarted(false);
    }
    setIsLoading(true);
    // Cible = origine RÉELLE portée par le frag de l'URL (atomique avec elle) : armer sur le
    // T demandé ratait la convergence quand la session démarre à la keyframe ≤ T.
    const armAt = parseStart(streamUrl).startSec;
    if (armAt > 1) notifySeekRef.current(armAt, 8000, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  const { handleQualityChange } = useTVQualityChange({
    setQualityKey: quality.setQualityKey, positionRef, captureReloadTicks: p.captureReloadTicks,
    softReloadRef: p.softReloadRef, setReloadFrameSec: p.setReloadFrameSec,
  });

  // Erreur de codec en direct play → bascule transcode ; stall remux → recovery ;
  // 401 direct streaming → token frais + reload (useTVDirectStreamRecovery).
  const { handleError } = useTVErrorHandler({
    forceTranscode: p.forceTranscode, captureReloadTicks: p.captureReloadTicks,
    setVideoError, setForceTranscode: p.setForceTranscode, onRemuxStall: p.onRemuxStall, pausedStateRef,
    bumpReloadNonce: () => p.setReloadNonce((n) => n + 1), setIsLoading,
  });

  const audioTracksList = useMemo(() =>
    p.streams.filter((st) => st.Type === "Audio").map((st) => ({ index: st.Index, label: formatTrackLabel(st) })), [p.streams]);
  const subtitleTracksList = useMemo(() =>
    p.streams.filter((st) => st.Type === "Subtitle").map((st) => ({ index: st.Index, label: formatTrackLabel(st) })), [p.streams]);

  // Pont vers la route MODALE Réglages/Qualité.
  const { handleCloseSettings } = useTVSettingsBridge({
    audioTracksList, subtitleTracksList, audioIndex: p.audioIndex, subtitleIndex: p.subtitleIndex,
    qualityKey: quality.qualityKey, sourceQuality: p.sourceQuality,
    handleAudioChange: p.handleAudioChange, handleSubtitleChange: p.handleSubtitleChange, handleQualityChange,
    showOverlay: controls.showOverlay, setShowSettings, showSettingsRef, bumpOsdFocus,
  });

  const { handleVideoSize, playerStyle } = useTVPlayerStyle();

  const displayDuration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : 0;
  const autoPlayActive = autoPlay.countdown !== null;
  eofActiveRef.current = autoPlay.source === "eof" && autoPlay.countdown !== null;
  // Item/URL pas encore résolus : écran de chargement contextualisé — avec issue de
  // secours si la résolution du flux a échoué (erreur + « Réessayer »).
  if (!item || !streamUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TVPlayerLoadingScreen
          item={item ?? placeholderItem}
          failed={p.failed}
          onRetry={() => p.setReloadNonce((n) => n + 1)}
        />
      </View>
    );
  }

  return (
    <TVPlayerView
      item={item} streamUrl={streamUrl} paused={paused} playerPaused={paused || reloadHold} isLoading={isLoading}
      hasStarted={hasStarted}
      videoError={videoError} displayTime={displayTime} bufferedTime={bufferedTime}
      displayDuration={displayDuration} showSettings={showSettings}
      autoPlayActive={autoPlayActive} hasPreviousEpisode={!!previousEpisode}
      useExoPlayer={p.useExoPlayer} isDirectPlay={isDirectPlay} exoRef={exoRef} mpvRef={mpvRef}
      backgroundRef={backgroundRef} playerStyle={playerStyle}
      audioTracksList={audioTracksList} subtitleTracksList={subtitleTracksList}
      audioIndex={p.audioIndex} subtitleIndex={p.subtitleIndex}
      qualityKey={quality.qualityKey} sourceQuality={p.sourceQuality}
      skipSegments={skipSegments} autoPlay={autoPlay} controls={controls}
      onLoad={handleLoad} onProgress={handleProgress} onEnd={handleEnd}
      onError={handleError} onTracks={p.mpvTracks.handleTracks} onVideoSize={handleVideoSize}
      onPlayPause={handlePlayPause} onSeek={seekOrRemux}
      // Bouton Retour de l'OSD : MÊME routage que le bouton physique (avant : sortie
      // brute qui bypassait overlay auto-play/scrub — quittait même bannière ouverte).
      onBack={() => { if (!routeBackRef.current()) void lifecycle.invalidateAndGoBack(); }}
      onToggleSettings={() => {
        // Ouvre la MODALE Réglages/Qualité (cf. PlayerSettingsScreen).
        setShowSettings(true);
        showSettingsRef.current = true;
        controls.showOverlay();
        navigation.navigate("PlayerSettings");
      }}
      onSelectAudio={p.handleAudioChange} onSelectSubtitle={p.handleSubtitleChange}
      onSelectQuality={handleQualityChange}
      onCloseSettings={handleCloseSettings}
      onPrevEpisode={handlePrevEpisode} onNextEpisode={handleNextEpisode}
      trickplay={trickplay} reloadFrameSec={p.reloadFrameSec} pauseFrameUri={pauseFrameUri} osdFocusSignal={osdFocusSignal}
      subtitleCue={subtitleCue} textTracks={textTracks}
      showEpisodes={showEpisodes}
      onToggleEpisodes={() => { setShowEpisodes((v) => !v); controls.showOverlay(); }}
      onCloseEpisodes={() => { setShowEpisodes(false); controls.showOverlay(); bumpOsdFocus(); }}
      onSelectEpisode={(ep) => { setShowEpisodes(false); navigateToEpisode(ep.Id); }}
      onEofDismiss={() => { dismissAutoPlay(); }}
    />
  );
}
