import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, Animated, useWindowDimensions } from "react-native";
import { ArrowLeft, SkipBack, RotateCcw, Play, Pause, RotateCw, SkipForward, Captions, Settings } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { SegmentTimestamps, MediaItem } from "@tentacle-tv/shared";
import { QUALITY_PRESETS, type QualityKey } from "../hooks/usePlayerPlayback";
import { PlayerSeekBar } from "./player/PlayerSeekBar";
import { PlayerPopupMenu } from "./player/PlayerPopupMenu";
import { AutoPlayOverlay } from "./player/AutoPlayOverlay";

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
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  nextEpisode?: MediaItem | null;
  previousEpisode?: MediaItem | null;
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
  onPlayPause, onSeek, onBack,
  onSelectAudio, onSelectSubtitle, onSelectQuality,
  onNextEpisode, onPreviousEpisode,
  visible, onToggle,
}: Props) {
  const { t } = useTranslation("player");
  const { width: screenW, height: screenH } = useWindowDimensions();
  const playSize = Math.min(60, Math.round(screenH * 0.08));
  const centerGap = Math.min(36, Math.round(screenW * 0.05));
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showAutoPlay, setShowAutoPlay] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const autoPlayDismissed = useRef(false);

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

  // AutoPlay: show overlay when credits start
  useEffect(() => {
    if (!creditsSegment || !nextEpisode || autoPlayDismissed.current) return;
    if (currentTime >= creditsSegment.start && currentTime < creditsSegment.end - 1) {
      setShowAutoPlay(true);
    }
  }, [currentTime, creditsSegment, nextEpisode]);

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

          {/* Skip intro / credits */}
          {showSkipIntro && introSegment && (
            <View style={{ position: "absolute", bottom: Math.min(120, Math.round(screenH * 0.15)), right: 16 }}>
              <SkipButton label={t("skipIntro")} onPress={() => onSeek(introSegment.end)} />
            </View>
          )}
          {showSkipCredits && creditsSegment && (
            <View style={{ position: "absolute", bottom: Math.min(120, Math.round(screenH * 0.15)), right: 16 }}>
              <SkipButton label={t("skipCredits")} onPress={() => onSeek(creditsSegment.end)} />
            </View>
          )}

          {/* Bottom bar: seek + track buttons */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", paddingRight: 8 }}>
            <View style={{ flex: 1 }}>
              <PlayerSeekBar
                currentTime={currentTime}
                duration={duration}
                bufferedTime={bufferedTime}
                onSeek={(s) => { onSeek(s); resetHideTimer(); }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 34 }}>
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
          onPlay={onNextEpisode}
          onDismiss={() => { setShowAutoPlay(false); autoPlayDismissed.current = true; }}
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
            options: QUALITY_PRESETS.map((p) => ({
              key: p.key, label: t(p.key), active: qualityKey === p.key,
            })),
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

function SkipButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)", borderRadius: 8,
      paddingHorizontal: 20, paddingVertical: 10,
    }}>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

