import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Invité · famille de X » — un profil invité de la Famille ne paraît dans
 * AUCUNE liste du serveur, sauf les sessions en cours : là, il se dit tel. Le
 * serveur pose `familyGuestOf` (le nom du propriétaire) ; absent d'un serveur
 * d'avant la Famille, rien ne s'affiche. Le jumeau du web (`FamilyGuestTag`).
 */
export const FamilyGuestTag = memo(function FamilyGuestTag({ owner }: { owner: string | null | undefined }) {
  const { t } = useTranslation("family");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  if (!owner) return null;
  return (
    <View style={st.tag}>
      <Feather name="users" size={11} color={theme.colors.brand.light} />
      <Text style={st.text} numberOfLines={1}>{t("guestOf", { owner })}</Text>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    tag: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      maxWidth: "100%",
      gap: 4,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.brand.soft,
    },
    text: { fontFamily: FONT_FAMILY.semibold, fontSize: 11, color: t.colors.brand.light, flexShrink: 1 },
  });
