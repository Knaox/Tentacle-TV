import { useEffect, useRef, useState } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { useTVFocusGrab } from "../hooks/useTVFocusGrab";
import { osdPlayPauseNodeRef } from "./player/focus/osdFocusBus";
import type { SegmentTimestamps } from "@tentacle-tv/shared";

interface TVSkipSegmentButtonProps {
  type: "intro" | "credits";
  segment?: SegmentTimestamps | null;
  currentTime: number;
  onSkip: () => void;
  /** When true, don't steal focus (overlay or settings panel is active) */
  overlayVisible?: boolean;
  showSettings?: boolean;
  /** Panneau épisodes ouvert → masquer le bouton (il recouvrirait le panneau). */
  showEpisodes?: boolean;
  /** Libellé alternatif (web : « Épisode suivant » pendant le générique). */
  labelOverride?: string;
}

export function TVSkipSegmentButton({ type, segment, currentTime, onSkip, overlayVisible = false, showSettings = false, showEpisodes = false, labelOverride }: TVSkipSegmentButtonProps) {
  const { t } = useTranslation("player");
  const [dismissed, setDismissed] = useState(false);
  const skipRef = useRef<View>(null);

  const inRange = !!segment
    && currentTime >= segment.start
    && currentTime < segment.end - 1;
  const visible = inRange && !dismissed && !showEpisodes;

  // tvOS : à l'apparition du bouton OSD CACHÉ, le focus saute dessus (UX
  // « Skip Intro » focalisé par défaut). OSD ouvert, on ne VOLE pas le focus
  // de la navigation en cours (le bouton n'a aucune sortie géométrique → focus
  // piégé sinon) ; à la fermeture de l'OSD pendant le segment, le front
  // montant re-déclenche le grab → le focus revient sur le bouton.
  useTVFocusGrab(skipRef, visible && !showSettings && !overlayVisible);

  // For credits: pressing Back dismisses the popup
  useTVRemote({
    onBack: type === "credits" && visible ? () => setDismissed(true) : undefined,
  });

  // Reset dismissed state when segment goes out of range
  useEffect(() => {
    if (!inRange) setDismissed(false);
  }, [inRange]);

  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!segment || !visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[{
        position: "absolute",
        // Au-dessus de la barre de transport de l'OSD pour ne pas la chevaucher.
        bottom: 220,
        right: 40,
        zIndex: 100,
      }, animStyle]}
    >
      <Focusable ref={skipRef} variant="button" onPress={onSkip} focusRadius={8} hasTVPreferredFocus={!overlayVisible && !showSettings && !showEpisodes}>
        <View style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          backgroundColor: "rgba(0,0,0,0.60)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.20)",
          borderRadius: 8,
        }}>
          <Text style={{
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "600",
          }}>
            {labelOverride ?? (type === "intro" ? t("skipIntro") : t("skipCredits"))}
          </Text>
        </View>
      </Focusable>
      {/* Sortie D-pad garantie vers l'OSD : tvOS IGNORE les nextFocus* et le
          bouton est géométriquement isolé de la rangée transport (centrée) —
          un appui « bas » entre dans ce guide invisible et est redirigé vers
          play/pause. Monté seulement OSD visible (sinon cible invisible). */}
      {overlayVisible && osdPlayPauseNodeRef.current && (
        <TVFocusGuideView
          destinations={[osdPlayPauseNodeRef.current]}
          style={{ position: "absolute", top: "100%", left: -80, right: 0, height: 140 }}
        />
      )}
    </Animated.View>
  );
}
