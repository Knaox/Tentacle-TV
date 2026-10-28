import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { SettingScope as CatalogScope } from "@tentacle-tv/shared";
import { RADIUS, spacing, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * La portée d'un réglage — celles du catalogue partagé (`settingsCatalog`, qui fait l'inventaire), plus `octave`
 * (un réglage d'Octave qui ne change rien à Tentacle : la page « Réglages d'Octave »), comme la pastille du web.
 */
export type SettingScope = CatalogScope | "octave";

const ICONS = { account: "cloud", device: "smartphone", octave: "music" } as const;

interface Props {
  scope: SettingScope;
}

/**
 * La pastille « Compte » / « Cet appareil » / « Octave seulement » : un mot ET une icône (nuage,
 * téléphone), jamais la couleur seule. Le compte prend la teinte de marque,
 * l'appareil reste neutre. Un composant unique, partagé par toutes les pages
 * de réglages du mobile (notifications comprises).
 */
export const ScopeBadge = memo(function ScopeBadge({ scope }: Props) {
  const { t } = useTranslation("settingsMobile");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const account = scope === "account";
  const tint = account ? theme.colors.brand.light : theme.colors.text.tertiary;
  return (
    <View
      style={[st.pill, account ? st.account : st.device]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t(`scope.${scope}A11y`)}
    >
      <Feather name={ICONS[scope]} size={10} color={tint} />
      <Text style={[st.label, { color: tint }]} numberOfLines={1}>
        {t(`scope.${scope}`)}
      </Text>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
    },
    account: { backgroundColor: t.colors.brand.soft, borderColor: t.colors.brand.soft },
    device: { backgroundColor: t.colors.fill.subtle, borderColor: t.colors.border.subtle },
    label: { fontSize: 11, lineHeight: 14, fontFamily: FONT_FAMILY.semibold },
  });
