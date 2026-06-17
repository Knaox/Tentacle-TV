import type { ElementRef } from "react";
import { View, Text, TouchableOpacity, Platform, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem, SegmentTimestamps, QualityKey, SourceQuality } from "@tentacle-tv/shared";
import { MemoizedPlayer } from "./MemoizedPlayer";
import { TVPlayerOverlay } from "../TVPlayerOverlay";
import { TVTrackSelector } from "../TVTrackSelector";
import { TVSkipSegmentButton } from "../TVSkipSegmentButton";
import { TVAutoPlayOverlay } from "../TVAutoPlayOverlay";
import { TVPlayerEpisodePanel } from "./TVPlayerEpisodePanel";
import { TVPlayerLoadingScreen, TVBufferingSpinner } from "./TVPlayerLoadingScreen";
import { TVSkipBadge } from "./TVSkipBadge";
import { TVSubtitleOverlay } from "./TVSubtitleOverlay";
import type { MPVPlayerHandle, MpvTrack } from "./MPVPlayer";
import type { ExoTextTrack } from "./ExoPlayer";
import type { UseTVTrickplayResult } from "../../hooks/useTVTrickplay";
import { useTVFocusGrab } from "../../hooks/useTVFocusGrab";

interface AutoPlayCtx {
  countdown: number | null;
  nextEpisode: MediaItem | null;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  navigateToNextEpisode: () => void;
  startAutoPlay: () => void;
  cancelAutoPlay: () => void;
}

interface ControlsCtx {
  overlayVisible: boolean;
  scrubbing: boolean;
  scrubPosition: number;
  /** Badge éphémère « +30s / −10s » après un skip OSD caché */
  skipFlash: { delta: number; id: number } | null;
  speedLabel?: string | null;
  showOverlay: () => void;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
  /** En mode scrub, OK sur un bouton valide le scrub au lieu d'agir */
  guardScrub: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
}

export interface TVPlayerViewProps {
  // Item & state
  item?: MediaItem | null;
  streamUrl: string;
  paused: boolean;
  isLoading: boolean;
  /** Lecture déjà démarrée — distingue chargement initial / rebuffering */
  hasStarted: boolean;
  videoError: string | null;
  displayTime: number;
  bufferedTime: number;
  displayDuration: number;
  showSettings: boolean;
  autoPlayActive: boolean;
  hasPreviousEpisode: boolean;

  // Player refs
  useExoPlayer: boolean;
  exoRef: React.Ref<MPVPlayerHandle>;
  mpvRef: React.Ref<MPVPlayerHandle>;
  backgroundRef: React.Ref<ElementRef<typeof TouchableOpacity>>;
  playerStyle: ViewStyle;

  // Tracks / qualité
  audioTracksList: { index: number; label: string }[];
  subtitleTracksList: { index: number; label: string }[];
  audioIndex: number;
  subtitleIndex: number;
  qualityKey: QualityKey;
  sourceQuality?: SourceQuality;
  skipSegments: { intro: SegmentTimestamps | null; credits: SegmentTimestamps | null };
  autoPlay: AutoPlayCtx;
  controls: ControlsCtx;

  // Handlers
  onLoad: (duration: number) => void;
  onProgress: (currentTime: number, buffered: number) => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onTracks: (tracks: MpvTrack[]) => void;
  onVideoSize: (width: number, height: number, pixelRatio: number) => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onToggleSettings: () => void;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityKey) => void;
  onCloseSettings: () => void;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  /** Vignettes de prévisualisation pendant le scrub */
  trickplay?: UseTVTrickplayResult;
  /** Incrémenter pour refocus le dernier bouton OSD utilisé */
  osdFocusSignal?: number;
  /** Cue de sous-titres texte rendue en JS (useTVSubtitles) — MPV/transcode */
  subtitleText?: string | null;
  /** Pistes texte VTT pour le rendu natif ExoPlayer (direct play) */
  textTracks?: ExoTextTrack[];
  /** Panneau Saisons & épisodes (séries) */
  showEpisodes?: boolean;
  onToggleEpisodes?: () => void;
  onCloseEpisodes?: () => void;
  onSelectEpisode?: (episode: MediaItem) => void;
}

