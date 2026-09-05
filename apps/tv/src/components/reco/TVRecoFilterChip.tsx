import { memo, useMemo } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useRecoSettings, useSaveRecoProviderFilter } from "@tentacle-tv/api-client";
import { familyOfProviderId } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { CloseIcon } from "../icons/TVIcons";
import { Colors, Radius, brandAlpha } from "../../theme/colors";

/**
 * La pastille du filtre de plateformes, à côté du titre de la première rangée
 * reco servie — FOCALISABLE : HAUT depuis les premières cartes la trouve, OK
 * retire le filtre du COMPTE (donc aussi sur le web et le mobile). Les noms
 * viennent de la constante partagée (sans réseau). Rien sans filtre. Motif de
 * la FilterChip des bibliothèques (état actif en teinte de marque).
 */
export const TVRecoFilterChip = memo(function TVRecoFilterChip() {
  const { t } = useTranslation("reco");
  const { data: settings } = useRecoSettings();
  const save = useSaveRecoProviderFilter();
  const providerFilter = settings?.providerFilter;
  const label = useMemo(() => {
    const names = (providerFilter ?? []).map((id) => familyOfProviderId(id)?.label).filter((n): n is string => !!n);
    return names.length > 0 ? names.join(" · ") : t("homeFilterGeneric");
  }, [providerFilter, t]);
  if (!providerFilter || providerFilter.length === 0) return null;

  return (
    <Focusable
      variant="button"
      focusRadius={Radius.pill}
      onPress={() => save.mutate([])}
      accessibilityLabel={t("homeFilterRemove")}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 14,
          paddingRight: 10,
          paddingVertical: 6,
          borderRadius: Radius.pill,
          backgroundColor: brandAlpha(0.24),
          borderWidth: 1,
          borderColor: brandAlpha(0.6),
        }}
      >
        <Text style={{ color: Colors.accentPurpleLight, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
          {label}
        </Text>
        <CloseIcon size={14} color={Colors.accentPurpleLight} />
      </View>
    </Focusable>
  );
});
