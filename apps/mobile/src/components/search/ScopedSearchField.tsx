import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { AcceptCompletion, AssistedInput } from "./GhostCompletion";
import type { SearchAssist } from "./useSearchAssist";

interface Props {
  assist: SearchAssist;
  placeholder: string;
  /** Titres trouvés par le filtre de la page, au bout du champ — `null` : rien à dire. */
  count: number | null;
  /** La croix : vider — et, là où la barre se replie, la refermer. */
  onClear?: () => void;
  autoFocus?: boolean;
  /** Faux : le champ ne prend pas la marge d'écran — il partage une ligne. */
  inset?: boolean;
}

/**
 * La recherche DANS une page — une bibliothèque, Ma liste, Mes favoris — au
 * niveau de la barre du bureau 1.22.0 : une pilule opaque (le champ chevauche
 * souvent une affiche), l'icône et le liseré à la couleur de la marque au
 * focus, la suite du meilleur titre en gris (↳ l'accepte), le nombre de titres
 * trouvés au bout, une croix pour effacer.
 */
export const ScopedSearchField = memo(function ScopedSearchField({
  assist, placeholder, count, onClear, autoFocus = false, inset = true,
}: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { value, onChange, focused, completion } = assist;
  const active = value.trim().length > 0;

  return (
    <View style={inset ? st.wrap : st.bare} accessibilityRole="search">
      <View style={[st.field, focused && st.fieldFocused]}>
        <Feather
          name="search"
          size={16}
          color={focused || active ? theme.colors.brand.light : theme.colors.text.tertiary}
        />
        <AssistedInput
          value={value}
          onChangeText={onChange}
          completion={completion}
          textStyle={st.text}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
          onFocus={assist.onFocus}
          onBlur={assist.onBlur}
          accessibilityLabel={placeholder}
        />
        {completion !== null && <AcceptCompletion onAccept={assist.accept} />}
        {completion === null && active && count !== null && (
          <Text style={st.count} accessibilityLiveRegion="polite">{count}</Text>
        )}
        {(value !== "" || onClear) && (
          <Pressable
            onPress={onClear ?? (() => onChange(""))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("clearSearch")}
            style={st.clear}
          >
            <Feather name="x" size={14} color={theme.colors.text.secondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.screenPadding },
    bare: { flex: 1 },
    field: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      height: 44,
      paddingLeft: spacing.md,
      paddingRight: 8,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s2,
    },
    fieldFocused: { borderColor: t.colors.border.focus },
    text: { ...typography.body, fontSize: 15, fontFamily: FONT_FAMILY.regular, color: t.colors.text.primary },
    count: {
      ...typography.caption,
      paddingHorizontal: 4,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
      fontVariant: ["tabular-nums"],
    },
    clear: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.fill.soft,
    },
  });
