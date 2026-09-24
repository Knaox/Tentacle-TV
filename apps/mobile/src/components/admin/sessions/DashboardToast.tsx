import { memo, useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

export interface DashboardToastState {
  id: number;
  tone: "success" | "error";
  text: string;
}

const VISIBLE_MS = 3_200;

/**
 * Le verdict d'un geste qui ne se voit pas sur une carte — « Message envoyé
 * à Alice », « Arrêt reçu par 2 lecteurs sur 3 » : un bandeau bref en bas
 * d'écran, annoncé au lecteur d'écran, qui ne vole jamais le focus.
 */
export function useDashboardToast() {
  const [toast, setToast] = useState<DashboardToastState | null>(null);
  const show = useCallback((tone: DashboardToastState["tone"], text: string) => {
    setToast({ id: Date.now(), tone, text });
    AccessibilityInfo.announceForAccessibility(text);
  }, []);
  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  return { toast, show };
}

export const DashboardToast = memo(function DashboardToast({ toast }: { toast: DashboardToastState | null }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  if (toast === null) return null;
  const pair = theme.colors.statusPairs[toast.tone === "success" ? "success" : "error"];
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      pointerEvents="none"
      style={[st.toast, { bottom: insets.bottom + spacing.lg }]}
    >
      <Feather name={toast.tone === "success" ? "check-circle" : "alert-circle"} size={16} color={pair.fg} />
      <Text style={st.text} numberOfLines={2}>{toast.text}</Text>
    </Animated.View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    toast: {
      position: "absolute" as const,
      left: spacing.screenPadding,
      right: spacing.screenPadding,
      alignSelf: "center" as const,
      maxWidth: 520,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: t.isDark ? 0.45 : 0.15,
      shadowRadius: 18,
      elevation: 8,
    },
    text: { flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  });
