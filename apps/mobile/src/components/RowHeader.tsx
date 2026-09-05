import { memo } from "react";
import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  title: string;
  onSeeAll?: () => void;
  /** Juste après le titre, toujours visible (la puce du filtre de plateformes). */
  accessory?: ReactNode;
}

/**
 * L'en-tête d'une rangée de l'accueil — heading-3 + lien « Voir tout » chevron
 * violet — extrait de `MediaRow` pour servir aussi aux rangées de
 * recommandation, dont les items ne sont pas des MediaItem.
 */
export const RowHeader = memo(function RowHeader({ title, onSeeAll, accessory }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.header}>
      <View style={st.lead}>
        <Text style={st.title} numberOfLines={1}>{title}</Text>
        {accessory}
      </View>
      {onSeeAll != null && (
        <Pressable onPress={onSeeAll} hitSlop={10} style={st.seeAllBtn}>
          <Text style={st.seeAll}>{t("seeAll")}</Text>
          <Feather name="chevron-right" size={14} color={colors.brand.light} />
        </Pressable>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 14,
  },
  // Titre + accessoire : le titre cède la place à la puce, jamais l'inverse.
  lead: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  title: {
    ...typography.subtitle,
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    color: t.colors.text.primary,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 8,
  },
  seeAll: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.semibold,
    color: t.colors.brand.light,
    letterSpacing: 0.1,
  },
});
