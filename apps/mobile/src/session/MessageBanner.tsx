import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { MessageCountdown } from "./useMessageCountdown";

interface Props {
  header: string;
  text: string;
  /** Message temporaire : son compte à rebours ; `null` = jusqu'à fermeture. */
  countdown?: MessageCountdown | null;
  onDismiss?: () => void;
  /** Tenu sous le doigt : le compte à rebours se suspend. */
  onHold?: (held: boolean) => void;
  /** Aperçu figé (rédaction du tableau de bord) : ni geste, ni barre qui file. */
  still?: boolean;
  /** Durée totale d'un message temporaire, pour l'aperçu figé. */
  durationMs?: number | null;
}

/**
 * Le bandeau d'un message de l'administrateur — le même que celui du web :
 * surface pleine, liseré net, barre de marque à gauche ; un message
 * temporaire dit ses secondes et vide une barre au pied. Exporté seul pour
 * l'aperçu de la rédaction (tableau de bord mobile).
 *
 * Aucune transparence composée sur la vidéo : la surface est opaque, comme
 * sur le bureau — le bandeau se lit sur n'importe quelle image.
 */
export const MessageBanner = memo(function MessageBanner({
  header, text, countdown = null, onDismiss, onHold, still = false, durationMs = null,
}: Props) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const temporary = countdown !== null || (still && durationMs !== null);
  const seconds = countdown?.secondsLeft ?? Math.ceil((durationMs ?? 0) / 1000);
  const heldNow = countdown !== null && !countdown.running;

  // La barre se vide sur le fil UI ; tenue, elle s'arrête là où elle en est.
  const progress = useSharedValue(1);
  const running = countdown?.running ?? false;
  useEffect(() => {
    if (!countdown || still) return;
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    const total = durationMs ?? 0;
    const remaining = countdown.remainingMs();
    if (total > 0) progress.value = remaining / total;
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <Pressable
      disabled={still}
      onPressIn={() => onHold?.(true)}
      onPressOut={() => onHold?.(false)}
      accessibilityRole="alert"
      accessibilityLabel={[t("messageFrom"), header, text].filter(Boolean).join(". ")}
      style={st.card}
    >
      <View style={st.accent} />
      <View style={st.body}>
        <View style={st.topRow}>
          <Feather name="message-square" size={13} color={theme.colors.brand.light} />
          <Text style={st.label} numberOfLines={1}>{t("messageFrom")}</Text>
        </View>
        {header !== "" && <Text style={st.header}>{header}</Text>}
        <Text style={st.text}>{text}</Text>
        {/* Au pied, au-dessus de la barre qui se vide : le libellé garde toute
            la largeur de l'en-tête, même sur un petit iPhone. */}
        {temporary && (
          <View style={st.countdown}>
            <Feather name={heldNow ? "pause" : "clock"} size={11} color={theme.colors.text.tertiary} />
            <Text style={st.countdownTxt}>
              {heldNow ? t("vanishHeld", { count: seconds }) : t("vanishesIn", { count: seconds })}
            </Text>
          </View>
        )}
      </View>
      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("dismissMessage")}
          style={({ pressed }) => [st.close, pressed && st.pressed]}
        >
          <Feather name="x" size={18} color={theme.colors.text.secondary} />
        </Pressable>
      )}
      {temporary && (
        <View style={st.track} pointerEvents="none">
          <Animated.View style={[st.bar, still ? null : barStyle]} />
        </View>
      )}
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row" as const,
      width: "100%" as const,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s2,
      overflow: "hidden" as const,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: t.isDark ? 0.45 : 0.14,
      shadowRadius: 18,
      elevation: 10,
    },
    accent: { width: 3, backgroundColor: t.colors.brand.violet },
    body: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md, paddingRight: 4, gap: 4 },
    topRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, minHeight: 18 },
    label: {
      flexShrink: 1,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: "uppercase" as const,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
    },
    countdown: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, marginTop: 4 },
    countdownTxt: { fontSize: 11, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    header: { fontSize: 15, lineHeight: 20, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    text: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    close: { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const },
    pressed: { opacity: 0.6 },
    track: { position: "absolute" as const, left: 0, right: 0, bottom: 0, height: 3, backgroundColor: t.colors.fill.subtle },
    bar: { height: 3, backgroundColor: t.colors.brand.violet, transformOrigin: "left" },
  });
