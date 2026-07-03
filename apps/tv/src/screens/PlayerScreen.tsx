import { useState, useRef, useEffect, useMemo, useCallback, type ElementRef } from "react";
import { View, TouchableOpacity, NativeModules } from "react-native";
import { useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting } from "@tentacle-tv/api-client";
import { ticksToSeconds, extractSourceQuality } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";
import { formatTrackLabel } from "../utils/playerHelpers";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";
import { TVPlayerView } from "../components/player/TVPlayerView";
import { useTVPlaybackQuality } from "../hooks/useTVPlaybackQuality";
import { useTVPlaybackLifecycle } from "../hooks/useTVPlaybackLifecycle";
import { useTVMpvTracks } from "../hooks/useTVMpvTracks";
import { useTVTrackResolution } from "../hooks/useTVTrackResolution";
import { useTVPlayerEventHandlers } from "../hooks/useTVPlayerEventHandlers";
import { useTVStreamUrl } from "../hooks/useTVStreamUrl";
import { useTVTrickplay } from "../hooks/useTVTrickplay";
import { useTVPlayerStyle } from "../hooks/useTVPlayerStyle";
import { useTVPlayerRouting } from "../hooks/useTVPlayerRouting";
import { useTVInitialResume } from "../hooks/useTVInitialResume";
import { useTVReloadState } from "../hooks/useTVReloadState";
import { useTVReloadHold } from "../hooks/useTVReloadHold";
import { useTVRemuxPause } from "../hooks/useTVRemuxPause";
import { useTVRemuxStallRecovery } from "../hooks/useTVRemuxStallRecovery";
import { useTVAudioTrack } from "../hooks/useTVAudioTrack";
import { useTVSubtitleControl } from "../hooks/useTVSubtitleControl";
import { useTVSeekControl } from "../hooks/useTVSeekControl";
import { useTVRemuxSeek } from "../hooks/useTVRemuxSeek";
import { useTVQualityChange } from "../hooks/useTVQualityChange";
import { useTVEpisodeNav } from "../hooks/useTVEpisodeNav";
import { useTVErrorHandler } from "../hooks/useTVErrorHandler";
import { useTVPanelControls } from "../hooks/useTVPanelControls";
import { useTVSettingsBridge } from "../hooks/useTVSettingsBridge";
import { useTVSubtitleSync } from "../hooks/useTVSubtitleSync";
import { findCachedMediaItem } from "../utils/findCachedMediaItem";
import { TVPlayerLoadingScreen } from "../components/player/TVPlayerLoadingScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

