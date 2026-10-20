import { memo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, spacing, useTheme } from "@/theme";
import { useButtonLook } from "@/components/ui/buttons";

/**
 * « Demander les saisons manquantes » d'une série incomplète, sous la lecture
 * de la feuille d'appui long (`overlay.request`) : un bouton SECONDAIRE du
 * système (capsule grise sur iOS, contour fin sur Android) — la lecture reste
 * la seule action en couleur de la feuille — avec le nombre de saisons à
 * demander à droite.
 */
export const SheetRequestButton = memo(function SheetRequestButton({ count, title, onPress }: {
  count: number;
  /** Le titre de la carte, pour les lecteurs d'écran. */
  title: string;
  onPress: () => void;
}) {
  const { t } = useTranslation("requests");
  const theme = useTheme();
  const look = useButtonLook("secondary", "lg");
  const color = look.fg;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t("requestMissing")} — ${title}`}
      accessibilityHint={t("missingSeasons", { count })}
      android_ripple={{ color: theme.colors.fill.medium, foreground: true }}
      style={({ pressed }) => [
        st.pill,
        look.shape,
        pressed && Platform.OS === "ios" && st.pressed,
      ]}
    >
      <Feather name="plus" size={look.iconSize} color={color} />
      <Text style={[st.label, { color, fontSize: look.fontSize }]} numberOfLines={1}>{t("requestMissing")}</Text>
      <View style={[st.count, { backgroundColor: theme.colors.fill.medium }]}>
        <Text style={[st.countText, { color }]}>{count}</Text>
      </View>
    </Pressable>
  );
});

const st = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  pressed: { opacity: 0.7 },
  label: { flexShrink: 1, fontFamily: FONT_FAMILY.semibold },
  count: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, fontVariant: ["tabular-nums"] },
});
