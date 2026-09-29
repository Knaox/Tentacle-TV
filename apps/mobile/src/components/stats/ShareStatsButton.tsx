import { Pressable, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Partager » sous le titre de « Vos statistiques » — la pilule de « Partager
 * ma liste » (aplat `brand.soft`, liseré `brand.glow`, texte `brand.light`) :
 * repérable sans être l'action principale. Elle ouvre la feuille de partage
 * des statistiques, qui dit ce qui devient public avant le moindre lien.
 */
export function ShareStatsButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation("statsShare");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("title")}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [st.btn, pressed && st.pressed]}
    >
      <Feather name="share-2" size={15} color={colors.brand.light} />
      <Text style={st.label}>{t("button")}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    btn: {
      alignSelf: "flex-start",
      height: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
      backgroundColor: t.colors.brand.soft,
    },
    pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
  });
