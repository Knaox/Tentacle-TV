import { useState, useRef, useCallback, useEffect, useMemo, type ElementRef } from "react";
import { View, TouchableOpacity, Dimensions, Platform, type ViewStyle } from "react-native";
import { useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting, useIntroSkipper, useEpisodeNavigation } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds, extractSourceQuality } from "@tentacle-tv/shared";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreventRemove } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";
import { useAutoPlay } from "../hooks/useAutoPlay";
import { formatTrackLabel } from "../utils/playerHelpers";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";
import { TVPlayerView } from "../components/player/TVPlayerView";
import { useTVPlaybackQuality } from "../hooks/useTVPlaybackQuality";
import { useTVPlaybackLifecycle } from "../hooks/useTVPlaybackLifecycle";
import { useTVMpvTracks } from "../hooks/useTVMpvTracks";
import { useTVTrackResolution } from "../hooks/useTVTrackResolution";
import { useTVPlayerEventHandlers } from "../hooks/useTVPlayerEventHandlers";
import { useTVStreamUrl } from "../hooks/useTVStreamUrl";
import { useFocusRecovery } from "../hooks/useFocusRecovery";
import { useTVTrickplay } from "../hooks/useTVTrickplay";
import { useTVSubtitles } from "../hooks/useTVSubtitles";
import { useTVTextTracks } from "../hooks/useTVTextTracks";
import { findCachedMediaItem } from "../utils/findCachedMediaItem";
import { TVPlayerLoadingScreen } from "../components/player/TVPlayerLoadingScreen";
import { setSettingsPanelProps, setSettingsOnClosed } from "./player/playerSettingsBridge";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

