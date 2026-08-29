import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, Pressable, Animated, Platform, useWindowDimensions } from "react-native";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import { ArrowLeft, Captions, Settings, List } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MediaItem } from "@tentacle-tv/shared";
import { extractSourceQuality } from "@tentacle-tv/shared";
import { type QualityKey, type QualityPreset } from "../hooks/usePlayerPlayback";
import type { PlaybackOverlayResult } from "@tentacle-tv/api-client";
import { PlayerSeekBar } from "./player/PlayerSeekBar";
import { CenterControls } from "./player/CenterControls";
import { SkipIndicator } from "./player/SkipIndicator";
import { PlayerSettingsMenus } from "./player/PlayerSettingsMenus";
import { PlaybackOverlayMobile } from "./player/PlaybackOverlayMobile";
import { PlayerEpisodePicker } from "./player/PlayerEpisodePicker";

// AirPlay button — iOS only (native AVRoutePickerView)
const AirPlaySection = Platform.OS === "ios"
  ? require("./player/AirPlayButton").AirPlaySection
  : () => null;

interface Track { index: number; label: string }

interface Props {
  title: string;
  currentTime: number;
  duration: number;
  bufferedTime?: number;
  paused: boolean;
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  qualityKey: QualityKey;
  /** Paliers calculés d'après la source (cf. buildQualityLadder). */
  qualityPresets: readonly QualityPreset[];
  /** L'arbitre partagé : ce qu'il faut afficher, et de quoi y répondre. */
  playback: PlaybackOverlayResult;
  nextEpisode?: MediaItem | null;
  previousEpisode?: MediaItem | null;
  /** Current item — passed to the seekbar so it can fetch trickplay tiles. */
  item?: MediaItem;
  mediaSourceId?: string;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityKey) => void;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  visible: boolean;
  onToggle: () => void;
}

