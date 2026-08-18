import { useEffect, useState } from "react";
import { View, Text, TVFocusGuideView, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { TVEpisodeList } from "../TVEpisodeList";
import { Focusable } from "../focus/Focusable";
import { useTVRemote } from "../focus/useTVRemote";
import { TV_OVERSCAN_PT, TV_PLAYER_PANEL, TV_RADIUS, TV_SHADOW } from "@tentacle-tv/theme";
import { Colors, Spacing, Typography, Radius } from "../../theme/colors";

interface TVPlayerEpisodePanelProps {
  seriesId: string;
  /** Épisode en cours de lecture — cible la saison et surligne la row */
  currentEpisode?: MediaItem | null;
  onSelectEpisode: (episode: MediaItem) => void;
  onClose: () => void;
}

/**
 * Panneau « Saisons & épisodes » DANS le lecteur (séries) — panneau LATÉRAL
 * droit (la vidéo reste visible à gauche), aligné sur le pattern de
 * `TVTrackSelector` : scrim de lisibilité, glissement depuis la droite, header
 * avec bouton « Fermer » focusable, focus piégé dans le panneau. BACK referme
 * sans quitter la lecture (PlayerScreen + useTVRemote local, LIFO).
 */
export function TVPlayerEpisodePanel({ seriesId, currentEpisode, onSelectEpisode, onClose }: TVPlayerEpisodePanelProps) {
  const { t } = useTranslation(["common", "player"]);
  // Monté en dernier → son BACK est prioritaire (LIFO) : referme le panneau.
  useTVRemote({ onBack: onClose });
  // Nœud du bouton Fermer publié via callback ref → cible de focus du header
  // (TVFocusGuideView destinations) : la navigation HAUT y atterrit quelle que
  // soit sa position horizontale (sinon le focus géométrique ne le « trouve » pas).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [closeNode, setCloseNode] = useState<any>(null);

  const { height: screenH } = useWindowDimensions();
  // Fondu d'entrée (180 ms, parité panneau-tv-fondu) — plus de glissement.
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: TV_PLAYER_PANEL.voileFonduMs, easing: Easing.out(Easing.ease) });
  }, [fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 80, elevation: 80 }, fadeStyle]}>
      {/* Voile d'assombrissement (parité .panneau-tv) : la vidéo s'éteint. */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: TV_PLAYER_PANEL.voile }} />

      <View
        importantForAccessibility="yes"
        style={{
          position: "absolute",
          right: TV_OVERSCAN_PT.x,
          bottom: TV_PLAYER_PANEL.bas,
          width: TV_PLAYER_PANEL.largeur,
          height: screenH - TV_PLAYER_PANEL.hauteurMaxRetrait,
          borderRadius: TV_RADIUS.lg,
          backgroundColor: "#14141a",
          borderWidth: 1, borderColor: Colors.glassBorder,
          paddingTop: 20, paddingBottom: 16,
          ...TV_SHADOW.elev3,
        }}
      >
        <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ flex: 1 }}>
          {/* Header : contexte série + titre + bouton Fermer.
              destinations → toute navigation HAUT entrant dans le header est
              redirigée vers le bouton Fermer (focusable sur tvOS ET Android). */}
          <TVFocusGuideView
            destinations={closeNode ? [closeNode] : []}
            style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
              paddingHorizontal: Spacing.screenPadding, marginBottom: 18,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle }}>
                {t("common:seasonsEpisodes")}
              </Text>
              {!!currentEpisode?.SeriesName && (
                <Text style={{ color: Colors.textMuted, fontSize: 15, marginTop: 4 }} numberOfLines={1}>
                  {currentEpisode.SeriesName}
                </Text>
              )}
            </View>
            <Focusable ref={setCloseNode} variant="button" onPress={onClose}>
              <View style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.small,
                backgroundColor: "rgba(255,255,255,0.06)",
              }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>
                  {t("common:close")}
                </Text>
              </View>
            </Focusable>
          </TVFocusGuideView>
          <View style={{ height: 1, backgroundColor: Colors.divider, marginHorizontal: Spacing.screenPadding, marginBottom: 14 }} />

          <TVEpisodeList
            seriesId={seriesId}
            onPlay={onSelectEpisode}
            currentEpisodeId={currentEpisode?.Id}
            initialSeasonId={currentEpisode?.SeasonId}
            currentBadgeLabel={t("player:nowPlaying")}
            autoFocusCurrent
            fillHeight
            thumbWidth={TV_PLAYER_PANEL.vignetteEpisode.largeur}
          />
        </TVFocusGuideView>
      </View>
    </Animated.View>
  );
}
