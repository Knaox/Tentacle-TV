import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Ce que montre la page publique, dans l'ordre de la page — les mêmes clés que le web. */
const PUBLIC_KEYS = ["public_time", "public_profile", "public_tastes", "public_titles", "public_records", "public_loves"] as const;
/** Ce que le serveur garde : la réponse publique ne le contient pas. */
const PRIVATE_KEYS = ["private_hours", "private_devices", "private_dates", "private_place", "private_list"] as const;

/**
 * Ce que le propriétaire voit AVANT de partager : ce qui devient public, et ce
 * qui reste privé quoi qu'il arrive. L'icône et le titre portent le sens, la
 * couleur ne fait que l'appuyer.
 */
export const StatsPrivacyLists = memo(function StatsPrivacyLists() {
  const { t } = useTranslation("statsShare");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const column = (title: string, keys: readonly string[], icon: "check" | "lock", color: string) => (
    <View style={st.column} accessible accessibilityLabel={`${title} : ${keys.map((k) => t(k)).join(", ")}`}>
      <Text style={st.heading}>{title}</Text>
      {keys.map((key) => (
        <View key={key} style={st.row}>
          <Feather name={icon} size={14} color={color} style={st.icon} />
          <Text style={st.text}>{t(key)}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={st.box}>
      {column(t("publicTitle"), PUBLIC_KEYS, "check", colors.brand.light)}
      {column(t("privateTitle"), PRIVATE_KEYS, "lock", colors.text.tertiary)}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    box: {
      gap: spacing.lg,
      padding: spacing.md,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.faint,
    },
    column: { gap: 6 },
    heading: {
      ...typography.small,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: t.colors.text.tertiary,
      marginBottom: 2,
    },
    row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    icon: { marginTop: 2 },
    text: { ...typography.caption, flex: 1, lineHeight: 18, color: t.colors.text.secondary },
  });
