import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { X, Play } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { PLAYER, useResponsive } from "../../theme";

interface Props {
  nextEpisode: MediaItem;
  countdown: number;
  /** Compte à rebours initial — pour la progression de l'anneau. */
  totalSeconds?: number;
  onPlay: () => void;
  onDismiss: () => void;
}

const DEFAULT_TOTAL = 10;
const RING = 46;
const RING_R = 19;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Carte PLEIN ÉCRAN « Épisode suivant » (façon Netflix), affichée à la fin d'un
 * épisode. Portage du desktop `NextEpisodeFullscreen` : fond = bannière de la
 * SÉRIE assombrie, vignette 16:9 de l'épisode suivant, saison/épisode + titre +
 * résumé, compte à rebours avec anneau de progression autour du bouton Lire.
 * Responsive téléphone / iPad (mêmes props que l'ancienne carte).
 */
export function AutoPlayOverlay({ nextEpisode, countdown, totalSeconds = DEFAULT_TOTAL, onPlay, onDismiss }: Props) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const insets = useSafeAreaInsets();
  const { width, isTablet } = useResponsive();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 90, friction: 13 }),
    ]).start();
  }, [opacity, scale]);

  const progress = Math.max(0, Math.min(1, (totalSeconds - countdown) / totalSeconds));

  const isEpisode = nextEpisode.Type === "Episode";
  const seriesId = isEpisode
    ? (nextEpisode.ParentBackdropItemId ?? nextEpisode.SeriesId ?? nextEpisode.Id)
    : nextEpisode.Id;
  const backdropUrl = client.getImageUrl(seriesId, "Backdrop", { width: 1280, quality: 80 });
  const thumbUrl = client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 85 });

  const episodeLabel = isEpisode && nextEpisode.ParentIndexNumber != null && nextEpisode.IndexNumber != null
    ? `S${String(nextEpisode.ParentIndexNumber).padStart(2, "0")}E${String(nextEpisode.IndexNumber).padStart(2, "0")}`
    : undefined;
  const description = nextEpisode.Overview;

  // Player en paysage → largeur généralement grande : rangée vignette + infos.
  const row = width >= 640;
  const sidePad = Math.max(insets.left, insets.right, 24);
  const panelMax = isTablet ? 880 : 700;
  const thumbW = row ? (isTablet ? 320 : 236) : Math.min(width - sidePad * 2, 420);
  const thumbH = Math.round((thumbW * 9) / 16);
  const titleSize = isTablet ? 34 : 24;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 60, opacity }]}>
      {/* Fond = bannière série assombrie */}
      <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: PLAYER.scrimStrong }]} />
      <LinearGradient
        colors={[PLAYER.scrim, "transparent", PLAYER.scrimStrong]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Absorbe les taps de fond (n'atteignent pas les contrôles vidéo). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessibilityElementsHidden />

      {/* Fermer */}
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("dismiss") as string}
        hitSlop={12}
        style={{
          position: "absolute",
          top: Math.max(insets.top, 16) + 6,
          right: Math.max(insets.right, 16) + 6,
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: PLAYER.scrim,
          alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}
      >
        <X size={22} color={PLAYER.text} />
      </Pressable>

      {/* Panneau centré */}
      <Animated.View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: sidePad, transform: [{ scale }] }}>
        <View style={{ width: "100%", maxWidth: panelMax }}>
          {/* Compte à rebours */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PLAYER.accentLight }} />
            <Text style={{ color: PLAYER.text, fontSize: isTablet ? 14 : 12, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 4 }}>
              {t("autoplayCountdown", { seconds: countdown })}
            </Text>
          </View>

          <View style={{ flexDirection: row ? "row" : "column", gap: isTablet ? 26 : 18, alignItems: row ? "flex-start" : "stretch" }}>
            {/* Vignette 16:9 de l'épisode suivant */}
            <View style={{ width: row ? thumbW : "100%", maxWidth: thumbW, alignSelf: "center" }}>
              <View style={{ width: "100%", height: thumbH, borderRadius: 14, overflow: "hidden", backgroundColor: PLAYER.bg, borderWidth: 1, borderColor: PLAYER.accentSoft }}>
                <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center" }]}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: PLAYER.scrim, alignItems: "center", justifyContent: "center" }}>
                    <Play size={24} color={PLAYER.text} fill={PLAYER.text} />
                  </View>
                </View>
              </View>
            </View>

            {/* Infos épisode */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: PLAYER.textTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" }}>
                {t("upNext")}
              </Text>
              {episodeLabel && (
                <Text style={{ color: PLAYER.textTertiary, fontSize: 12, fontWeight: "700", letterSpacing: 1.6, marginTop: 6 }}>
                  {episodeLabel}
                </Text>
              )}
              <Text numberOfLines={2} style={{ color: PLAYER.text, fontSize: titleSize, fontWeight: "800", letterSpacing: -0.4, lineHeight: titleSize + 4, marginTop: 3, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 12 }}>
                {nextEpisode.Name}
              </Text>
              {description && (
                <Text numberOfLines={3} style={{ color: PLAYER.textSecondary, fontSize: isTablet ? 15 : 13, lineHeight: isTablet ? 22 : 19, marginTop: 10 }}>
                  {description}
                </Text>
              )}

              {/* Boutons */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: isTablet ? 22 : 16, flexWrap: "wrap" }}>
                <Pressable
                  onPress={onPlay}
                  accessibilityRole="button"
                  accessibilityLabel={t("playNow") as string}
                  style={({ pressed }) => [{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    backgroundColor: PLAYER.text, borderRadius: 14, paddingLeft: 8, paddingRight: 22, paddingVertical: 8,
                    shadowColor: PLAYER.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
                  }, pressed && { opacity: 0.9 }]}
                >
                  <View style={{ width: RING, height: RING }}>
                    <Svg width={RING} height={RING} style={{ transform: [{ rotate: "-90deg" }] }}>
                      <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={PLAYER.fillInverse} strokeWidth={4} fill="none" />
                      <Circle
                        cx={RING / 2} cy={RING / 2} r={RING_R}
                        stroke={PLAYER.accent} strokeWidth={4} fill="none" strokeLinecap="round"
                        strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - progress)}
                      />
                    </Svg>
                    <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center" }]}>
                      <Play size={18} color={PLAYER.textInverse} fill={PLAYER.textInverse} />
                    </View>
                  </View>
                  <Text style={{ color: PLAYER.textInverse, fontSize: isTablet ? 17 : 15, fontWeight: "800" }}>
                    {t("playNow")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onDismiss}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [{
                    borderRadius: 14, borderWidth: 1, borderColor: PLAYER.border, backgroundColor: PLAYER.fillSubtle,
                    paddingHorizontal: 22, paddingVertical: isTablet ? 15 : 13,
                  }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: PLAYER.text, fontSize: isTablet ? 16 : 14, fontWeight: "600" }}>
                    {t("dismiss")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
