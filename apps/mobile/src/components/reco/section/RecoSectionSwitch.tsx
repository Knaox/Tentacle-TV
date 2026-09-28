import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SegmentedChoice } from "@/components/settings/SegmentedChoice";
import { spacing } from "@/theme";
import type { RecoSection } from "./useRecoSection";

interface Props {
  section: RecoSection;
  onChange: (next: RecoSection) => void;
}

/**
 * « Pour vous · Affiner » — les deux sections de l'onglet Pour vous.
 *
 * La pile de swipe NOURRIT les recommandations : elle vit à côté d'elles, pas
 * dans un onglet de plus (la barre en comptait six avec une extension, et
 * « Bibliothèque » s'y tronquait sur 375 pt). Le contrôle est celui de la
 * barre rapide de la bibliothèque (`SegmentedChoice`, variante compacte) :
 * le même geste, le même dessin, le même fondu de marque.
 */
export const RecoSectionSwitch = memo(function RecoSectionSwitch({ section, onChange }: Props) {
  const { t } = useTranslation("swipe");
  return (
    <View style={st.row}>
      <SegmentedChoice
        compact
        accessibilityLabel={t("sectionsLabel")}
        value={section}
        onChange={(v) => onChange(v === "refine" ? "refine" : "forYou")}
        options={[
          { value: "forYou", label: t("sectionForYou") },
          { value: "refine", label: t("sectionRefine") },
        ]}
      />
    </View>
  );
});

const st = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: spacing.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.sm },
});
