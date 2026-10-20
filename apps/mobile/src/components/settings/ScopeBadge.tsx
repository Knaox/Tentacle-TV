import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RADIUS, spacing, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * La PORTÉE d'un réglage : `account` suit le compte (préférence enregistrée
 * par le serveur, `/api/preferences/*` — le bureau, la TV et ce téléphone la
 * partagent), `device` ne vit que dans le stockage de cet appareil. La
 * pastille doit dire la VÉRITÉ : l'inventaire de chaque réglage est dans
 * `screens/profile/settingsScopes.ts`.
 */
export type SettingScope = "account" | "device";

interface Props {
  scope: SettingScope;
}

/**
 * La pastille « Compte » / « Cet appareil » : un mot ET une icône (nuage,
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
      accessibilityLabel={t(account ? "scope.accountA11y" : "scope.deviceA11y")}
    >
      <Feather name={account ? "cloud" : "smartphone"} size={10} color={tint} />
      <Text style={[st.label, { color: tint }]} numberOfLines={1}>
        {t(account ? "scope.account" : "scope.device")}
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
