import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_TYPE } from "@tentacle-tv/theme";
import { fonts, white } from "../../theme/tokens";
import { PlayerSheet, SheetColumn, SheetDivider, SheetHeading } from "./PlayerSheet";
import type { SettingsPanelModel } from "./playerTypes";

/**
 * Le panneau « Réglages » du lecteur — la qualité de lecture et tout ce qui
 * n'est pas un choix de piste (décision du 2026-10-01 : rangée dans
 * « Pistes », la qualité ne se trouvait pas). La qualité : « Original » (le
 * fichier tel quel, sa définition, DV/HDR/Atmos), les paliers que le serveur
 * convertit et leur débit, « Auto » quand le plafond de débit a choisi. À
 * côté, sans rien de focalisable, ce qui aide à choisir. La feuille, la
 * croix et leurs groupes : `PlayerSheet`, préfixe `settings`.
 * Clés : `settings:close` (la croix), `settings:quality:<clé>` ; groupes
 * `settings:panel` et `settings:back`.
 */

export interface SettingsPanelLabels {
  quality: string;
  auto: string;
  qualityGuideTitle: string;
  qualityGuideOriginal: string;
  qualityGuideConverted: string;
}

export const SettingsPanel = memo(function SettingsPanel({
  model,
  labels,
  onSelectQuality,
  onClose,
}: {
  model: SettingsPanelModel;
  labels: SettingsPanelLabels;
  onSelectQuality?: (key: string) => void;
  onClose?: () => void;
}) {
  return (
    <PlayerSheet prefix="settings" onClose={onClose}>
      <SheetColumn
        title={labels.quality}
        icon="sliders"
        options={model.quality}
        keyPrefix="settings:quality"
        autoLabel={labels.auto}
        onSelect={onSelectQuality}
      />
      <SheetDivider />
      <View style={styles.guide}>
        <SheetHeading title={labels.qualityGuideTitle} icon="info" />
        <View style={styles.paragraphs}>
          <Text style={styles.paragraph}>{labels.qualityGuideOriginal}</Text>
          <Text style={styles.paragraph}>{labels.qualityGuideConverted}</Text>
        </View>
      </View>
    </PlayerSheet>
  );
});

const styles = StyleSheet.create({
  guide: { flex: 1, paddingHorizontal: 20 },
  // Une mesure de lecture : jamais une ligne d'un bord à l'autre de la feuille.
  paragraphs: { paddingLeft: 16, paddingTop: 6, gap: 24, maxWidth: 660 },
  paragraph: { ...fonts.medium, fontSize: TV_TYPE.body, lineHeight: TV_TYPE.bodyLineHeight, color: white(0.74) },
});
