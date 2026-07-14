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
  serverVersion: string | null;
  onDismiss: () => void;
}

/**
 * Bandeau haut NON bloquant « serveur à mettre à jour » (parité web
 * VersionBanner) — teinte d'alerte ambre, masquable. L'app reste utilisable.
 * Distinct d'OfflineBanner (plein écran, perte de connexion). Affiché aux
 * admins seulement (seuls à pouvoir mettre à jour le serveur) via l'appelant.
 */
export function ServerOutdatedBanner({ serverVersion, onDismiss }: Props) {
  const { t } = useTranslation("admin");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  return (
    <Animated.View
      entering={FadeInUp.duration(280)}
      style={[st.wrap, { paddingTop: Math.max(insets.top, 24) + 8 }]}
      accessibilityRole="alert"
    >
      <View style={st.row}>
        <Feather name="alert-triangle" size={18} color={theme.colors.status.warning} style={st.icon} />
        <View style={st.textWrap}>
          <Text style={st.title}>{t("serverOutdatedTitle")}</Text>
          <Text style={st.message}>{t("serverOutdatedMessage", { server: serverVersion ?? "?" })}</Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("serverOutdatedDismiss")}
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
      backgroundColor: t.colors.statusPairs.warning.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withAlpha(t.colors.status.warning, 0.35, t.colors.border.strong),
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: t.colors.surface.s1,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(t.colors.status.warning, 0.3, t.colors.border.strong),
      padding: spacing.md,
    },
    icon: { marginTop: 1 },
    textWrap: { flex: 1 },
    title: {
      ...typography.bodyBold,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.primary,
    },
    message: {
      ...typography.small,
      color: t.colors.text.secondary,
      marginTop: 3,
      lineHeight: 17,
    },
    close: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
  });
