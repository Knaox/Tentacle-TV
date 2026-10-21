import { useEffect, useRef, type ReactNode } from "react";
import { View, Text, Pressable, Animated, StyleSheet, AccessibilityInfo, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react-native";
import type { StillWatchingController } from "@tentacle-tv/api-client";
import { PLAYER, motion, useResponsive } from "../../theme";

interface Props {
  controller: StillWatchingController;
  /** L'habillage du lecteur est à l'écran — l'encart remonte au-dessus de la barre. */
  controlsVisible: boolean;
}

/**
 * « Vous regardez encore ? » — l'encart du lecteur mobile, dans le coin
 * bas-droit, À LA PLACE de la pilule de saut et de la carte « à suivre ».
 * Même surface opaque que `UpNextCardMobile` (jamais de flou sur la vidéo),
 * même esquive de l'habillage. Deux états : la question (décompte et barre
 * violet → rose qui se vide), puis « Lecture en pause » et « Reprendre ».
 *
 * Un toucher DANS l'encart n'est pas un geste « ailleurs » : il ne remonte
 * pas jusqu'à la surface (`onActivity`), sinon « Mettre en pause » serait
 * pris pour une réponse avant même d'être pressé.
 */
export function StillWatchingCardMobile({ controller, controlsVisible }: Props) {
  const { t } = useTranslation("player");
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const { width: screenW } = useWindowDimensions();
  const reduced = motion.isReducedMotion();
  const { phase, remainingMs, countdownMs } = controller;
  const asking = phase === "asking";

  // Entrée (fondu + montée) et esquive de l'habillage — transform/opacity seulement.
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const lift = useRef(new Animated.Value(controlsVisible ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); };
  }, [enter, reduced]);
  useEffect(() => {
    const animation = Animated.timing(lift, { toValue: controlsVisible ? 1 : 0, duration: reduced ? 0 : 200, useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); };
  }, [controlsVisible, lift, reduced]);

  // Le lecteur d'écran dit le changement d'état, une fois.
  const title = asking ? t("stillWatching.title") : t("stillWatching.pausedTitle");
  useEffect(() => { AccessibilityInfo.announceForAccessibility(title); }, [title]);

  const cardW = Math.min(isTablet ? 400 : 320, screenW - insets.left - insets.right - 32);
  const seconds = Math.ceil(remainingMs / 1000);
  const keepInside = (event: GestureResponderEvent) => { event.stopPropagation(); };

  return (
    <Animated.View
      onTouchStart={keepInside}
      style={[
        st.wrap,
        { bottom: Math.max(16, insets.bottom + 12), right: Math.max(16, insets.right + 12), width: cardW, opacity: enter },
        { transform: [{ translateY: Animated.add(
          enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
          lift.interpolate({ inputRange: [0, 1], outputRange: [0, -72] }),
        ) }] },
      ]}
    >
      <View style={st.card}>
        <Text style={[st.title, isTablet && st.titleTablet]} accessibilityRole="header">{title}</Text>
        <Text style={st.body}>
          {asking ? t("stillWatching.countdown", { count: seconds }) : t("stillWatching.pausedBody")}
        </Text>
        {asking && <CountdownBar remainingMs={remainingMs} countdownMs={countdownMs} reduced={reduced} />}
        <View style={st.actions}>
          {asking ? (
            <>
              <CardButton label={t("stillWatching.continue")} primary onPress={controller.keepWatching} />
              <CardButton label={t("stillWatching.pause")} onPress={controller.pauseNow}
                icon={<Pause size={15} color={PLAYER.text} fill={PLAYER.text} />} />
            </>
          ) : (
            <CardButton label={t("stillWatching.resume")} primary onPress={controller.resume}
              icon={<Play size={15} color={PLAYER.textInverse} fill={PLAYER.textInverse} />} />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * La barre du décompte : un dégradé de marque qui se VIDE en `scaleX`, au
 * pilote natif, lancé une fois depuis le temps qui reste. « Réduire les
 * animations » : la barre suit le décompte par paliers, sans glisser.
 */
function CountdownBar({ remainingMs, countdownMs, reduced }: { remainingMs: number; countdownMs: number; reduced: boolean }) {
  const ratio = countdownMs > 0 ? Math.min(1, remainingMs / countdownMs) : 0;
  const scale = useRef(new Animated.Value(ratio)).current;
  const startRef = useRef({ ratio, remainingMs });
  useEffect(() => {
    if (reduced) return;
    const { ratio: from, remainingMs: duration } = startRef.current;
    scale.setValue(from);
    const animation = Animated.timing(scale, { toValue: 0, duration, useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); };
  }, [reduced, scale]);
  useEffect(() => {
    if (reduced) scale.setValue(ratio);
  }, [reduced, ratio, scale]);

  return (
    <View style={st.track}>
      <Animated.View style={[st.fill, { transform: [{ scaleX: scale }] }]}>
        <LinearGradient colors={[PLAYER.accent, PLAYER.accentRose]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

function CardButton({ label, onPress, primary = false, icon }: { label: string; onPress: () => void; primary?: boolean; icon?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [st.button, primary ? st.primary : st.secondary, pressed && st.pressed]}
    >
      {icon}
      <Text style={[st.buttonLabel, primary && st.primaryLabel]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 60 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: "rgba(15, 15, 21, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  title: { color: PLAYER.text, fontSize: 16, fontWeight: "700" },
  titleTablet: { fontSize: 19 },
  // Chiffres tabulaires : la phrase du décompte ne bouge pas d'une seconde à l'autre.
  body: { color: PLAYER.textSecondary, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
  track: { height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: PLAYER.fillSoft, marginTop: 2 },
  fill: { ...StyleSheet.absoluteFillObject, transformOrigin: "left" },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  primary: { backgroundColor: PLAYER.text },
  secondary: { backgroundColor: PLAYER.fillSoft, borderWidth: 1, borderColor: PLAYER.border },
  pressed: { opacity: 0.8 },
  buttonLabel: { color: PLAYER.text, fontSize: 14, fontWeight: "700" },
  primaryLabel: { color: PLAYER.textInverse },
});
