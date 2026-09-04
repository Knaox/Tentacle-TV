import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useTheme,
  useThemedStyles,
  withAlpha,
  type AppTheme,
} from "@/theme";

interface Props {
  onDismiss: () => void;
}

/**
 * Bandeau haut NON bloquant « clé TMDB manquante » (parité web
 * TmdbKeyBanner) — teinte d'information, masquable. Sans clé, les
 * recommandations restent génériques pour tous les comptes ; la clé se pose
 * depuis l'admin web. Affiché aux admins seulement, via l'appelant ; les
 * utilisateurs normaux ne voient rien.
 */
export function TmdbKeyBanner({ onDismiss }: Props) {
  const { t } = useTranslation("admin");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  return (
    <Animated.View entering={FadeInUp.duration(280)} style={[st.wrap, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
      <View style={st.row}>
        <Feather name="key" size={18} color={theme.colors.statusPairs.info.fg} style={st.icon} />
        <View style={st.textWrap}>
          <Text style={st.title}>{t("tmdbKeyTitle")}</Text>
          <Text style={st.message}>{t("tmdbKeyMessage")}</Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("tmdbKeyDismiss")}
          style={st.close}
        >
          <Feather name="x" size={18} color={theme.colors.text.secondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 900,
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.md,
      backgroundColor: t.colors.statusPairs.info.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withAlpha(t.colors.statusPairs.info.fg, 0.35, t.colors.border.strong),
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: t.colors.surface.s1,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(t.colors.statusPairs.info.fg, 0.3, t.colors.border.strong),
      padding: spacing.md,
    },
    icon: { marginTop: 1 },
    textWrap: { flex: 1 },
    title: { ...typography.bodyBold, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    message: { ...typography.small, color: t.colors.text.secondary, marginTop: 3, lineHeight: 17 },
    close: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  });
