import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { X, Play } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { PLAYER, motion, useResponsive } from "../../theme";
import { OverlayPill } from "./overlayPill";
import { useArmedCountdown } from "./useArmedCountdown";

interface Props {
  nextEpisode: MediaItem;
  /** Secondes restantes ; `null` = pas de décompte (offre sans minuterie). */
  countdownSeconds: number | null;
  countdownTotalMs: number;
  controlsVisible: boolean;
  onPlay: () => void;
  onDismiss: () => void;
}

/**
 * La carte « à suivre » DE COIN — pendant le générique, la vidéo reste
 * visible ; le plein écran n'existe plus qu'à la vraie fin (l'affiche).
 * Portage du `UpNextCard` desktop : coin bas-droit, vignette 16:7 fondue
 * dans la surface, badge, croix, et la même pilule blanche pleine largeur
 * dont le balayage montre le temps qui reste.
 *
 * Surface OPAQUE (surface-modal du web) — jamais de flou sur la vidéo.
 * Elle remonte quand l'habillage du lecteur est à l'écran, comme sur le web.
 */
export function UpNextCardMobile({
  nextEpisode, countdownSeconds, countdownTotalMs, controlsVisible, onPlay, onDismiss,
}: Props) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const { width: screenW } = useWindowDimensions();
  const reduced = motion.isReducedMotion();

  // Entrée (fondu + montée) et esquive de l'habillage — transform/opacity only.
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); };
  }, [enter, reduced]);
  useEffect(() => {
    const animation = Animated.timing(lift, {
      toValue: controlsVisible ? 1 : 0,
      duration: reduced ? 0 : 200,
      useNativeDriver: true,
    });
    animation.start();
    return () => { animation.stop(); };
  }, [controlsVisible, lift, reduced]);

  const armed = useArmedCountdown(countdownSeconds, countdownTotalMs);

  const thumbUrl = client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 85 });
  const isEpisode = nextEpisode.Type === "Episode";
  const episodeLabel = isEpisode && nextEpisode.ParentIndexNumber != null && nextEpisode.IndexNumber != null
    ? `S${String(nextEpisode.ParentIndexNumber).padStart(2, "0")}E${String(nextEpisode.IndexNumber).padStart(2, "0")}`
    : null;

  const cardW = Math.min(isTablet ? 420 : 340, screenW - insets.left - insets.right - 32);
  const bottom = Math.max(16, insets.bottom + 12);
  const right = Math.max(16, insets.right + 12);

  return (
    <Animated.View
      style={[
        st.wrap,
        { bottom, right, width: cardW, opacity: enter },
        {
          transform: [
            { translateY: Animated.add(
              enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
              lift.interpolate({ inputRange: [0, 1], outputRange: [0, -72] }),
            ) },
          ],
        },
      ]}
    >
      <View style={st.card}>
        <View style={st.thumbWrap}>
          <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          {/* La vignette fond dans la surface de la carte, comme sur le web. */}
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(15,15,21,0.55)", "rgba(15,15,21,0.96)"]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={st.badge}>
            <View style={st.badgeDot} />
            <Text style={st.badgeText}>{t("upNext")}</Text>
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t("dismiss")}
            hitSlop={8}
            style={({ pressed }) => [st.cross, pressed && { opacity: 0.75 }]}
          >
            <X size={18} color={PLAYER.text} />
          </Pressable>
        </View>

        <View style={st.body}>
          {episodeLabel && <Text style={st.eyebrow}>{episodeLabel}</Text>}
          <Text style={st.title} numberOfLines={2}>{nextEpisode.Name}</Text>
          <OverlayPill
            key={armed?.key ?? "manual"}
            label={
              countdownSeconds !== null
                ? t("playNowIn", { seconds: countdownSeconds })
                : t("playNow")
            }
            onPress={onPlay}
            countdownMs={armed?.remainingMs ?? null}
            initialProgress={armed?.initialProgress ?? 0}
            fullWidth
            icon={<Play size={15} color={PLAYER.textInverse} fill={PLAYER.textInverse} />}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 55 },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(15, 15, 21, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  thumbWrap: { aspectRatio: 16 / 7, backgroundColor: "#16131c" },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.9)" },
  badgeText: {
    color: PLAYER.text,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  cross: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  body: { padding: 14, paddingTop: 10, gap: 8 },
  eyebrow: {
    color: PLAYER.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: { color: PLAYER.text, fontSize: 15, fontWeight: "700" },
});
