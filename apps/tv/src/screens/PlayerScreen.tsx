import { useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import { View, TouchableOpacity } from "react-native";
import { useMediaItem, useItemAncestors } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";
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
import { useTVPlaybackOverlay } from "../hooks/useTVPlaybackOverlay";
import { useTVPlaybackExit } from "../hooks/useTVPlaybackExit";
import { useTVSourceReset } from "../hooks/useTVSourceReset";
import { useTVPlayerBack } from "../hooks/useTVPlayerBack";
import { useTVErrorHandler } from "../hooks/useTVErrorHandler";
import { useTVPanelControls } from "../hooks/useTVPanelControls";
import { useTVSettingsBridge } from "../hooks/useTVSettingsBridge";
import { useTVSubtitleSync } from "../hooks/useTVSubtitleSync";
import { useTVPrismProgress } from "../hooks/useTVPrismProgress";
import { useTVTrackLists } from "../hooks/useTVTrackLists";
import { useEpisodePanelPrefetch } from "../hooks/useSeasonEpisodes";
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
    osdFocusSignal, osdFocusTargetRef, bumpOsdFocus,
  } = useTVPanelControls({ backgroundRef, recoverySuppressedRef: eofActiveRef });

  // Bus d'état partagé (positions, gates, refs miroir) + pipeline de flux.
  const s = usePlayerMediaState();
  const p = usePlayerStreamPipeline({ itemId, item, ancestors, refs: { exoRef, mpvRef }, s });
  const {
    paused, setPaused, displayTime, setDisplayTime, bufferedTime, setBufferedTime,
    displayTimeRef, bufferedTimeRef, lastDisplayUpdate, positionRef, controlsCurrentTimeRef,
    pausedStateRef, endedRef, handleEndRef,
    videoError, setVideoError, isLoading, setIsLoading, hasStarted, setHasStarted, lastProgressTime,
    reloadHold,
    notifySeekRef, resetLoadedRef, routeBackRef,
  } = s;
  const { streamUrl, isDirectPlay, jellyfinDuration, handleSeek, quality } = p;
  // Jalons d'ouverture PrismCore (tvOS) pour l'écran de chargement, tant que l'URL manque.
  const prismProgress = useTVPrismProgress(!!item && !streamUrl);

  // Refs stables pour les listeners à deps [] (AppState de lifecycle).
  const reportSeekRef = useRef(p.reportSeek);
  reportSeekRef.current = p.reportSeek;
  const reportStartRef = useRef(p.reportStart);
  reportStartRef.current = p.reportStart;

  const lifecycle = useTVPlaybackLifecycle({
    itemId, item, navigation,
    reportStop: p.reportStop, stopPromiseRef: p.lastStopPromiseRef, positionRef, pausedStateRef, reportSeekRef, reportStartRef,
    onBackground: () => setPaused(true),
    // Retour au premier plan : refocus OSD (le focus natif tvOS meurt au background) — sauf panneau ouvert.
    onForeground: () => { if (!showSettingsRef.current && !showEpisodesRef.current) bumpOsdFocus(); },
  });

  // Navigation inter-épisodes (aller à un épisode, transport). Le moteur
  // d'enchaînement, lui, est dans l'arbitre partagé, monté juste après.
  const {
    previousEpisode, navigateToEpisode, handlePrevEpisode, handleNextEpisode, handlePlayPause,
  } = useTVEpisodeNav({
    item, reportStop: p.reportStop, queryClient, itemId, navigation,
    handleSeek, setPaused,
  });

  /** La fin du média, en état : c'est une ENTRÉE de l'arbitre. */
  const [ended, setEnded] = useState(false);
  // Le scrub et l'habillage en MIROIR d'état : l'arbitre en a besoin (il
  // suspend son décompte, et il ne rend un passage mis en sourdine que le temps
  // de l'habillage) et les contrôles ont besoin de l'arbitre (`panelOpen`) —
  // quelqu'un doit passer en premier. Un rendu de retard, invisible ; une ref
  // resterait périmée.
  const [scrubbing, setScrubbing] = useState(false);
  const [osdVisible, setOsdVisible] = useState(false);

  const playback = useTVPlaybackOverlay({
    itemId, item, displayTime, displayDuration: jellyfinDuration ?? 0,
    hasStarted, ended, scrubbing, controlsVisible: osdVisible,
    onSeek: handleSeek,
    navigateToEpisode,
    onFinished: () => { void lifecycle.handleFinished(); },
  });
  const autoPlay = playback.autoPlay;

  const controls = useTVPlayerControls({
    paused, jellyfinDuration: jellyfinDuration ?? 0,
    currentTimeRef: controlsCurrentTimeRef,
    onSeek: handleSeek,
    onBack: () => {
      if (routeBackRef.current()) return;   // scrub/overlay auto-play/grâce (source unique)
      // Quitter un panneau rend le focus au bouton qui l'a OUVERT — pas au
      // « dernier bouton utilisé », qui se devinait et se trompait.
      if (showSettingsRef.current) {
        setShowSettings(false);
        showSettingsRef.current = false;
        bumpOsdFocus("settings");
        return;
      }
      if (showEpisodesRef.current) {
        setShowEpisodes(false);
        bumpOsdFocus("episodes");
        return;
      }
      lifecycle.leavePlayer();
    },
    onPlayPause: handlePlayPause,
    // Le scrub met la lecture en pause et la reprend à la confirmation/annulation
    onScrubPause: setPaused,
    // Écran de fin plein écran (eof) = panneau : neutralise pan/scrub/play-pause du
    // lecteur ET son Back JS — le Retour est routé par useTVPlayerBack (preventRemove).
    panelOpen: showSettings || showEpisodes || autoPlay.source === "eof",
  });
  useEffect(() => { setScrubbing(controls.scrubbing); }, [controls.scrubbing]);
  // En déplacement, l'habillage est masqué — le dire à l'arbitre, sinon un
  // passage mis en sourdine ressortirait le temps d'une avance rapide.
  useEffect(() => {
    setOsdVisible(controls.overlayVisible && !controls.scrubbing);
  }, [controls.overlayVisible, controls.scrubbing]);

  // La croix de l'affiche de fin — la sortie elle-même (fin sans suite, refus,
  // réglage éteint) part de la coquille partagée, par `onFinished` ci-dessus.
  const { dismissAutoPlay } = useTVPlaybackExit({ playback, endedRef });

  // Interception du bouton Retour PHYSIQUE tvOS (usePreventRemove — le pop natif est la
  // seule voie de ce bouton, cf. hook) + source de vérité des chemins Retour JS.
  const back = useTVPlayerBack({
    scrubbing: controls.scrubbing, cancelScrub: controls.cancelScrub,
    surfaceActive: autoPlay.source !== null, surfaceRef: playback.surfaceRef,
    // Un passage qui part tout seul : le Retour le garde au lieu de quitter.
    skipRefusable:
      playback.overlay.kind === "skip" && playback.overlay.auto && playback.overlay.dismissible,
    dismissSegment: playback.dismissOverlay,
    dismissAutoPlay,
  });
  routeBackRef.current = back.routeBack;

  // L'OSD réapparaît → focus sur le dernier bouton de transport utilisé.
  const prevOverlayVisibleRef = useRef(true);
  useEffect(() => {
    if (controls.overlayVisible && !prevOverlayVisibleRef.current) bumpOsdFocus();
    prevOverlayVisibleRef.current = controls.overlayVisible;
  }, [controls.overlayVisible, bumpOsdFocus]);

  /**
   * L'ENTRÉE dans la vidéo : le focus va à lecture/pause.
   *
   * Personne ne le réclamait — l'effet ci-dessus ne se déclenche qu'à une
   * RÉAPPARITION de l'habillage, et il est déjà visible au premier rendu. Le
   * guide de l'habillage prenait donc son premier enfant focusable, qui est
   * « quitter la vidéo » : un appui sur OK au lancement sortait du lecteur.
   *
   * À la première image, pas au montage : avant elle, l'écran de chargement
   * occupe la dalle et tait l'habillage, dont les boutons ne sont pas
   * focusables.
   */
  const entryClaimedRef = useRef(false);
  useEffect(() => {
    if (!hasStarted || entryClaimedRef.current) return;
    entryClaimedRef.current = true;
    bumpOsdFocus("playpause");
  }, [hasStarted, bumpOsdFocus]);

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
    onEnded: () => { setEnded(true); },
    endedRef,
  });
  const { handleLoad, handleProgress, handleEnd } = events;
  notifySeekRef.current = events.notifySeek;
  resetLoadedRef.current = events.resetLoaded;
  handleEndRef.current = handleEnd;

  // Remise à zéro de la source — voir `useTVSourceReset`.
  useTVSourceReset({
    streamUrl, softReloadRef: p.softReloadRef, endedRef, resetLoadedRef, notifySeekRef,
    setEnded, setHasStarted, setIsLoading,
  });

  const { handleQualityChange } = useTVQualityChange({
    setQualityKey: quality.setQualityKey, positionRef, captureReloadTicks: p.captureReloadTicks,
    softReloadRef: p.softReloadRef, setReloadFrameSec: p.setReloadFrameSec,
  });

  // Erreur de codec en direct play → bascule transcode ; 401 direct streaming →
  // token frais + reload (useTVDirectStreamRecovery).
  const { handleError } = useTVErrorHandler({
    forceTranscode: p.forceTranscode, captureReloadTicks: p.captureReloadTicks,
    setVideoError, setForceTranscode: p.setForceTranscode, onMasterRejected: p.onMasterRejected,
    bumpReloadNonce: () => p.setReloadNonce((n) => n + 1), setIsLoading,
  });

  const { audioTracksList, subtitleTracksList } = useTVTrackLists(p.streams, p.prism?.audioTracks);
  // Le panneau des épisodes s'ouvre déjà rempli : saisons et saison en cours préchargées.
  useEpisodePanelPrefetch(item, hasStarted);

  // Pont vers la route MODALE Réglages/Qualité.
  const { handleCloseSettings } = useTVSettingsBridge({
    audioTracksList, subtitleTracksList, audioIndex: p.audioIndex, subtitleIndex: p.subtitleIndex,
    qualityKey: quality.qualityKey, qualityPresets: quality.qualityPresets, sourceQuality: p.sourceQuality,
    handleAudioChange: p.handleAudioChange, handleSubtitleChange: p.handleSubtitleChange, handleQualityChange,
    showOverlay: controls.showOverlay, setShowSettings, showSettingsRef, bumpOsdFocus,
  });

  const { handleVideoSize, playerStyle } = useTVPlayerStyle();

  const displayDuration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : 0;
  // Une surface est montée — carte ou affiche de fin — décompte ou non. C'est
  // elle qui neutralise l'habillage du lecteur, pas le chiffre.
  const autoPlayActive = autoPlay.source !== null;
  eofActiveRef.current = autoPlay.source === "eof";
  // Item/URL pas encore résolus : écran de chargement contextualisé — avec issue de
  // secours si la résolution du flux a échoué (erreur + « Réessayer »).
  if (!item || !streamUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TVPlayerLoadingScreen
          item={item ?? placeholderItem}
          failed={p.failed} progressLabel={prismProgress.label}
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
      useExoPlayer={p.useExoPlayer} isDirectPlay={isDirectPlay} prismTextTrackIndex={p.prismTextTrackIndex} frameRate={p.frameRate} exoRef={exoRef} mpvRef={mpvRef}
      backgroundRef={backgroundRef} playerStyle={playerStyle}
      audioTracksList={audioTracksList} subtitleTracksList={subtitleTracksList}
      audioIndex={p.audioIndex} subtitleIndex={p.subtitleIndex}
      qualityKey={quality.qualityKey} sourceQuality={p.sourceQuality} autoCapActive={p.autoCapActive}
      overlay={playback.overlay} onSkipSegment={playback.skipNow}
      onDismissSegment={playback.dismissOverlay}
      onPlayNextNow={playback.playNow}
      autoPlay={autoPlay} controls={controls}
      onLoad={handleLoad} onProgress={handleProgress} onEnd={handleEnd}
      onError={handleError} onTracks={p.mpvTracks.handleTracks} onVideoSize={handleVideoSize}
      onPlayPause={handlePlayPause}
      // Bouton Retour de l'OSD : MÊME routage que le bouton physique (avant : sortie
      // brute qui bypassait overlay auto-play/scrub — quittait même bannière ouverte).
      onBack={() => { if (!routeBackRef.current()) void lifecycle.leavePlayer(); }}
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
      trickplay={trickplay} reloadFrameSec={p.reloadFrameSec} osdFocusSignal={osdFocusSignal}
      osdFocusTargetRef={osdFocusTargetRef}
      subtitleCue={subtitleCue} textTracks={textTracks}
      showEpisodes={showEpisodes}
      onToggleEpisodes={() => { setShowEpisodes((v) => !v); controls.showOverlay(); }}
      onCloseEpisodes={() => { setShowEpisodes(false); controls.showOverlay(); bumpOsdFocus("episodes"); }}
      onSelectEpisode={(ep) => { setShowEpisodes(false); navigateToEpisode(ep.Id); }}
      onEofDismiss={() => { dismissAutoPlay(); }}
    />
  );
}
