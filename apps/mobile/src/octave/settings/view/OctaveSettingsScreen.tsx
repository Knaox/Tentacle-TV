/**
 * Octave (mobile) — « Réglages d'Octave », la page du bureau en version mobile : d'abord ce qui ne touche que la
 * musique (« Octave seulement »), puis « Aussi dans Tentacle ». Téléphone : une colonne. Tablette (≥ 768 pt de
 * large, iPad et tablettes Android, en paysage comme en portrait large) : les deux moitiés côte à côte — une vraie
 * mise en page, pas un téléphone étiré. Aucune donnée chargée ici (les profils lisent la liste déjà en cache).
 */

import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { spacing } from "@/theme";
import { OctaveOnlySettings } from "./OctaveOnlySettings";
import { SharedSettings } from "./SharedSettings";

/** Au-delà, deux colonnes. */
const TWO_COLUMNS_MIN_WIDTH = 768;

export function OctaveSettingsScreen() {
  const { t } = useTranslation("octaveShell");
  const { width } = useWindowDimensions();
  const wide = width >= TWO_COLUMNS_MIN_WIDTH;
  return (
    <SettingsScaffold title={t("settings.title")} maxWidth={wide ? 1080 : 720}>
      <OctaveSettingsPane wide={wide} />
    </SettingsScaffold>
  );
}

/** Le contenu seul : une coquille de tablette peut le poser dans sa colonne de détail. */
export function OctaveSettingsPane({ wide = false }: { wide?: boolean }) {
  return (
    <View style={wide ? styles.columns : undefined}>
      <View style={wide ? styles.column : undefined}>
        <OctaveOnlySettings />
      </View>
      <View style={wide ? styles.column : styles.after}>
        <SharedSettings />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  column: { flex: 1, minWidth: 0 },
  after: { marginTop: spacing.md },
});
