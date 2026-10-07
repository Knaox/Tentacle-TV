import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLiquidGlassEnabled } from "../../glass/liquidGlassMode";
import { GlassPreview } from "./GlassPreview";
import { LiteModeSection } from "./LiteModeSection";
import { SectionTitle } from "./settingsParts";
import { ToggleRow } from "./ToggleRow";
import type { SettingsRenderTier } from "./settingsTypes";

/**
 * L'onglet Apparence : l'interrupteur Liquid Glass, dans le même sens que le
 * bureau et le mobile — activé par défaut ; coupé, les surfaces passent au
 * verre ENRICHI (plus dense, liseré, reflet), jamais à une surface opaque.
 *
 * La valeur affichée est celle du fournisseur (`useLiquidGlassEnabled`) : la
 * vue ne lit aucun stockage. Branchement : `LiquidGlassProvider` sur la clé
 * `tentacle_liquid_glass` (`LIQUID_GLASS_STORAGE_KEY`), que `onToggle` écrit.
 *
 * Android TV n'a pas Liquid Glass (`liquidGlass` faux) mais le mode Lite
 * (`renderTier`) : l'onglet n'y montre que lui. L'Apple TV n'a pas le mode
 * Lite : rien n'y change.
 */

export const AppearancePanel = memo(function AppearancePanel({ width, previewImageUri, onToggleLiquidGlass, liquidGlass = true, renderTier, onSelectLiteMode }: {
  /** Largeur utile du panneau (l'aperçu s'y partage en deux). */
  width: number;
  previewImageUri?: string;
  onToggleLiquidGlass?: (next: boolean) => void;
  /** Faux : ni le réglage Liquid Glass ni son aperçu (Android TV). */
  liquidGlass?: boolean;
  /** Le mode Lite (Android TV) ; absent : la section n'existe pas. */
  renderTier?: SettingsRenderTier | null;
  onSelectLiteMode?: (mode: SettingsRenderTier["mode"]) => void;
}) {
  const { t } = useTranslation("preferences");
  const liquid = useLiquidGlassEnabled();
  return (
    <View style={styles.root}>
      {renderTier ? <LiteModeSection model={renderTier} onSelectMode={onSelectLiteMode} /> : null}
      {liquidGlass ? <View>
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
      </View> : null}
      {liquidGlass ? <View>
        <SectionTitle title={t("previewTitle")} />
        <GlassPreview width={width} liquid={liquid} imageUri={previewImageUri} />
      </View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 52 },
});
