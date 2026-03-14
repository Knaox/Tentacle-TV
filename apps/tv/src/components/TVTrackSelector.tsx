import { useRef } from "react";
import { View, Text, ScrollView, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { CheckIcon } from "./icons/TVIcons";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { Colors, Radius } from "../theme/colors";

interface Track {
  index: number;
  label: string;
}

interface TVTrackSelectorProps {
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onClose: () => void;
  /** Called on any user interaction to reset overlay auto-hide timer */
  onInteraction?: () => void;
}

const TRACK_ITEM_HEIGHT = 52; // paddingVertical 14*2 + text ~24

export function TVTrackSelector({
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle,
  onSelectAudio, onSelectSubtitle, onClose, onInteraction,
}: TVTrackSelectorProps) {
  const { t } = useTranslation("player");
  const slideX = useSharedValue(380);
  const scrollRef = useRef<ScrollView>(null);
  const { makeOnFocus } = useTVScrollToFocused(scrollRef, 60);

  useEffect(() => {
    slideX.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
  }, [slideX]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const renderTrack = (track: Track, isSelected: boolean, onSelect: () => void, preferFocus = false, scrollIndex = 0) => (
    <Focusable key={track.index} variant="row" onPress={() => { onSelect(); onInteraction?.(); }} hasTVPreferredFocus={preferFocus} onFocus={makeOnFocus(scrollIndex, TRACK_ITEM_HEIGHT)}>
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: Radius.small, marginBottom: 4,
        backgroundColor: isSelected ? "rgba(139, 92, 246, 0.15)" : "transparent",
      }}>
        <View style={{ width: 28, alignItems: "center" }}>
          {isSelected && <CheckIcon size={16} color={Colors.accentPurple} />}
        </View>
        <Text style={{
          color: isSelected ? Colors.textPrimary : Colors.textSecondary,
          fontSize: 16, fontWeight: isSelected ? "600" : "400",
          flex: 1,
        }}>
          {track.label}
        </Text>
      </View>
    </Focusable>
  );

  return (
    <Animated.View
      // @ts-ignore — Android TV accessibility
      importantForAccessibility="yes"
      style={[{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 380,
        backgroundColor: Colors.glassBgHeavy,
        borderLeftWidth: 1, borderLeftColor: Colors.glassBorder,
        paddingVertical: 40, paddingHorizontal: 24,
      }, panelStyle]}
    >
      {/* Header */}
      <View style={{
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: 32, paddingHorizontal: 8,
      }}>
        <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
          {t("tracks")}
        </Text>
        <Focusable variant="button" onPress={onClose}>
          <View style={{
            paddingHorizontal: 16, paddingVertical: 8,
            borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>
              {t("close", { defaultValue: "Close" })}
            </Text>
          </View>
        </Focusable>
      </View>

      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
      <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
          {/* Audio section */}
          <Text style={{
            color: Colors.textTertiary, fontSize: 14, fontWeight: "700",
            letterSpacing: 1, marginBottom: 10, marginLeft: 8,
            textTransform: "uppercase",
          }}>
            {t("audio")}
          </Text>
          {audioTracks.map((track, i) =>
            renderTrack(track, track.index === selectedAudio, () => onSelectAudio(track.index), track.index === selectedAudio, i)
          )}

          {/* Subtitle section */}
          <Text style={{
            color: Colors.textTertiary, fontSize: 14, fontWeight: "700",
            letterSpacing: 1, marginTop: 28, marginBottom: 10, marginLeft: 8,
            textTransform: "uppercase",
          }}>
            {t("subtitles")}
          </Text>

          {/* Disabled option */}
          {renderTrack(
            { index: -1, label: t("subtitlesDisabled", { defaultValue: "Disabled" }) },
            selectedSubtitle === -1,
            () => onSelectSubtitle(-1),
            false,
            audioTracks.length,
          )}

          {subtitleTracks.map((track, i) =>
            renderTrack(track, track.index === selectedSubtitle, () => onSelectSubtitle(track.index), false, audioTracks.length + 1 + i)
          )}
        </ScrollView>
      </TVFocusGuideView>
    </Animated.View>
  );
}