export function MobilePlayerOverlay({
  title, currentTime, duration, bufferedTime, paused,
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle, qualityKey, qualityPresets,
  playback, nextEpisode, previousEpisode,
  item, mediaSourceId,
  onPlayPause, onSeek, onBack,
  onSelectAudio, onSelectSubtitle, onSelectQuality,
  onNextEpisode, onPreviousEpisode,
  visible, onToggle,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Contrôles agrandis sur grand écran (player iPad) — téléphone inchangé (ui = 1).
  const isTablet = Math.min(screenW, screenH) >= TABLET_MIN_WIDTH;
  const ui = isTablet ? 1.4 : 1;
  const playSize = Math.min(isTablet ? 92 : 60, Math.round(screenH * 0.08));
  const centerGap = Math.min(isTablet ? 76 : 36, Math.round(screenW * 0.05));
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Indicateur « +30 / −10 » au tap des boutons de saut (même visuel que le
  // double-tap des gestes)
  const [skipSide, setSkipSide] = useState<"left" | "right" | null>(null);
  const skipFadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashSkip = useCallback((side: "left" | "right") => {
    setSkipSide(side);
    if (skipFadeTimer.current) clearTimeout(skipFadeTimer.current);
    skipFadeTimer.current = setTimeout(() => setSkipSide(null), 700);
  }, []);
  useEffect(() => () => { if (skipFadeTimer.current) clearTimeout(skipFadeTimer.current); }, []);

  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!paused) {
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onToggle());
      }, 4000);
    }
  }, [paused, opacity, onToggle]);

  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      resetHideTimer();
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [visible, resetHideTimer, opacity]);

  // L'habillage peut disparaître (auto-masquage à 4 s) sans emporter la
  // surcouche de lecture : le bouton de saut et la carte « à suivre » ne
  // dépendent plus de l'OSD, comme sur le bureau et le web.
  const hasOverlay = playback.overlay.kind !== "none";

  if (!visible && !hasOverlay) return null;

  return (
    <>
      {visible && (
        <Animated.View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          opacity, backgroundColor: PLAYER.scrim,
        }}>
          {/* Background tap to dismiss */}
          <Pressable
            onPress={onToggle}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Top bar — safe-area pour ne pas chevaucher la status bar (portrait). */}
          <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", paddingTop: Math.max(12, insets.top), paddingLeft: Math.max(16, insets.left), paddingRight: Math.max(16, insets.right), gap: 12 }}>
            <Pressable onPress={onBack} hitSlop={16} style={{ padding: 4 }}>
              <ArrowLeft size={Math.round(26 * ui)} color={PLAYER.text} />
            </Pressable>
            <Text numberOfLines={1} style={{ color: PLAYER.text, fontSize: Math.round(16 * ui), fontWeight: "600", flex: 1 }}>{title}</Text>
          </View>

          {/* Center controls — box-none : les zones vides laissent passer le tap
              vers le Pressable de fond (toggle overlay), seuls les boutons captent. */}
          <CenterControls
            paused={paused}
            ui={ui}
            centerGap={centerGap}
            playSize={playSize}
            hasPrevious={!!previousEpisode}
            hasNext={!!nextEpisode}
            onPrevious={onPreviousEpisode}
            onNext={onNextEpisode}
            onPlayPause={() => { onPlayPause(); resetHideTimer(); }}
            onRewind={() => { onSeek(currentTime - 10); flashSkip("left"); resetHideTimer(); }}
            onForward={() => { onSeek(currentTime + 30); flashSkip("right"); resetHideTimer(); }}
          />

          {/* Indicateur de saut ±10/30 (boutons) */}
          <SkipIndicator side={skipSide} />

          {/* Bottom bar: seek + track buttons */}
          <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "flex-end", paddingRight: 8 }}>
            <View style={{ flex: 1 }}>
              <PlayerSeekBar
                currentTime={currentTime}
                duration={duration}
                bufferedTime={bufferedTime}
                onSeek={(s) => { onSeek(s); resetHideTimer(); }}
                onScrubStateChange={(active) => {
                  if (active) {
                    if (hideTimer.current) clearTimeout(hideTimer.current);
                  } else {
                    resetHideTimer();
                  }
                }}
                item={item}
                mediaSourceId={mediaSourceId}
              />
            </View>
            <View style={{ flexDirection: "row", gap: isTablet ? 10 : 6, marginBottom: Math.max(34, insets.bottom + 12) }}>
              <AirPlaySection />
              {item?.SeriesId && (
                <Pressable
                  onPress={() => { setShowEpisodes(true); if (hideTimer.current) clearTimeout(hideTimer.current); }}
                  hitSlop={12}
                  style={{ padding: isTablet ? 12 : 8, backgroundColor: PLAYER.borderSubtle, borderRadius: 8 }}
                >
                  <List size={Math.round(18 * ui)} color={PLAYER.textSecondary} />
                </Pressable>
              )}
              {subtitleTracks.length > 0 && (
                <Pressable
                  onPress={() => { setShowSubtitles(true); setShowSettings(false); if (hideTimer.current) clearTimeout(hideTimer.current); }}
                  hitSlop={12}
                  style={{ padding: isTablet ? 12 : 8, backgroundColor: PLAYER.borderSubtle, borderRadius: 8 }}
                >
                  <Captions size={Math.round(18 * ui)} color={PLAYER.textSecondary} />
                </Pressable>
              )}
              <Pressable
                onPress={() => { setShowSettings(true); setShowSubtitles(false); if (hideTimer.current) clearTimeout(hideTimer.current); }}
                hitSlop={12}
                style={{ padding: 8, backgroundColor: PLAYER.borderSubtle, borderRadius: 8 }}
              >
                <Settings size={Math.round(18 * ui)} color={PLAYER.textSecondary} />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      {/* La surcouche de lecture — pilule de saut ou carte « à suivre ». Hors
          du bloc `visible` : elle ne suit pas l'auto-masquage de l'habillage. */}
      <PlaybackOverlayMobile
        overlay={playback.overlay}
        countdownTotals={playback.countdownTotals}
        nextEpisode={nextEpisode}
        onSkip={playback.skipNow}
        onDismiss={playback.dismissOverlay}
        onPlayNow={playback.playNow}
        bottom={Math.max(110, insets.bottom + 86)}
        right={Math.max(20, insets.right + 16)}
      />

      {/* Pop-ups Réglages + Sous-titres (extraits pour rester sous 300 lignes). */}
      <PlayerSettingsMenus
        showSettings={showSettings}
        showSubtitles={showSubtitles}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={selectedAudio}
        selectedSubtitle={selectedSubtitle}
        qualityKey={qualityKey}
        qualityPresets={qualityPresets}
        sourceQuality={sourceQuality}
        onSelectAudio={onSelectAudio}
        onSelectSubtitle={onSelectSubtitle}
        onSelectQuality={onSelectQuality}
        onCloseSettings={() => { setShowSettings(false); resetHideTimer(); }}
        onCloseSubtitles={() => { setShowSubtitles(false); resetHideTimer(); }}
      />

      {/* Sélecteur saison/épisode (séries) */}
      {item?.SeriesId && (
        <PlayerEpisodePicker
          visible={showEpisodes}
          seriesId={item.SeriesId}
          currentEpisodeId={item.Id}
          initialSeasonId={item.SeasonId}
          onClose={() => { setShowEpisodes(false); resetHideTimer(); }}
        />
      )}
    </>
  );
}


