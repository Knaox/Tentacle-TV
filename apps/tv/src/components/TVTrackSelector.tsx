import { useRef } from "react";
import { View, Text, ScrollView, TVFocusGuideView, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { CheckIcon } from "./icons/TVIcons";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { TV_OVERSCAN_PT, TV_PLAYER_PANEL, TV_RADIUS, TV_SHADOW } from "@tentacle-tv/theme";
import { Colors, Radius, brandAlpha } from "../theme/colors";
import { TVQualitySection } from "./player/TVQualitySection";
import { Bouton } from "../theme/boutons";

interface Track {
  index: number;
  label: string;
}

export interface TVTrackSelectorProps {
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  qualityKey?: QualityKey;
  /** Paliers calculés d'après la source (cf. buildQualityLadder). */
  qualityPresets?: readonly QualityPreset[];
  sourceQuality?: SourceQuality;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality?: (key: QualityKey) => void;
  onClose: () => void;
  /** Called on any user interaction to reset overlay auto-hide timer */
  onInteraction?: () => void;
  /** En mode route modale, c'est le dismiss natif de la modale qui gère le
   *  Menu/ESC → on désactive le back interne (sinon double-pop = sortie vidéo). */
  disableBackHandler?: boolean;
}

const TRACK_ITEM_HEIGHT = 52; // paddingVertical 14*2 + text ~24

export function TVTrackSelector({
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle,
  qualityKey, qualityPresets, sourceQuality,
  onSelectAudio, onSelectSubtitle, onSelectQuality, onClose, onInteraction,
  disableBackHandler = false,
}: TVTrackSelectorProps) {
  const { t } = useTranslation("player");
  const { height: screenH } = useWindowDimensions();
  // Overlay (Android, ou usage historique) : son BACK referme le panneau (LIFO).
  // En mode route modale (tvOS), le dismiss natif gère ESC → on désactive ici.
  useTVRemote({ onBack: disableBackHandler ? undefined : onClose });
  // Le voile et le panneau ENTRENT en fondu (180 ms, parité panneau-tv-fondu) ;
  // rien ne reste monté à opacité nulle au-dessus d'une vidéo.
  const fade = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const { makeOnFocus } = useTVScrollToFocused(scrollRef, 60);

  useEffect(() => {
    fade.value = withTiming(1, { duration: TV_PLAYER_PANEL.scrimFadeMs, easing: Easing.out(Easing.ease) });
  }, [fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const renderTrack = (track: Track, isSelected: boolean, onSelect: () => void, preferFocus = false, scrollIndex = 0) => (
    <Focusable key={track.index} variant="row" onPress={() => { onSelect(); onInteraction?.(); }} hasTVPreferredFocus={preferFocus} onFocus={makeOnFocus(scrollIndex, TRACK_ITEM_HEIGHT)}>
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: Radius.small, marginBottom: 4,
        backgroundColor: isSelected ? brandAlpha(0.15) : "transparent",
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
    <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, fadeStyle]}>
      {/* Voile d'assombrissement : ce qui n'est plus à portée s'éteint. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: TV_PLAYER_PANEL.scrim }}
      />
      {/* Le panneau FLOTTE au-dessus de la barre (parité .panneau-tv) : ancré
          bas-droit dans le retrait d'overscan, jamais pleine hauteur. */}
      <View
        importantForAccessibility="yes"
        style={{
          position: "absolute",
          right: TV_OVERSCAN_PT.x,
          bottom: TV_PLAYER_PANEL.bottom,
          width: TV_PLAYER_PANEL.width,
          height: screenH - TV_PLAYER_PANEL.maxHeightInset,
          borderRadius: TV_RADIUS.lg,
          // `--surface-dropdown` du thème TV (tokens/tv.ts).
          backgroundColor: "#14141a",
          borderWidth: 1, borderColor: Colors.glassBorder,
          paddingVertical: 24, paddingHorizontal: 20,
          ...TV_SHADOW.elev3,
        }}
      >
      <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          flexDirection: "row", justifyContent: "space-between",
          alignItems: "center", marginBottom: 32, paddingHorizontal: 8,
        }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
            {t("tracks")}
          </Text>
          <Focusable variant="button" focusRadius={Bouton.petit.borderRadius} onPress={onClose}>
            <View style={{
              paddingHorizontal: 16, paddingVertical: 8,
              ...Bouton.petit,
              backgroundColor: "rgba(255,255,255,0.06)",
            }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>
                {t("close")}
              </Text>
            </View>
          </Focusable>
        </View>

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
            { index: -1, label: t("subtitlesDisabled") },
            selectedSubtitle === -1,
            () => onSelectSubtitle(-1),
            false,
            audioTracks.length,
          )}

          {subtitleTracks.map((track, i) =>
            renderTrack(track, track.index === selectedSubtitle, () => onSelectSubtitle(track.index), false, audioTracks.length + 1 + i)
          )}

          {/* Quality section */}
          {onSelectQuality && qualityKey && (
            <TVQualitySection
              qualityKey={qualityKey}
              qualityPresets={qualityPresets}
              sourceQuality={sourceQuality}
              onSelectQuality={onSelectQuality}
              onInteraction={onInteraction}
              makeOnFocus={makeOnFocus}
              scrollOffsetStart={audioTracks.length + 1 + subtitleTracks.length}
            />
          )}
        </ScrollView>
      </TVFocusGuideView>
      </View>
    </Animated.View>
  );
}
