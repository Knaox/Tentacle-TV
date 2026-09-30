import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLiquidGlassEnabled } from "../../glass/liquidGlassMode";
import { GlassPreview } from "./GlassPreview";
import { SectionTitle } from "./settingsParts";
import { ToggleRow } from "./ToggleRow";

/**
 * L'onglet Apparence : l'interrupteur Liquid Glass, dans le même sens que le
 * bureau et le mobile — activé par défaut ; coupé, les surfaces passent au
 * verre ENRICHI (plus dense, liseré, reflet), jamais à une surface opaque.
 *
 * La valeur affichée est celle du fournisseur (`useLiquidGlassEnabled`) : la
 * vue ne lit aucun stockage. Branchement : `LiquidGlassProvider` sur la clé
 * `tentacle_liquid_glass` (`LIQUID_GLASS_STORAGE_KEY`), que `onToggle` écrit.
 */

export const AppearancePanel = memo(function AppearancePanel({ width, previewImageUri, onToggleLiquidGlass }: {
  /** Largeur utile du panneau (l'aperçu s'y partage en deux). */
  width: number;
  previewImageUri?: string;
  onToggleLiquidGlass?: (next: boolean) => void;
}) {
  const { t } = useTranslation("preferences");
  const liquid = useLiquidGlassEnabled();
  return (
    <View style={styles.root}>
      <View>
        <SectionTitle title={t("effects")} />
        <ToggleRow
          icon="droplet"
          title={t("liquidGlassTitle")}
          description={t("liquidGlassDescription")}
          value={liquid}
          onLabel={t("reglageActive")}
          offLabel={t("reglageDesactive")}
          focusKey="settings:liquidGlass"
          onToggle={onToggleLiquidGlass}
        />
      </View>
      <View>
        <SectionTitle title={t("previewTitle")} />
        <GlassPreview width={width} liquid={liquid} imageUri={previewImageUri} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 52 },
});
