import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { NoticeSeverity } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { MessageCountdown } from "@/session/useMessageCountdown";

export interface NoticeCardAction {
  label: string;
  onPress: () => void;
}

export type NoticeIcon = "server" | "key" | "check" | "alert-triangle";

interface Props {
  severity: NoticeSeverity;
  icon: NoticeIcon;
  title?: string;
  lines: string[];
  primary?: NoticeCardAction;
  secondary?: NoticeCardAction;
  onClose: () => void;
  /** Le compte à rebours d'un avertissement qui s'efface seul ; `null` : il reste. */
  countdown: MessageCountdown | null;
  durationMs: number | null;
}

/**
 * Un avertissement surgissant — la même famille que les messages de
 * l'administrateur : surface pleine, liseré, barre de couleur à gauche (rouge
 * pour une panne, ambre pour une recommandation), puis la barre qui se vide
 * quand il s'efface seul. La croix (44 pt) reste toujours là ; glisser vers le
 * haut ou sur le côté ferme aussi.
 */
export const NoticeCard = memo(function NoticeCard({
  severity, icon, title, lines, primary, secondary, onClose, countdown, durationMs,
}: Props) {
  const { t } = useTranslation("notices");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const pair = severity === "blocking" ? theme.colors.statusPairs.error : severity === "recommendation"
    ? theme.colors.statusPairs.warning : theme.colors.statusPairs.info;
  const accent = severity === "blocking" ? theme.colors.status.error : severity === "recommendation"
    ? theme.colors.status.warning : theme.colors.brand.violet;

  // La barre se vide sur le fil UI ; tenue, elle s'arrête là où elle en est.
  const progress = useSharedValue(1);
  const running = countdown?.running ?? false;
  useEffect(() => {
    if (!countdown) return;
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    const remaining = countdown.remainingMs();
    if (durationMs) progress.value = remaining / durationMs;
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <View style={st.card}>
      <View style={[st.accent, { backgroundColor: accent }]} />
      <View style={st.body}>
        <View
          accessible
          accessibilityRole={severity === "blocking" ? "alert" : "summary"}
          accessibilityLabel={[title, ...lines].filter(Boolean).join(". ")}
          style={st.head}
        >
          <View style={[st.chip, { backgroundColor: pair.bg }]}>
            <Feather name={icon} size={16} color={pair.fg} />
          </View>
          <View style={st.texts}>
            {title ? <Text style={st.title}>{title}</Text> : null}
            {lines.map((line, index) => <Text key={index} style={st.text}>{line}</Text>)}
          </View>
        </View>
        {primary || secondary ? (
          <View style={st.actions}>
            {primary ? (
              <Pressable onPress={primary.onPress} accessibilityRole="button" accessibilityLabel={primary.label} style={({ pressed }) => [st.action, st.actionPrimary, pressed && st.pressed]}>
                <Text style={st.actionPrimaryTxt}>{primary.label}</Text>
              </Pressable>
            ) : null}
            {secondary ? (
              <Pressable onPress={secondary.onPress} accessibilityRole="button" accessibilityLabel={secondary.label} style={({ pressed }) => [st.action, pressed && st.pressed]}>
                <Text style={st.actionTxt}>{secondary.label}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
        style={({ pressed }) => [st.close, pressed && st.pressed]}
      >
        <Feather name="x" size={18} color={theme.colors.text.secondary} />
      </Pressable>
      {countdown ? (
        <View style={st.track} pointerEvents="none">
          <Animated.View style={[st.bar, { backgroundColor: accent }, barStyle]} />
        </View>
      ) : null}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      width: "100%",
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s2,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: t.isDark ? 0.45 : 0.14,
      shadowRadius: 18,
      elevation: 10,
    },
    accent: { width: 3 },
    body: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md, gap: spacing.sm },
    head: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    chip: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1 },
    texts: { flex: 1, gap: 3 },
    title: { fontSize: 15, lineHeight: 20, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    text: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingLeft: 36 },
    action: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      flexShrink: 1,
    },
    actionPrimary: { backgroundColor: t.colors.cta.primaryBg, borderColor: t.colors.cta.primaryBorder ?? "transparent" },
    actionPrimaryTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.cta.primaryFg },
    actionTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    pressed: { opacity: 0.7 },
    close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: t.colors.fill.subtle },
    bar: { height: 3, transformOrigin: "left" },
  });
