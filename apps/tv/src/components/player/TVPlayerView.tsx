import type { ElementRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem, SegmentTimestamps, QualityKey, SourceQuality } from "@tentacle-tv/shared";
import { MemoizedPlayer } from "./MemoizedPlayer";
import { TVPlayerOverlay } from "../TVPlayerOverlay";
import { TVTrackSelector } from "../TVTrackSelector";
import { TVSkipSegmentButton } from "../TVSkipSegmentButton";
import { TVAutoPlayOverlay } from "../TVAutoPlayOverlay";
import type { MPVPlayerHandle, MpvTrack } from "./MPVPlayer";
import { Colors } from "../../theme/colors";

interface AutoPlayCtx {
  countdown: number | null;
  nextEpisode: MediaItem | null;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  navigateToNextEpisode: () => void;
  cancelAutoPlay: () => void;
}

interface ControlsCtx {
  overlayVisible: boolean;
  scrubbing: boolean;
  scrubPosition: number;
  speedLabel?: string | null;
  seekActive: boolean;
  showOverlay: () => void;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
}

export interface TVPlayerViewProps {
  // Item & state
  item?: MediaItem | null;
  streamUrl: string;
  paused: boolean;
  isLoading: boolean;
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
  onSeekBarFocus: () => void;
  onSeekBarBlur: () => void;
}

export function TVPlayerView({
  item, streamUrl, paused, isLoading, videoError, displayTime, bufferedTime,
  displayDuration, showSettings, autoPlayActive, hasPreviousEpisode,
  useExoPlayer, exoRef, mpvRef, backgroundRef, playerStyle,
  audioTracksList, subtitleTracksList, audioIndex, subtitleIndex,
  qualityKey, sourceQuality, skipSegments, autoPlay, controls,
  onLoad, onProgress, onEnd, onError, onTracks, onVideoSize,
  onPlayPause, onSeek, onBack, onToggleSettings,
  onSelectAudio, onSelectSubtitle, onSelectQuality, onCloseSettings,
  onPrevEpisode, onNextEpisode, onSeekBarFocus, onSeekBarBlur,
}: TVPlayerViewProps) {
  const { t } = useTranslation("player");

  return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <MemoizedPlayer
        useExoPlayer={useExoPlayer} exoRef={exoRef} mpvRef={mpvRef}
        source={streamUrl} paused={paused} playerStyle={playerStyle}
        onLoad={onLoad} onProgress={onProgress} onEnd={onEnd}
        onError={onError} onTracks={onTracks} onVideoSize={onVideoSize}
      />
      <TouchableOpacity
        ref={backgroundRef} activeOpacity={1}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={controls.showOverlay}
        // @ts-ignore react-native-tvos
        hasTVPreferredFocus={!showSettings && !autoPlayActive}
        accessible={!showSettings && !autoPlayActive}
        importantForAccessibility={showSettings || autoPlayActive ? "no-hide-descendants" : "auto"}
      >
        <View style={{ flex: 1 }} />
      </TouchableOpacity>
      {isLoading && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: "center", alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.3)", zIndex: 50, elevation: 50,
        }} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.accentPurple} />
        </View>
      )}
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
        currentTime={controls.scrubbing ? controls.scrubPosition : displayTime}
        bufferedTime={bufferedTime}
        duration={displayDuration} paused={paused}
        visible={controls.overlayVisible && !autoPlayActive}
        speedLabel={controls.speedLabel} seekActive={controls.seekActive}
        onPlayPause={() => { onPlayPause(); controls.showOverlay(); }}
        onSkipBack={() => { controls.handleSkipBack(); controls.showOverlay(); }}
        onSkipForward={() => { controls.handleSkipForward(); controls.showOverlay(); }}
        onBack={onBack}
        onSettings={onToggleSettings}
        onSeekBarFocus={onSeekBarFocus} onSeekBarBlur={onSeekBarBlur}
        onNextEpisode={onNextEpisode} onPrevEpisode={onPrevEpisode}
        hasNextEpisode={!!autoPlay.nextEpisode} hasPreviousEpisode={hasPreviousEpisode}
      />
      {!autoPlayActive && (
        <>
          <TVSkipSegmentButton type="intro" segment={skipSegments.intro}
            currentTime={displayTime} onSkip={() => onSeek(skipSegments.intro!.end)}
            overlayVisible={controls.overlayVisible} showSettings={showSettings} />
          <TVSkipSegmentButton type="credits" segment={skipSegments.credits}
            currentTime={displayTime} onSkip={() => onSeek(skipSegments.credits!.end)}
            overlayVisible={controls.overlayVisible} showSettings={showSettings} />
        </>
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
          episodeDescription={autoPlay.nextEpisodeDescription}
          episodeImageUrl={autoPlay.nextEpisodeImageUrl}
          onPlayNow={autoPlay.navigateToNextEpisode} onDismiss={autoPlay.cancelAutoPlay}
        />
      )}
    </View>
  );
}
