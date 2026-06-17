import { useEffect, useState } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
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
import { Colors, Spacing, Typography, Radius } from "../../theme/colors";

const PANEL_WIDTH = 600;

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

  const slideX = useSharedValue(PANEL_WIDTH);
  useEffect(() => {
    slideX.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
  }, [slideX]);
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 80, elevation: 80 }}>
      {/* Scrim plein écran : assombrit la vidéo pour la lisibilité du panneau. */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />

      <Animated.View
        // @ts-ignore — Android TV accessibility
        importantForAccessibility="yes"
        style={[{
          position: "absolute", top: 0, right: 0, bottom: 0, width: PANEL_WIDTH,
          backgroundColor: Colors.glassBgHeavy,
          borderLeftWidth: 1, borderLeftColor: Colors.glassBorder,
          paddingTop: 40, paddingBottom: 24,
        }, panelStyle]}
      >
        {/* @ts-ignore — props TVFocusGuideView de react-native-tvos */}
        <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ flex: 1 }}>
          {/* Header : contexte série + titre + bouton Fermer.
              destinations → toute navigation HAUT entrant dans le header est
              redirigée vers le bouton Fermer (focusable sur tvOS ET Android). */}
          {/* @ts-ignore — props TVFocusGuideView de react-native-tvos */}
          <TVFocusGuideView
            destinations={closeNode ? [closeNode] : []}
            style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
              paddingHorizontal: Spacing.screenPadding, marginBottom: 18,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle }}>
                {t("common:seasonsEpisodes", { defaultValue: "Saisons & Épisodes" })}
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
                  {t("common:close", { defaultValue: "✕ Fermer" })}
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
            currentBadgeLabel={t("player:nowPlaying", { defaultValue: "En cours de visionnage" })}
            autoFocusCurrent
            fillHeight
          />
        </TVFocusGuideView>
      </Animated.View>
    </View>
  );
}