export function TVPlayerView({
  item, streamUrl, paused, isLoading, hasStarted, videoError, displayTime, bufferedTime,
  displayDuration, showSettings, autoPlayActive, hasPreviousEpisode,
  useExoPlayer, exoRef, mpvRef, backgroundRef, playerStyle,
  audioTracksList, subtitleTracksList, audioIndex, subtitleIndex,
  qualityKey, sourceQuality, skipSegments, autoPlay, controls,
  onLoad, onProgress, onEnd, onError, onTracks, onVideoSize,
  onPlayPause, onSeek, onBack, onToggleSettings,
  onSelectAudio, onSelectSubtitle, onSelectQuality, onCloseSettings,
  onPrevEpisode, onNextEpisode, trickplay, osdFocusSignal, subtitleText, textTracks,
  showEpisodes, onToggleEpisodes, onCloseEpisodes, onSelectEpisode,
}: TVPlayerViewProps) {
  const { t } = useTranslation("player");

  // Le fond n'est focusable que quand l'OSD est CACHÉ (et aucun panneau) :
  // OK/direction sur le fond → showOverlay, puis le focus passe aux boutons.
  const overlayShown = controls.overlayVisible || paused;
  const panelOpen = showSettings || autoPlayActive || !!showEpisodes;
  const backgroundFocusable = !overlayShown && !panelOpen;

  // Un segment skip (intro/générique) dans sa plage garde le focus (cf. skip
  // button), sinon c'est le fond qui doit le récupérer.
  const inSeg = (s?: { start: number; end: number } | null) =>
    !!s && displayTime >= s.start && displayTime < s.end - 1;
  const skipActive = inSeg(skipSegments.intro) || inSeg(skipSegments.credits);

  // tvOS : dès que l'OSD se cache (et qu'aucun panneau / skip n'est actif),
  // ramener le focus sur le fond pour que le D-pad continue d'émettre ses events
  // et puisse rallumer l'OSD (parité avec useFocusRecovery côté Android).
  useTVFocusGrab(
    backgroundRef as unknown as React.RefObject<unknown>,
    backgroundFocusable && !skipActive,
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <MemoizedPlayer
        useExoPlayer={useExoPlayer} exoRef={exoRef} mpvRef={mpvRef}
        source={streamUrl} paused={paused} playerStyle={playerStyle}
        textTracks={textTracks} subtitleIndex={subtitleIndex}
        onLoad={onLoad} onProgress={onProgress} onEnd={onEnd}
        onError={onError} onTracks={onTracks} onVideoSize={onVideoSize}
      />
      <TouchableOpacity
        ref={backgroundRef} activeOpacity={1}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={controls.showOverlay}
        // @ts-ignore react-native-tvos
        hasTVPreferredFocus={backgroundFocusable}
        focusable={backgroundFocusable}
        accessible={backgroundFocusable}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
      >
        <View style={{ flex: 1 }} />
      </TouchableOpacity>
      {/* Sous-titres : Android = rendu NATIF par le subtitleView ExoPlayer en
          direct play, overlay JS pour MPV/transcode. tvOS (AVPlayer) = NATIF
          partout (sideload VTT) → pas d'overlay JS. */}
      {!useExoPlayer && Platform.OS !== "ios" && (
        <TVSubtitleOverlay text={subtitleText ?? null} osdVisible={overlayShown} />
      )}
      {/* Badge « +30s / −10s » après un double-clic ←/→ (OSD caché) */}
      <TVSkipBadge flash={controls.skipFlash} />
      {/* Chargement initial OU rechargement de flux (piste/qualité) : écran
          contextualisé couvrant jusqu'à la première position réelle (parité
          PlayerLoadingScreen web) ; rebuffering : spinner discret */}
      {!hasStarted && !videoError && <TVPlayerLoadingScreen item={item} />}
      {isLoading && hasStarted && <TVBufferingSpinner />}
      {videoError && (
        <View style={{
          position: "absolute", top: 60, left: 40, right: 40,
          backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 8, padding: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{t("playbackError")}</Text>
          <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{videoError}</Text>
        </View>
      )}
      <TVPlayerOverlay
        title={item?.Name ?? ""}
        currentTime={displayTime}
        bufferedTime={bufferedTime}
        duration={displayDuration} paused={paused}
        visible={controls.overlayVisible && !autoPlayActive}
        speedLabel={controls.speedLabel}
        scrubbing={controls.scrubbing} scrubPosition={controls.scrubPosition}
        trickplay={trickplay} focusSignal={osdFocusSignal}
        onPlayPause={controls.guardScrub(() => { onPlayPause(); controls.showOverlay(); })}
        onSkipBack={controls.guardScrub(() => { controls.handleSkipBack(); controls.showOverlay(); })}
        onSkipForward={controls.guardScrub(() => { controls.handleSkipForward(); controls.showOverlay(); })}
        onBack={onBack}
        onSettings={controls.guardScrub(onToggleSettings)}
        onNextEpisode={onNextEpisode ? controls.guardScrub(onNextEpisode) : undefined}
        onPrevEpisode={onPrevEpisode ? controls.guardScrub(onPrevEpisode) : undefined}
        hasNextEpisode={!!autoPlay.nextEpisode} hasPreviousEpisode={hasPreviousEpisode}
        onEpisodes={item?.SeriesId && onToggleEpisodes ? controls.guardScrub(onToggleEpisodes) : undefined}
      />
      {!autoPlayActive && (
        <>
          <TVSkipSegmentButton type="intro" segment={skipSegments.intro}
            currentTime={displayTime} onSkip={() => onSeek(skipSegments.intro!.end)}
            overlayVisible={controls.overlayVisible} showSettings={showSettings}
            showEpisodes={!!showEpisodes} />
          {/* Générique : avec un épisode suivant, le bouton devient
              « Épisode suivant » et lance la carte À suivre (comme le web). */}
          <TVSkipSegmentButton type="credits" segment={skipSegments.credits}
            currentTime={displayTime}
            labelOverride={autoPlay.nextEpisode ? t("nextEpisodeLabel", { defaultValue: "Épisode suivant" }) : undefined}
            onSkip={() => {
              if (autoPlay.nextEpisode) autoPlay.startAutoPlay();
              else onSeek(skipSegments.credits!.end);
            }}
            overlayVisible={controls.overlayVisible} showSettings={showSettings}
            showEpisodes={!!showEpisodes} />
        </>
      )}
      {showEpisodes && item?.SeriesId && onSelectEpisode && onCloseEpisodes && (
        <TVPlayerEpisodePanel
          seriesId={item.SeriesId}
          currentEpisode={item}
          onSelectEpisode={onSelectEpisode}
          onClose={onCloseEpisodes}
        />
      )}
      {showSettings && (
        <TVTrackSelector
          audioTracks={audioTracksList} subtitleTracks={subtitleTracksList}
          selectedAudio={audioIndex} selectedSubtitle={subtitleIndex}
          qualityKey={qualityKey} sourceQuality={sourceQuality}
          onSelectAudio={onSelectAudio} onSelectSubtitle={onSelectSubtitle}
          onSelectQuality={onSelectQuality}
          onClose={onCloseSettings}
          onInteraction={controls.showOverlay}
        />
      )}
      {autoPlayActive && (
        <TVAutoPlayOverlay
          countdown={autoPlay.countdown!} episodeTitle={autoPlay.nextEpisodeTitle}
          episodeLabel={autoPlay.nextEpisode?.ParentIndexNumber != null && autoPlay.nextEpisode?.IndexNumber != null
            ? `S${String(autoPlay.nextEpisode.ParentIndexNumber).padStart(2, "0")}E${String(autoPlay.nextEpisode.IndexNumber).padStart(2, "0")}`
            : undefined}
          episodeDescription={autoPlay.nextEpisodeDescription}
          episodeImageUrl={autoPlay.nextEpisodeImageUrl}
          onPlayNow={autoPlay.navigateToNextEpisode} onDismiss={autoPlay.cancelAutoPlay}
        />
      )}
    </View>
  );
}
