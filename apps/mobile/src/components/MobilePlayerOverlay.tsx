import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, Pressable, Animated, Platform, useWindowDimensions } from "react-native";
import { ArrowLeft, SkipBack, RotateCcw, Play, Pause, RotateCw, SkipForward, Captions, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { SegmentTimestamps, MediaItem } from "@tentacle-tv/shared";
import { extractSourceQuality, formatBitrateMbps } from "@tentacle-tv/shared";
import { QUALITY_PRESETS, type QualityKey } from "../hooks/usePlayerPlayback";
import { PlayerSeekBar } from "./player/PlayerSeekBar";
import { PlayerPopupMenu } from "./player/PlayerPopupMenu";
import { AutoPlayOverlay } from "./player/AutoPlayOverlay";
import { SkipButton } from "./player/SkipButton";

// AirPlay button — iOS only (native AVRoutePickerView)
const AirPlaySection = Platform.OS === "ios"
  ? require("./player/AirPlayButton").AirPlaySection
  : () => null;

interface Track { index: number; label: string }

/** Countdown shown in the AutoPlay card before navigating to next episode. */
const AUTOPLAY_COUNTDOWN_SEC = 10;
/** Fallback window (s) before the video ends to surface the AutoPlay overlay
 * when intro-skipper / MediaSegments don't expose a credits segment.
 * Matches desktop default (`autoplayCreditsMinutes: 2`). */
const AUTOPLAY_END_FALLBACK_SEC = 120;
/** Don't auto-trigger fallback on short clips (< 5 min) — same as desktop. */
const MIN_DURATION_FOR_FALLBACK_SEC = 300;

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
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
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
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle, qualityKey,
  introSegment, creditsSegment, nextEpisode, previousEpisode,
  item, mediaSourceId,
  onPlayPause, onSeek, onBack,
  onSelectAudio, onSelectSubtitle, onSelectQuality,
  onNextEpisode, onPreviousEpisode,
  visible, onToggle,
}: Props) {
  const { t } = useTranslation("player");
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playSize = Math.min(60, Math.round(screenH * 0.08));
  const centerGap = Math.min(36, Math.round(screenW * 0.05));
  const hasNextEpisode = !!(nextEpisode && onNextEpisode);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showAutoPlay, setShowAutoPlay] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number>(AUTOPLAY_COUNTDOWN_SEC);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoPlayDismissed = useRef(false);
  const autoPlayTriggered = useRef(false);
  const autoPlayTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

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

  // Start countdown once. The interval ONLY decrements state — navigation
  // (onNextEpisode → router.replace) is handled by the effect below so we
  // don't trigger router updates from inside a setState updater (that warns
  // "Cannot update a component while rendering another").
  const startAutoPlay = useCallback(() => {
    if (!nextEpisode || !onNextEpisode) return;
    if (autoPlayTriggered.current) return;
    autoPlayTriggered.current = true;
    setAutoPlayCountdown(AUTOPLAY_COUNTDOWN_SEC);
    setShowAutoPlay(true);
    if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    autoPlayTimer.current = setInterval(() => {
      setAutoPlayCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
  }, [nextEpisode, onNextEpisode]);

  useEffect(() => () => { if (autoPlayTimer.current) clearInterval(autoPlayTimer.current); }, []);

  // Countdown reached zero — clear timer and fire navigation outside render.
  const autoPlayNavigated = useRef(false);
  useEffect(() => {
    if (!autoPlayTriggered.current) return;
    if (autoPlayNavigated.current) return;
    if (autoPlayCountdown !== 0) return;
    autoPlayNavigated.current = true;
    if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    onNextEpisode?.();
  }, [autoPlayCountdown, onNextEpisode]);

  // Same conditions as desktop VideoPlayer:
  //   triggerAt = creditsSegment?.start ?? (duration > 300 ? duration - 120 : null)
  useEffect(() => {
    if (autoPlayTriggered.current || autoPlayDismissed.current) return;
    if (!nextEpisode || !onNextEpisode) return;
    const triggerAt = creditsSegment
      ? creditsSegment.start
      : (duration > MIN_DURATION_FOR_FALLBACK_SEC ? duration - AUTOPLAY_END_FALLBACK_SEC : null);
    if (triggerAt != null && currentTime >= triggerAt) {
      startAutoPlay();
    }
  }, [currentTime, creditsSegment, nextEpisode, onNextEpisode, duration, startAutoPlay]);

  const dismissAutoPlay = useCallback(() => {
    autoPlayDismissed.current = true;
    if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    setShowAutoPlay(false);
  }, []);

  const showSkipIntro = introSegment && currentTime >= introSegment.start && currentTime < introSegment.end - 1;
  const showSkipCredits = creditsSegment && currentTime >= creditsSegment.start && currentTime < creditsSegment.end - 1 && !showAutoPlay;

  if (!visible && !showAutoPlay) return null;

  return (
    <>
      {visible && (
        <Animated.View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          opacity, backgroundColor: "rgba(0,0,0,0.4)",
        }}>
          {/* Background tap to dismiss */}
          <Pressable
            onPress={onToggle}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Top bar */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 12, paddingHorizontal: 16, gap: 12 }}>
            <Pressable onPress={onBack} hitSlop={16} style={{ padding: 4 }}>
              <ArrowLeft size={26} color="#fff" />
            </Pressable>
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 }}>{title}</Text>
          </View>

          {/* Center controls */}
          <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: centerGap }}>
            {previousEpisode && onPreviousEpisode && (
              <Pressable onPress={onPreviousEpisode} hitSlop={16} style={{ padding: 8 }}>
                <SkipBack size={22} color="rgba(255,255,255,0.8)" />
              </Pressable>
            )}

            <Pressable onPress={() => { onSeek(currentTime - 10); resetHideTimer(); }} hitSlop={16} style={{ padding: 8 }}>
              <RotateCcw size={24} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600", textAlign: "center", marginTop: 2 }}>10</Text>
            </Pressable>

            <Pressable onPress={() => { onPlayPause(); resetHideTimer(); }} hitSlop={16}>
              <View style={{
                width: playSize, height: playSize, borderRadius: playSize / 2,
                backgroundColor: "rgba(255,255,255,0.15)",
                justifyContent: "center", alignItems: "center",
              }}>
                {paused ? <Play size={30} color="#fff" /> : <Pause size={30} color="#fff" />}
              </View>
            </Pressable>

            <Pressable onPress={() => { onSeek(currentTime + 30); resetHideTimer(); }} hitSlop={16} style={{ padding: 8 }}>
              <RotateCw size={24} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600", textAlign: "center", marginTop: 2 }}>30</Text>
            </Pressable>

            {nextEpisode && onNextEpisode && (
              <Pressable onPress={onNextEpisode} hitSlop={16} style={{ padding: 8 }}>
                <SkipForward size={22} color="rgba(255,255,255,0.8)" />
              </Pressable>
            )}
          </View>

          {/* Skip intro / credits — design aligné desktop (pill blur 24, border subtle, bottom-right safe-area) */}
          {showSkipIntro && introSegment && (
            <SkipButton
              label={t("skipIntro")}
              onPress={() => onSeek(introSegment.end)}
              bottom={Math.max(110, insets.bottom + 86)}
              right={Math.max(20, insets.right + 16)}
            />
          )}
          {showSkipCredits && creditsSegment && (
            <SkipButton
              label={hasNextEpisode ? t("nextEpisodeLabel") : t("skipCredits")}
              showChevron={hasNextEpisode}
              onPress={() => {
                if (hasNextEpisode && onNextEpisode) onNextEpisode();
                else onSeek(creditsSegment.end);
              }}
              bottom={Math.max(110, insets.bottom + 86)}
              right={Math.max(20, insets.right + 16)}
            />
          )}

          {/* Bottom bar: seek + track buttons */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", paddingRight: 8 }}>
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
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 34 }}>
              <AirPlaySection />
              {subtitleTracks.length > 0 && (
                <Pressable
                  onPress={() => { setShowSubtitles(true); setShowSettings(false); if (hideTimer.current) clearTimeout(hideTimer.current); }}
                  hitSlop={12}
                  style={{ padding: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8 }}
                >
                  <Captions size={18} color="rgba(255,255,255,0.8)" />
                </Pressable>
              )}
              <Pressable
                onPress={() => { setShowSettings(true); setShowSubtitles(false); if (hideTimer.current) clearTimeout(hideTimer.current); }}
                hitSlop={12}
                style={{ padding: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8 }}
              >
                <Settings size={18} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      {/* AutoPlay overlay */}
      {showAutoPlay && nextEpisode && onNextEpisode && (
        <AutoPlayOverlay
          nextEpisode={nextEpisode}
          countdown={autoPlayCountdown}
          totalSeconds={AUTOPLAY_COUNTDOWN_SEC}
          onPlay={onNextEpisode}
          onDismiss={dismissAutoPlay}
        />
      )}

      {/* Popup Paramètres — audio + qualité */}
      <PlayerPopupMenu
        visible={showSettings}
        title={t("settings")}
        sections={[
          ...(audioTracks.length > 0 ? [{
            title: t("audioLabel"),
            options: audioTracks.map((tr) => ({
              key: tr.index, label: tr.label, active: selectedAudio === tr.index,
            })),
            onSelect: (k: string | number) => { onSelectAudio(k as number); setShowSettings(false); },
          }] : []),
          {
            title: t("quality").toUpperCase(),
            options: QUALITY_PRESETS.map((p) => {
              const isOriginal = p.key === "original";
              const badges = isOriginal ? [
                ...(sourceQuality.isDolbyVision ? [{ label: "DV", tone: "purple" as const }] : []),
                ...(sourceQuality.isHDR ? [{ label: "HDR", tone: "amber" as const }] : []),
                ...(sourceQuality.isDolbyAtmos ? [{ label: "Atmos", tone: "amber" as const }] : []),
              ] : undefined;
              const suffix = isOriginal && sourceQuality.resolution ? `— ${sourceQuality.resolution}` : undefined;
              const rightChip = !isOriginal && p.bitrate
                ? { label: formatBitrateMbps(p.bitrate), tone: "zinc" as const } : undefined;
              return {
                key: p.key,
                label: t(p.key),
                active: qualityKey === p.key,
                suffix,
                badges,
                rightChip,
              };
            }),
            onSelect: (k: string | number) => { onSelectQuality(k as QualityKey); setShowSettings(false); },
          },
        ]}
        onClose={() => { setShowSettings(false); resetHideTimer(); }}
      />

      {/* Popup Sous-titres */}
      <PlayerPopupMenu
        visible={showSubtitles}
        title={t("subtitles")}
        sections={[{
          title: t("subtitlesLabel"),
          options: subtitleTracks.map((tr) => ({
            key: tr.index, label: tr.label, active: selectedSubtitle === tr.index,
          })),
          onSelect: (k: string | number) => { onSelectSubtitle(k as number); setShowSubtitles(false); },
          showDisabled: {
            label: t("disabled"),
            active: selectedSubtitle === -1,
            onSelect: () => { onSelectSubtitle(-1); setShowSubtitles(false); },
          },
        }]}
        onClose={() => { setShowSubtitles(false); resetHideTimer(); }}
      />
    </>
  );
}


