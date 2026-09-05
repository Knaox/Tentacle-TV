import { memo, useMemo } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSaveRecoProviderFilter } from "@tentacle-tv/api-client";
import { familyOfProviderId } from "@tentacle-tv/shared";
import { typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  providerFilter: readonly number[];
}

/**
 * La puce du filtre de plateformes, à côté du titre de la première rangée
 * reco servie : les noms des familles actives (sans réseau — l'id principal
 * de chaque famille est dans la constante partagée) et une croix qui retire
 * le filtre DU COMPTE — donc aussi sur le web et la TV. Rien sans filtre.
 */
export const RecoFilterChip = memo(function RecoFilterChip({ providerFilter }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const save = useSaveRecoProviderFilter();
  const label = useMemo(() => {
    const names = providerFilter.map((id) => familyOfProviderId(id)?.label).filter((n): n is string => !!n);
    return names.length > 0 ? names.join(" · ") : t("homeFilterGeneric");
  }, [providerFilter, t]);
  if (providerFilter.length === 0) return null;

  return (
    <Pressable
      onPress={() => save.mutate([])}
      hitSlop={6}
      style={st.chip}
      accessibilityRole="button"
      accessibilityLabel={t("homeFilterRemove")}
    >
      <Text style={st.text} numberOfLines={1}>{label}</Text>
      <Feather name="x" size={12} color={theme.colors.brand.violet} />
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  chip: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: t.colors.brand.soft,
    borderWidth: 1,
    borderColor: withAlpha(t.colors.brand.violet, 0.5, t.colors.brand.glow),
  },
  text: { ...typography.caption, color: t.colors.brand.violet, fontWeight: "600", lineHeight: 16, flexShrink: 1 },
});
