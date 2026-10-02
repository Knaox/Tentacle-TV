import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Demander les saisons manquantes » d'une série incomplète, sous la lecture
 * de la feuille d'appui long (`overlay.request`) : au ton de la marque mais
 * EN RETRAIT d'elle — un verre teinté et cerclé, la lecture restant la seule
 * action pleine au dégradé — et le nombre de saisons à demander à droite.
 */
export const SheetRequestButton = memo(function SheetRequestButton({ count, title, onPress }: {
  count: number;
  /** Le titre de la carte, pour les lecteurs d'écran. */
  title: string;
  onPress: () => void;
}) {
  const { t } = useTranslation("requests");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const color = theme.colors.brand.light;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t("requestMissing")} — ${title}`}
      accessibilityHint={t("missingSeasons", { count })}
      style={({ pressed }) => [st.pill, pressed && { opacity: 0.8 }]}
    >
      <Feather name="plus" size={18} color={color} />
      <Text style={[st.label, { color }]} numberOfLines={1}>{t("requestMissing")}</Text>
      <View style={st.count}>
        <Text style={[st.countText, { color }]}>{count}</Text>
      </View>
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      minHeight: 48,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 10,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
    },
    label: { flexShrink: 1, fontSize: 15, fontFamily: FONT_FAMILY.bold },
    count: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 7,
      borderRadius: 12,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.fill.soft,
    },
    countText: { fontSize: 13, fontFamily: FONT_FAMILY.bold, fontVariant: ["tabular-nums"] },
  });