export function PlayerScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);
  const queryClient = useQueryClient();
  // Pendant le fetch de l'item complet, la bannière de chargement s'appuie
  // sur la version déjà en cache (cartes Home, fiche, épisodes) : titre +
  // affiche immédiats au lieu d'un écran noir. JAMAIS utilisé pour la
  // lecture elle-même (UserData de reprise potentiellement périmé).
  const placeholderItem = useMemo(
    () => (item ? null : findCachedMediaItem(queryClient, itemId)),
    [item, queryClient, itemId],
  );

  const mpvRef = useRef<MPVPlayerHandle>(null);
  const exoRef = useRef<MPVPlayerHandle>(null);
  const backgroundRef = useRef<ElementRef<typeof TouchableOpacity>>(null);
  const [paused, setPaused] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const displayTimeRef = useRef(0);
  const bufferedTimeRef = useRef(0);
  const lastDisplayUpdate = useRef(0);
  // État des panneaux in-player (Réglages/Épisodes) + refocus OSD + filets de
  // sécurité dismiss/focus. CE hook POSSÈDE l'état des panneaux (usePreventRemove
  // + useFocusRecovery vivent dedans). L'effet `overlayVisible → bumpOsdFocus`
  // RESTE inline plus bas (controls est défini APRÈS cet état).
  const {
    showSettings, setShowSettings, showSettingsRef,
    showEpisodes, setShowEpisodes, showEpisodesRef,
    osdFocusSignal, bumpOsdFocus,
  } = useTVPanelControls({ backgroundRef });
  const positionRef = useRef(0);
  // Miroir de `paused` lu par les listeners/callbacks à deps [] (remonté ici :
  // consommé dès useTVRemuxStallRecovery, avant les hooks de reporting).
  const pausedStateRef = useRef(paused);
  pausedStateRef.current = paused;
  // Session remux locale morte pendant une pause (stall -11866 malgré le
  // keepalive) : possédé ici, partagé entre useTVRemuxStallRecovery (pose),
  // useTVRemuxPause (reprise), useTVRemuxSeek (seek) et useTVReloadState
  // (persistance de l'image figée + reset au changement d'item).
  const deadSessionRef = useRef(false);
  // Capture réelle de la dernière frame (pause longue remux) : prise à l'engage
  // de la pause (vidéo intacte à l'écran), affichée par TVReloadFrame si la
  // session meurt — à la place de la vignette trickplay basse résolution.
  const [pauseFrameUri, setPauseFrameUri] = useState<string | null>(null);
  const capturePauseFrame = useCallback(() => {
    (NativeModules as { TVDisplayCriteria?: { captureFrame?: () => Promise<{ uri?: string } | null> } })
      .TVDisplayCriteria?.captureFrame?.()
      .then((r) => { if (r?.uri) setPauseFrameUri(r.uri); })
      .catch(() => {});
  }, []);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Premier onLoad reçu → les isLoading suivants sont du rebuffering (spinner
  // discret) et non plus le chargement initial (écran contextualisé).
  const [hasStarted, setHasStarted] = useState(false);
  const lastProgressTime = useRef(Date.now());

  // « Hold » de reload (remux tvOS) : lecteur gardé en pause pendant un reload
  // de reprise/seek, sans toucher l'intention `paused`. Cf. useTVReloadHold.
  const { reloadHold, reloadHoldRef, holdForReload } = useTVReloadHold({ isLoading, setIsLoading });

  const quality = useTVPlaybackQuality();
  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  // Refs MIROIR des sorties post-stream (isDirectPlay / isLocalRemux / mpvTrackMap)
  // lues au CLIC par les handlers audio/sous-titre — ces hooks d'état tournent
  // AVANT useTVStreamUrl (leur state alimente l'URL), mais ces valeurs n'existent
  // qu'APRÈS. Synchronisées plus bas. (Dans le composant plat d'origine, les
  // handlers tardifs fermaient directement sur ces valeurs ; ici on préserve
  // la même lecture fraîche via refs.)
  const isDirectPlayRef = useRef(false);
  const isLocalRemuxRef = useRef(false);
  const mpvTrackMapRef = useRef<Record<number, number>>({});
  // notifySeek/checkTrigger : remplis après useTVPlayerEventHandlers (handleSeek
  // est défini avant). Refs standalone (parité avec le composant plat).
  const notifySeekRef = useRef<(target: number, windowMs?: number, afterReload?: boolean) => void>(() => {});
  const checkTriggerRef = useRef<(seconds: number) => void>(() => {});
  // setAudioIndex/setSubtitleIndex : remplis après les hooks audio/sous-titre
  // (qui tournent après le reset effect de useTVReloadState).
  const setAudioIndexRef = useRef<(i: number) => void>(() => {});
  const setSubtitleIndexRef = useRef<(i: number) => void>(() => {});
  // resetPrefsApplied : rempli après useTVTrackResolution.
  const resetPrefsAppliedRef = useRef<(() => void) | null>(null);
  // resetLoaded : rempli après useTVPlayerEventHandlers.
  const resetLoadedRef = useRef<() => void>(() => {});

  const defaultAudio = useMemo(() =>
    streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0,
    [streams],
  );

  // État de reload (nonce/startTicks/forceTranscode/softReload/reloadFrame…) +
  // reset au changement d'itemId. PRODUIT avant useTVStreamUrl (qui consomme
  // forceTranscode/startTicks/reloadNonce).
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
  // AVANT audio/sous-titre : `playerRef` est consommé par le handler audio.
  const { useExoPlayer, playerRef, requestedDirectPlay, isDirectStream } = useTVPlayerRouting({
    forceTranscode, isTranscodingQuality: quality.isTranscodingQuality, exoRef, mpvRef,
  });

  const audio = useTVAudioTrack({
    defaultAudio, isDirectPlayRef, isLocalRemuxRef, mpvTrackMapRef, playerRef,
    positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, captureReloadTicks,
  });
  const { audioIndex, setAudioIndex, handleAudioChange } = audio;
  setAudioIndexRef.current = setAudioIndex;

  const subtitle = useTVSubtitleControl({
    streams, isDirectPlayRef, isLocalRemuxRef,
    positionRef, softReloadRef, setReloadFrameSec, setForceTranscode, captureReloadTicks,
  });
  const { subtitleIndex, setSubtitleIndex, handleSubtitleChange } = subtitle;
  setSubtitleIndexRef.current = setSubtitleIndex;

  // Position de DÉMARRAGE du player (#tnt-start) : reprise initiale figée ou
  // position courante posée par un changement de piste/qualité (startTicks).
  const { startSeconds } = useTVInitialResume({ item, startTicks, started: hasStarted });
  // Début (absolu) de la session remux courante (= dernier startSeconds) → borne basse du seek natif arrière.
  const sessionStartRef = useRef(0);
  sessionStartRef.current = startSeconds ?? 0;

  const { streamUrl, playSessionId, isDirectPlay, isLocalRemux } = useTVStreamUrl({
    itemId, mediaSourceId, container: mediaSource?.Container, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds,
    forceTranscode, isTranscodingQuality: quality.isTranscodingQuality,
    maxBitrate: quality.maxBitrate, maxHeight: quality.maxHeight,
    isDirectPlay: requestedDirectPlay,
    reloadNonce,
  });

  // Synchronisation des refs miroir lues par les handlers/callbacks (cf. plus haut).
  isDirectPlayRef.current = isDirectPlay;
  isLocalRemuxRef.current = isLocalRemux;

  // Récupération de stall remux (-11866) : lazy pendant une pause (session
  // marquée morte, image figée conservée, reprise pilotée par useTVRemuxPause),
  // reload immédiat À LA POSITION COURANTE en lecture.
  const { onRemuxStall } = useTVRemuxStallRecovery({
    pausedStateRef, positionRef, softReloadRef, reloadHoldRef, deadSessionRef,
    setReloadFrameSec, setReloadNonce, setStartTicks, holdForReload, notifySeekRef, resetLoadedRef,
  });

  // Vraie pause permanente du remux on-device (anti -11866) : pousse l'état de pause au natif (manifeste de
  // pause VOD/keepalive) et orchestre la reprise (nouvelle session à P). No-op hors remux local.
  useTVRemuxPause({
    paused, isLocalRemux, positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, setStartTicks, holdForReload,
    notifySeekRef, resetLoadedRef, deadSessionRef, capturePauseFrame,
  });

  // Capture de pause consommée : invalidée dès que la lecture reprend réellement
  // (hors reload en cours, où l'image figée sert encore de masque).
  useEffect(() => {
    if (!paused && reloadFrameSec == null) setPauseFrameUri(null);
  }, [paused, reloadFrameSec]);

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  // Refs stables pour les listeners avec [] deps (pausedStateRef : remonté en
  // tête de composant, consommé dès useTVRemuxStallRecovery)
  const reportSeekRef = useRef(reportSeek);
  reportSeekRef.current = reportSeek;
  const reportStartRef = useRef(reportStart);
  reportStartRef.current = reportStart;

  const trackRes = useTVTrackResolution({
    streams, item, ancestors,
    positionRef, setAudioIndex, setSubtitleIndex, setStartTicks,
    // Préférence audio ≠ défaut : en transcode (tvOS), forcer un reload du flux
    // pour que la piste préférée soit réellement active (pas seulement en UI).
    // Préférence audio ≠ défaut → reload : transcode (audio non commutable) ET REMUX local (audio muxé →
    // re-remux). Sans `|| isLocalRemux`, le remux gardait l'audio par défaut (UI anglais ≠ son français).
    onAudioReloadNeeded: () => {
      if (!isDirectPlayRef.current || isLocalRemuxRef.current) {
        softReloadRef.current = true; setReloadFrameSec(positionRef.current); setReloadNonce((n) => n + 1);
      }
    },
  });
  resetPrefsAppliedRef.current = trackRes.resetPrefsApplied;

  // NOTE reprise : la timeline du player est absolue (direct play ET HLS
  // transcodé — StartTimeTicks est retiré des URLs HLS par buildHlsUrl).
  // La reprise/restauration de position se fait par SEEK client au onLoad
  // (useTVPlayerEventHandlers.handleLoad), comme sur le web/desktop.

  const lifecycle = useTVPlaybackLifecycle({
    itemId, seriesId: item?.SeriesId, navigation,
    reportStop, positionRef, pausedStateRef, reportSeekRef, reportStartRef,
    onBackground: () => setPaused(true),
  });

  const mpvTracks = useTVMpvTracks({
    playerRef, streams, audioIndex, subtitleIndex,
    isDirectPlay, itemId, mediaSourceId,
  });
  mpvTrackMapRef.current = mpvTracks.mpvTrackMap;

  const { handleSeek } = useTVSeekControl({
    jellyfinDuration, playerRef, paused,
    displayTimeRef, positionRef, lastDisplayUpdate, lastProgressTime,
    reportSeek, setDisplayTime, notifySeekRef, checkTriggerRef,
  });

  // SEEK tvOS REMUX : seek natif dans la fenêtre dispo, re-remux nouvelle session (av_seek_frame)
  // hors fenêtre. Isolé du cerveau partagé useTVPlayerControls (Android inchangé). Cf. hook.
  const seekOrRemux = useTVRemuxSeek({
    jellyfinDuration, handleSeek, isLocalRemuxRef, sessionStartRef, positionRef, displayTimeRef,
    lastDisplayUpdate, lastProgressTime, pausedStateRef, softReloadRef, setReloadFrameSec,
    setDisplayTime, notifySeekRef, reportSeek, setStartTicks, holdForReload, deadSessionRef,
  });

  // Navigation inter-épisodes : auto-play (générique → suivant), skip
  // intro/crédits + handlers de transport liés (précédent/suivant/play-pause).
  // Enveloppe useAutoPlay + useEpisodeNavigation + useIntroSkipper ; consomme
  // handleSeek (double-clic Précédent = épisode précédent, sinon retour à 0).
  const {
    autoPlay, skipSegments, previousEpisode,
    navigateToEpisode, handlePrevEpisode, handleNextEpisode, handlePlayPause,
  } = useTVEpisodeNav({
    item, jellyfinDuration, reportStop, queryClient, itemId, navigation,
    handleSeek: seekOrRemux, setPaused,
  });

  const controls = useTVPlayerControls({
    paused, jellyfinDuration: jellyfinDuration ?? 0,
    onSeek: seekOrRemux,
    onBack: () => {
      if (autoPlay.countdown !== null) { autoPlay.cancelAutoPlay(); return; }
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
    // Écran de fin plein écran (eof) = panneau : neutralise pan/scrub/play-pause
    // du lecteur ET son Back (useTVEventHandler global tvOS, non-LIFO) — seul le
    // useTVRemote de l'écran de fin traite Retour (= Ignorer).
    panelOpen: showSettings || showEpisodes || autoPlay.source === "eof",
  });

  // L'OSD réapparaît (OK ou direction sur le fond) → focus sur le dernier
  // bouton de transport utilisé (sinon le focus reste sur le fond invisible).
  const prevOverlayVisibleRef = useRef(true);
  useEffect(() => {
    if (controls.overlayVisible && !prevOverlayVisibleRef.current) bumpOsdFocus();
    prevOverlayVisibleRef.current = controls.overlayVisible;
  }, [controls.overlayVisible, bumpOsdFocus]);

  // Vignettes de prévisualisation (Jellyfin Trickplay) pour le mode scrub
  const trickplay = useTVTrickplay(item, mediaSource?.Id);

  // Sous-titres : pistes texte natives + sélection native ExoPlayer (Android,
  // sans re-prepare) + overlay JS (Android MPV/transcode, remux local tvOS) +
  // synchro d'affichage de la barre à la réapparition de l'OSD. Le gating de
  // subtitleIndex (tvOS natif → -1) est conservé tel quel dans le hook.
  const { subtitleText, textTracks } = useTVSubtitleSync({
    itemId, mediaSourceId: mediaSource?.Id, streams,
    useExoPlayer, subtitleIndex, isLocalRemux,
    exoRef, subtitleTrackMap: mpvTracks.subtitleTrackMap,
    displayTimeRef, bufferedTimeRef, lastProgressTime, lastDisplayUpdate, pausedStateRef,
    overlayVisible: controls.overlayVisible, setDisplayTime, setBufferedTime,
  });

  const events = useTVPlayerEventHandlers({
    playerRef, paused,
    positionRef, pausedStateRef, displayTimeRef, bufferedTimeRef,
    lastDisplayUpdate, lastProgressTime, controlsCurrentTimeRef: controls.currentTimeRef,
    setDisplayTime, setBufferedTime, setIsLoading,
    reportStart, updatePosition,
    // L'écran de chargement reste affiché jusqu'à la première position réelle
    onPlaybackActive: () => setHasStarted(true),
    autoPlay, handleFinished: lifecycle.handleFinished,
  });
  const { handleLoad, handleProgress, handleEnd } = events;
  notifySeekRef.current = events.notifySeek;
  checkTriggerRef.current = events.checkTriggerRef.current;
  resetLoadedRef.current = events.resetLoaded;

  // À chaque (re)chargement de source : réafficher l'écran de chargement
  // jusqu'à la première position réelle du nouveau flux (un changement de
  // piste/qualité en transcode recharge l'URL — sans ça, on voit l'ancien
  // flux continuer puis sauter), et armer la fenêtre post-seek sur la
  // position de départ — les premiers progress parasites (~0) sont ignorés,
  // la barre n'affiche jamais 0:00.
  // NB : effet conservé INLINE (et non dans useTVReloadState) car il se situe au
  // point de couture post-useTVStreamUrl, alors que l'état de reload est produit
  // AVANT le stream (qui consomme forceTranscode/startTicks/reloadNonce).
  useEffect(() => {
    if (!streamUrl) return;
    resetLoadedRef.current();
    // Reload DOUX (changement de piste/qualité, même contenu) : garder la
    // dernière image + spinner discret (hasStarted reste vrai) au lieu de
    // l'écran de chargement plein écran. Reload DUR (nouveau contenu) : écran
    // de chargement complet.
    if (softReloadRef.current) {
      softReloadRef.current = false;
    } else {
      setHasStarted(false);
    }
    setIsLoading(true);
    // Timeout = filet de sécurité uniquement : la sortie réelle est
    // ÉVÉNEMENTIELLE (premier progress après le load du nouveau flux).
    if (startSeconds > 1) notifySeekRef.current(startSeconds, 8000, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  const { handleQualityChange } = useTVQualityChange({
    setQualityKey: quality.setQualityKey, positionRef, captureReloadTicks,
    softReloadRef, setReloadFrameSec,
  });

  // Erreur de codec en direct play → bascule transcode forcé (reprise à la
  // position courante) ; stall remux → useTVRemuxStallRecovery (lazy en pause,
  // reload à la position courante en lecture) ; sinon surfacée.
  const { handleError } = useTVErrorHandler({
    forceTranscode, captureReloadTicks, setVideoError, setForceTranscode, onRemuxStall, pausedStateRef,
  });

  const audioTracksList = useMemo(() =>
    streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);
  const subtitleTracksList = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);

  // Pont vers la route MODALE Réglages/Qualité : publie en continu les props du
  // sélecteur (pistes async, sélection live) + resync de l'état panneau à la
  // fermeture. Fournit handleCloseSettings (utilisé dans le rendu plus bas).
  const { handleCloseSettings } = useTVSettingsBridge({
    audioTracksList, subtitleTracksList, audioIndex, subtitleIndex,
    qualityKey: quality.qualityKey, sourceQuality,
    handleAudioChange, handleSubtitleChange, handleQualityChange,
    showOverlay: controls.showOverlay, setShowSettings, showSettingsRef, bumpOsdFocus,
  });

  const { handleVideoSize, playerStyle } = useTVPlayerStyle();

  const displayDuration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : 0;
  const autoPlayActive = autoPlay.countdown !== null;
  // Item/URL pas encore résolus : même écran de chargement contextualisé
  // que la phase initiale du player (parité PlayerLoadingScreen web).
  // `!item` aussi : monter le player avant l'item ferait rater le seek de
  // reprise du premier onLoad (UserData indisponible).
  if (!item || !streamUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TVPlayerLoadingScreen item={item ?? placeholderItem} />
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
      useExoPlayer={useExoPlayer} isLocalRemux={isLocalRemux} isDirectPlay={isDirectPlay} exoRef={exoRef} mpvRef={mpvRef}
      backgroundRef={backgroundRef} playerStyle={playerStyle}
      audioTracksList={audioTracksList} subtitleTracksList={subtitleTracksList}
      audioIndex={audioIndex} subtitleIndex={subtitleIndex}
      qualityKey={quality.qualityKey} sourceQuality={sourceQuality}
      skipSegments={skipSegments} autoPlay={autoPlay} controls={controls}
      onLoad={handleLoad} onProgress={handleProgress} onEnd={handleEnd}
      onError={handleError} onTracks={mpvTracks.handleTracks} onVideoSize={handleVideoSize}
      onPlayPause={handlePlayPause} onSeek={seekOrRemux}
      onBack={lifecycle.invalidateAndGoBack}
      onToggleSettings={() => {
        // Ouvre la MODALE Réglages/Qualité (cf. PlayerSettingsScreen). showSettings
        // reste vrai pendant l'ouverture pour panelOpen (anti auto-hide OSD / scrub).
        setShowSettings(true);
        showSettingsRef.current = true;
        controls.showOverlay();
        navigation.navigate("PlayerSettings");
      }}
      onSelectAudio={handleAudioChange} onSelectSubtitle={handleSubtitleChange}
      onSelectQuality={handleQualityChange}
      onCloseSettings={handleCloseSettings}
      onPrevEpisode={handlePrevEpisode} onNextEpisode={handleNextEpisode}
      trickplay={trickplay} reloadFrameSec={reloadFrameSec} pauseFrameUri={pauseFrameUri} osdFocusSignal={osdFocusSignal}
      subtitleText={subtitleText} textTracks={textTracks}
      showEpisodes={showEpisodes}
      onToggleEpisodes={() => { setShowEpisodes((v) => !v); controls.showOverlay(); }}
      onCloseEpisodes={() => { setShowEpisodes(false); controls.showOverlay(); bumpOsdFocus(); }}
      onSelectEpisode={(ep) => { setShowEpisodes(false); navigateToEpisode(ep.Id); }}
    />
  );
}