const SCREEN = Dimensions.get("window");

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
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  // Reload explicite du flux en transcode (changement audio non couplé à la
  // position) — bumpé par le changement de piste audio et l'application de la
  // préférence de langue. Cf. useTVStreamUrl.ios (dep de refetch).
  const [reloadNonce, setReloadNonce] = useState(0);
  // Marque un reload « doux » (changement de piste/qualité, même contenu) : le
  // player reste monté, on n'affiche qu'un spinner discret (cf. effet streamUrl).
  const softReloadRef = useRef(false);
  // Position figée (s) affichée comme « dernière image » pendant un reload doux
  // (AVPlayer passe au noir le temps du re-buffer) — via la vignette trickplay.
  const [reloadFrameSec, setReloadFrameSec] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const showSettingsRef = useRef(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const showEpisodesRef = useRef(false);
  showEpisodesRef.current = showEpisodes;
  const [startTicks, setStartTicks] = useState(0);
  // forceTranscode SCOPÉ à l'item courant : dérivé → se réinitialise AUTOMATIQUEMENT au
  // changement de contenu (aucune course avec l'effet de reset ; pas de contamination N→N+1).
  const [ftState, setFtState] = useState<{ item: string; on: boolean }>({ item: "", on: false });
  const forceTranscode = ftState.item === itemId && ftState.on;
  const setForceTranscode = useCallback((on: boolean) => setFtState({ item: itemId, on }), [itemId]);
  const positionRef = useRef(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Premier onLoad reçu → les isLoading suivants sont du rebuffering (spinner
  // discret) et non plus le chargement initial (écran contextualisé).
  const [hasStarted, setHasStarted] = useState(false);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const lastProgressTime = useRef(Date.now());

  const quality = useTVPlaybackQuality();
  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  // ExoPlayer rend directement à la surface (pas de copie mediacodec lag-inducing comme MPV).
  // Forcé sur MPV uniquement quand un transcode est en cours.
  const useExoPlayer = !forceTranscode;
  const playerRef = useExoPlayer ? exoRef : mpvRef;

  const defaultAudio = useMemo(() =>
    streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0,
    [streams],
  );

  const resetPrefsAppliedRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (defaultAudio !== undefined) {
      setAudioIndex(defaultAudio);
      setSubtitleIndex(-1);
      setStartTicks(0);
      positionRef.current = 0;
      resetPrefsAppliedRef.current?.();
      quality.reset();
      // CRITIQUE : remettre à zéro le transcode forcé + l'erreur d'un contenu PRÉCÉDENT —
      // sinon un échec sur l'item N contamine l'item N+1 (lancé sur le mauvais lecteur, sans HDR/DV).
      setForceTranscode(false);
      setVideoError(null);
    }
  }, [itemId, defaultAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct play DEMANDÉ tant qu'aucun transcode n'est imposé (codec ou qualité user).
  // Android : c'est aussi la décision finale. tvOS : le hook .ios interroge
  // PlaybackInfo et peut renvoyer un `isDirectPlay` différent (le serveur décide).
  const requestedDirectPlay = !forceTranscode && !quality.isTranscodingQuality;
  const isDirectStream = false;

  // Position de DÉMARRAGE du player (fragment #tnt-start lu par le natif) :
  // reprise initiale (UserData, FIGÉE au premier calcul — un refetch de l'item
  // en cours de lecture ne doit pas changer l'URL) ou position courante posée
  // par un changement de piste/qualité (startTicks).
  const initialResumeSecondsRef = useRef<number | null>(null);
  if (initialResumeSecondsRef.current === null && item) {
    initialResumeSecondsRef.current = (item.UserData?.PlaybackPositionTicks ?? 0) / TICKS_PER_SECOND;
  }
  const startSeconds = startTicks > 0
    ? startTicks / TICKS_PER_SECOND
    : (initialResumeSecondsRef.current ?? 0);

  const { streamUrl, playSessionId, isDirectPlay, isLocalRemux } = useTVStreamUrl({
    itemId, mediaSourceId, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds,
    forceTranscode, isTranscodingQuality: quality.isTranscodingQuality,
    maxBitrate: quality.maxBitrate, maxHeight: quality.maxHeight,
    isDirectPlay: requestedDirectPlay,
    reloadNonce,
  });

  // Nature réelle direct/transcode (décidée par le serveur) lue dans les
  // callbacks sans en faire une dépendance.
  const isDirectPlayRef = useRef(isDirectPlay);
  isDirectPlayRef.current = isDirectPlay;

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  // Refs stables pour les listeners avec [] deps
  const pausedStateRef = useRef(paused);
  pausedStateRef.current = paused;
  const reportSeekRef = useRef(reportSeek);
  reportSeekRef.current = reportSeek;
  const reportStartRef = useRef(reportStart);
  reportStartRef.current = reportStart;
  // Rempli après useTVPlayerEventHandlers (handleSeek est défini avant)
  const notifySeekRef = useRef<(target: number, windowMs?: number, afterReload?: boolean) => void>(() => {});

  const trackRes = useTVTrackResolution({
    streams, item, ancestors,
    positionRef, setAudioIndex, setSubtitleIndex, setStartTicks,
    // Préférence audio ≠ défaut : en transcode (tvOS), forcer un reload du flux
    // pour que la piste préférée soit réellement active (pas seulement en UI).
    onAudioReloadNeeded: () => {
      if (!isDirectPlayRef.current) { softReloadRef.current = true; setReloadFrameSec(positionRef.current); setReloadNonce((n) => n + 1); }
    },
  });
  resetPrefsAppliedRef.current = trackRes.resetPrefsApplied;

  const skipSegments = useIntroSkipper(itemId, item);

  const navigateToEpisode = useCallback((episodeId: string) => {
    reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    navigation.replace("Player", { itemId: episodeId });
  }, [reportStop, queryClient, itemId, navigation]);

  const autoPlay = useAutoPlay(item, jellyfinDuration ?? 0, skipSegments.credits, navigateToEpisode);
  const { previousEpisode } = useEpisodeNavigation(item);

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

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    notifySeekRef.current(clamped);
    displayTimeRef.current = clamped;
    positionRef.current = clamped;
    setDisplayTime(clamped);
    lastDisplayUpdate.current = Date.now();
    lastProgressTime.current = Date.now();
    // Timeline absolue dans tous les modes (cf. note reprise plus haut)
    playerRef.current?.seek(clamped);
    reportSeek(clamped, paused);
    checkTriggerRef.current(clamped);
  }, [jellyfinDuration, paused, reportSeek, playerRef]);

  const prevClickTimeRef = useRef(0);
  const handlePrevEpisode = useCallback(() => {
    const now = Date.now();
    if (now - prevClickTimeRef.current < 500 && previousEpisode) {
      navigateToEpisode(previousEpisode.Id);
    } else {
      handleSeek(0);
    }
    prevClickTimeRef.current = now;
  }, [previousEpisode, navigateToEpisode, handleSeek]);

  const handleNextEpisode = useCallback(() => {
    if (autoPlay.nextEpisode) navigateToEpisode(autoPlay.nextEpisode.Id);
  }, [autoPlay.nextEpisode, navigateToEpisode]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

  // Refocus de l'OSD : à chaque incrément, l'overlay redonne le focus au
  // dernier bouton de transport utilisé (fermeture de panneau, réapparition).
  const [osdFocusSignal, setOsdFocusSignal] = useState(0);
  const bumpOsdFocus = useCallback(() => setOsdFocusSignal((s) => s + 1), []);

  // tvOS : le bouton Menu déclenche un dismiss NATIF du native-stack (qui quittait
  // l'épisode depuis un panneau in-player). `usePreventRemove` (API officielle
  // react-navigation v7) mappe sur `preventNativeDismiss` de react-native-screens
  // → tant qu'un panneau est ouvert, le dismiss natif est annulé et on referme le
  // panneau en JS. Aucun panneau ouvert → removal autorisée (sortie normale).
  // No-op de fait sur Android (le BackHandler LIFO consomme déjà l'appui).
  // NB : les Réglages/Qualité passent désormais par une route MODALE (ESC géré
  // nativement par le dismiss de la modale, sans flash) → ici on ne couvre plus
  // que le panneau Épisodes (encore en overlay).
  usePreventRemove(showEpisodes, () => {
    if (showEpisodesRef.current) {
      setShowEpisodes(false);
    }
    bumpOsdFocus();
  });

  // Filet de sécurité : si le focus se perd hors panneau, recible le fond
  useFocusRecovery(backgroundRef, !showSettings && !showEpisodes);

  const controls = useTVPlayerControls({
    paused, jellyfinDuration: jellyfinDuration ?? 0,
    onSeek: handleSeek,
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
    panelOpen: showSettings || showEpisodes,
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

  // Pistes texte VTT chargées NATIVEMENT : Android ExoPlayer (direct play) +
  // tvOS AVPlayer (sideload, direct play ET transcode). La sélection est
  // déclarative sur tvOS (prop subtitleIndex → AVPlayerSurface), impérative sur
  // Android (effet ci-dessous). Burn-in PGS exclu (géré par le serveur).
  const textTracks = useTVTextTracks({
    itemId, mediaSourceId: mediaSource?.Id, streams,
    enabled: useExoPlayer || Platform.OS === "ios",
  });

  // Sélection sous-titre native ExoPlayer (Android) sans re-prepare. Sur tvOS,
  // la sélection est déclarative (subtitleIndex passé à la surface) → on saute.
  useEffect(() => {
    if (!useExoPlayer || Platform.OS === "ios") return;
    if (subtitleIndex < 0) { exoRef.current?.setSubtitleTrack(0); return; }
    const nativeId = mpvTracks.subtitleTrackMap[subtitleIndex];
    if (nativeId != null) exoRef.current?.setSubtitleTrack(nativeId);
  }, [useExoPlayer, subtitleIndex, mpvTracks.subtitleTrackMap]);

  // Overlay JS : Android MPV/transcode UNIQUEMENT. tvOS = NATIF partout :
  //  - direct play → sideload VTT (AVPlayer) ;
  //  - transcode HLS → pistes texte du manifeste (SubtitleMethod=Hls) rendues
  //    nativement par AVPlayer, bascule instantanée.
  // Android ExoPlayer (VTT natif) et iOS → -1 (pas d'overlay JS).
  const subtitleText = useTVSubtitles({
    itemId, mediaSourceId: mediaSource?.Id,
    // tvOS NATIF (direct play sideload / manifeste HLS transcode) → -1 (pas d'overlay JS). MAIS le
    // remux local n'a PAS de piste texte dans son manifeste → overlay JS (le vrai subtitleIndex).
    subtitleIndex: (useExoPlayer || (Platform.OS === "ios" && !isLocalRemux)) ? -1 : subtitleIndex, streams,
    displayTimeRef, lastProgressTime, pausedStateRef,
  });

  useEffect(() => {
    if (controls.overlayVisible) {
      setDisplayTime(displayTimeRef.current);
      setBufferedTime(bufferedTimeRef.current);
      lastDisplayUpdate.current = Date.now();
    }
  }, [controls.overlayVisible]);

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
  const { handleLoad, handleProgress, handleEnd, checkTriggerRef } = events;
  notifySeekRef.current = events.notifySeek;
  const resetLoadedRef = useRef(events.resetLoaded);
  resetLoadedRef.current = events.resetLoaded;

  // À chaque (re)chargement de source : réafficher l'écran de chargement
  // jusqu'à la première position réelle du nouveau flux (un changement de
  // piste/qualité en transcode recharge l'URL — sans ça, on voit l'ancien
  // flux continuer puis sauter), et armer la fenêtre post-seek sur la
  // position de départ — les premiers progress parasites (~0) sont ignorés,
  // la barre n'affiche jamais 0:00.
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

  // Image figée du reload doux : la retirer dès que le nouveau flux rend
  // (première position réelle → isLoading repasse à false).
  useEffect(() => {
    if (!isLoading && reloadFrameSec !== null) setReloadFrameSec(null);
  }, [isLoading, reloadFrameSec]);

  // Position de redémarrage d'un reload de flux (piste/qualité/transcode) :
  // reculée de 3s — un seek dans un transcode HLS atterrit à la granularité
  // des segments (jusqu'à quelques secondes EN AVANT de la cible), et
  // réentendre la dernière phrase redonne le contexte après un changement.
  const captureReloadTicks = useCallback(() => {
    if (positionRef.current > 0) {
      setStartTicks(Math.floor(Math.max(0, positionRef.current - 3) * TICKS_PER_SECOND));
    }
  }, []);

  const handleAudioChange = useCallback((newIndex: number) => {
    // Direct play ET remux (TOUTES les pistes audio muxées) → bascule NATIVE AVPlayer, AUCUN reload.
    if (isDirectPlay) {
      const mpvId = mpvTracks.mpvTrackMap[newIndex];
      if (mpvId != null) playerRef.current?.setAudioTrack(mpvId);
      setAudioIndex(newIndex);
    } else {
      softReloadRef.current = true; setReloadFrameSec(positionRef.current); // re-buffer discret (transcode)
      captureReloadTicks();
      setReloadNonce((n) => n + 1);
      setAudioIndex(newIndex);
    }
  }, [isDirectPlay, mpvTracks.mpvTrackMap, playerRef, captureReloadTicks]);

  const handleSubtitleChange = useCallback((newIndex: number) => {
    // Sur le remux, le TEXTE n'est PAS burn-in (overlay JS) ; seules les IMAGES (PGS/VOBSUB) le sont.
    const isBurnIn = (idx: number) => idx >= 0
      && isBurnInSubtitleCodec(streams.find((s) => s.Type === "Subtitle" && s.Index === idx)?.Codec, isLocalRemux);
    const needsBurnIn = isBurnIn(newIndex);
    const prevBurnIn = isBurnIn(subtitleIndex);
    if (!needsBurnIn && !prevBurnIn) {
      // Sous-titres TEXTE : sélection NATIVE (sideload AVPlayer en direct play,
      // piste du manifeste HLS en transcode) ou overlay JS sur Android MPV —
      // AUCUN rechargement du player, bascule instantanée.
      setSubtitleIndex(newIndex);
      return;
    }
    // Activation/désactivation d'un burn-in PGS/VOBSUB : l'URL est reconstruite
    // → mémoriser la position courante (le natif redémarre le flux à cette
    // position via le fragment #tnt-start).
    softReloadRef.current = true; setReloadFrameSec(positionRef.current);
    captureReloadTicks();
    setSubtitleIndex(newIndex);
    if (needsBurnIn && isDirectPlay) setForceTranscode(true);
  }, [isDirectPlay, isLocalRemux, streams, subtitleIndex, captureReloadTicks]);

  const handleQualityChange = useCallback((key: typeof quality.qualityKey) => {
    softReloadRef.current = true; setReloadFrameSec(positionRef.current);
    captureReloadTicks();
    quality.setQualityKey(key);
  }, [quality, captureReloadTicks]);

  const handleError = useCallback((error: string) => {
    const isCodecError = error.includes("DECODING_FAILED") || error.includes("EXCEEDS_CAPABILITIES")
      || error.includes("codec") || error.includes("Could not open");
    if (isCodecError && !forceTranscode) {
      // Bascule transcode en cours de lecture : reprendre à la position
      // courante (avant : repartait à zéro).
      captureReloadTicks();
      setVideoError(null);
      setForceTranscode(true);
      return;
    }
    setVideoError(error);
  }, [forceTranscode, captureReloadTicks]);

  const audioTracksList = useMemo(() =>
    streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);
  const subtitleTracksList = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);

  // Réglages/Qualité = route MODALE (cf. PlayerSettingsScreen) : on PUBLIE en
  // continu les props du sélecteur au bridge (les pistes chargent en async, la
  // sélection change) pour que la modale les lise en live.
  useEffect(() => {
    setSettingsPanelProps({
      audioTracks: audioTracksList,
      subtitleTracks: subtitleTracksList,
      selectedAudio: audioIndex,
      selectedSubtitle: subtitleIndex,
      qualityKey: quality.qualityKey,
      sourceQuality,
      onSelectAudio: handleAudioChange,
      onSelectSubtitle: handleSubtitleChange,
      onSelectQuality: handleQualityChange,
      onClose: () => {},        // remplacé par la route (navigation.goBack)
      onInteraction: controls.showOverlay,
    });
    return () => setSettingsPanelProps(null);
  }, [audioTracksList, subtitleTracksList, audioIndex, subtitleIndex, quality.qualityKey,
    sourceQuality, handleAudioChange, handleSubtitleChange, handleQualityChange, controls.showOverlay]);

  // Fermeture de la modale (ESC natif OU bouton Fermer → démontage de la route)
  // → resynchronise l'état panneau du Player + redonne le focus à l'OSD.
  useEffect(() => {
    setSettingsOnClosed(() => {
      setShowSettings(false);
      showSettingsRef.current = false;
      bumpOsdFocus();
    });
    return () => setSettingsOnClosed(null);
  }, [bumpOsdFocus]);

  const handleVideoSize = useCallback((width: number, height: number, pixelRatio: number) => {
    if (width > 0 && height > 0) setVideoAspect((width / height) * pixelRatio);
  }, []);

  const playerStyle = useMemo<ViewStyle>(() => {
    if (!videoAspect) return { width: SCREEN.width, height: SCREEN.height };
    const screenAspect = SCREEN.width / SCREEN.height;
    if (videoAspect > screenAspect) {
      return { width: SCREEN.width, height: Math.round(SCREEN.width / videoAspect) };
    }
    return { width: Math.round(SCREEN.height * videoAspect), height: SCREEN.height };
  }, [videoAspect]);

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

  const handleCloseSettings = () => {
    setShowSettings(false);
    showSettingsRef.current = false;
    controls.showOverlay();
    bumpOsdFocus();
  };

  return (
    <TVPlayerView
      item={item} streamUrl={streamUrl} paused={paused} isLoading={isLoading}
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
      onPlayPause={handlePlayPause} onSeek={handleSeek}
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
      trickplay={trickplay} reloadFrameSec={reloadFrameSec} osdFocusSignal={osdFocusSignal}
      subtitleText={subtitleText} textTracks={textTracks}
      showEpisodes={showEpisodes}
      onToggleEpisodes={() => { setShowEpisodes((v) => !v); controls.showOverlay(); }}
      onCloseEpisodes={() => { setShowEpisodes(false); controls.showOverlay(); bumpOsdFocus(); }}
      onSelectEpisode={(ep) => { setShowEpisodes(false); navigateToEpisode(ep.Id); }}
    />
  );
}
