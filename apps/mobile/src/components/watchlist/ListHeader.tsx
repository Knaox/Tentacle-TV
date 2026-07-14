import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import {
  spacing,
  typography,
  FONT_FAMILY,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

type FeatherName = keyof typeof Feather.glyphMap;

interface Props {
  title: string;
  subtitle?: string;
  /** Icône Feather optionnelle à gauche du titre (taille 20pt, violet light). */
  titleIcon?: FeatherName;
  onBack: () => void;
  onEnterSelection: () => void;
  canSelect: boolean;
}

/**
 * Header partagé Watchlist / Favoris : back pill + titre Inter ExtraBold +
 * sous-titre violet + bouton sélection optionnel. Touch targets ≥44pt.
 */
export function ListHeader({
  title,
  subtitle,
  titleIcon,
  onBack,
  onEnterSelection,
  canSelect,
}: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel={t("back")}
        hitSlop={6}
      >
        <Feather name="chevron-left" size={22} color={colors.text.primary} />
      </Pressable>
      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          {titleIcon && <Feather name={titleIcon} size={20} color={colors.brand.light} />}
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {canSelect && (
        <Pressable
          onPress={onEnterSelection}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={t("selectAll")}
          hitSlop={6}
        >
          <Feather name="check-square" size={18} color={colors.brand.light} />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.surface.s1,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      alignItems: "center",
      justifyContent: "center",
    },
    titleBlock: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { fontSize: 28, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.7 },
    subtitle: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.medium,
      color: t.colors.brand.light,
      marginTop: 4,
      letterSpacing: 0.3,
    },
  });
