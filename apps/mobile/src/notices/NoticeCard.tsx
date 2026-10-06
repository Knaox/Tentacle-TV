import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { NoticeSeverity } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { MessageCountdown } from "@/session/useMessageCountdown";

export interface NoticeCardAction {
  label: string;
  onPress: () => void;
}

export type NoticeIcon = "server" | "key" | "check" | "alert-triangle" | "activity" | "info" | "wifi-off";

/** Les sévérités de la politique partagée, plus la réussite d'un message bref (`toastStore`). */
export type NoticeCardSeverity = NoticeSeverity | "success";

interface Props {
  severity: NoticeCardSeverity;
  icon: NoticeIcon;
  title?: string;
  lines: string[];
  primary?: NoticeCardAction;
  secondary?: NoticeCardAction;
  onClose: () => void;
  /** Le compte à rebours d'un avertissement qui s'efface seul ; `null` : il reste. */
  countdown: MessageCountdown | null;
  durationMs: number | null;
  /**
   * `player` : posée sur la vidéo — sombre EN DUR dans les deux thèmes, comme
   * tout ce que dessine le lecteur (une carte claire sur un film éblouirait).
   */
  surface?: "app" | "player";
}

/**
 * Un avertissement surgissant — la même famille que les messages de
 * l'administrateur : surface pleine, liseré, barre de couleur à gauche (rouge
 * pour une panne, ambre pour une recommandation, vert pour une réussite), puis la barre qui se vide
 * quand il s'efface seul. La croix (44 pt) reste toujours là ; glisser vers le
 * haut ou sur le côté ferme aussi.
 */
export const NoticeCard = memo(function NoticeCard({
  severity, icon, title, lines, primary, secondary, onClose, countdown, durationMs, surface = "app",
}: Props) {
  const onVideo = surface === "player";
  const { t } = useTranslation("notices");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const pair = severity === "blocking" ? theme.colors.statusPairs.error : severity === "recommendation"
    ? theme.colors.statusPairs.warning : severity === "success" ? theme.colors.statusPairs.success : theme.colors.statusPairs.info;
  const accent = severity === "blocking" ? theme.colors.status.error : severity === "recommendation"
    ? theme.colors.status.warning : severity === "success" ? theme.colors.status.success : theme.colors.brand.violet;

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
    <View style={[st.card, onVideo && onVideoStyles.card]}>
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
            {title ? <Text style={[st.title, onVideo && onVideoStyles.title]}>{title}</Text> : null}
            {lines.map((line, index) => <Text key={index} style={[st.text, onVideo && onVideoStyles.text]}>{line}</Text>)}
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
              <Pressable onPress={secondary.onPress} accessibilityRole="button" accessibilityLabel={secondary.label} style={({ pressed }) => [st.action, onVideo && onVideoStyles.action, pressed && st.pressed]}>
                <Text style={[st.actionTxt, onVideo && onVideoStyles.title]}>{secondary.label}</Text>
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
        <Feather name="x" size={18} color={onVideo ? PLAYER.textSecondary : theme.colors.text.secondary} />
      </Pressable>
      {countdown ? (
        <View style={[st.track, onVideo && onVideoStyles.track]} pointerEvents="none">
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

/** La surface posée sur la vidéo : les couleurs du lecteur, identiques dans les deux thèmes. */
const onVideoStyles = StyleSheet.create({
  card: { backgroundColor: "rgba(12, 10, 20, 0.92)", borderColor: PLAYER.border },
  title: { color: PLAYER.text },
  text: { color: PLAYER.textSecondary },
  action: { borderColor: PLAYER.border },
  track: { backgroundColor: PLAYER.fillSoft },
});
