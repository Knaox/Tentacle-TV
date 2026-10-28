/**
 * Octave (mobile) — « Réglages d'Octave », la page du bureau en version mobile : d'abord ce qui ne touche que la
 * musique (« Octave seulement »), puis « Aussi dans Tentacle ». Téléphone : une colonne. Tablette (≥ 768 pt de
 * large, iPad et tablettes Android, en paysage comme en portrait large) : les deux moitiés côte à côte — une vraie
 * mise en page, pas un téléphone étiré. Aucune donnée chargée ici (les profils lisent la liste déjà en cache).
 */

import { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useOctaveAvailability } from "@tentacle-tv/api-client";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { spacing } from "@/theme";
import { mirrorAvailableNow } from "../../mode/octaveMirror";
import { OctaveOnlySettings } from "./OctaveOnlySettings";
import { SharedSettings } from "./SharedSettings";

/** Au-delà, deux colonnes. */
export const TWO_COLUMNS_MIN_WIDTH = 768;

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
export function OctaveSettingsPane({ wide = false, gutter = 0 }: { wide?: boolean; gutter?: number }) {
  // Sans Octave (serveur qui ne le déclare pas, compte sans musique ou sans le droit) : aucune trace. Hors ligne,
  // le statut peut manquer : la dernière réponse établie (miroir de la porte) fait foi — jamais une page vide.
  const { available } = useOctaveAvailability();
  const offline = useOfflineMode();
  const remembered = useMemo(mirrorAvailableNow, []);
  if (!available && !(offline && remembered)) return null;
  return (
    <View style={[styles.pane, wide ? styles.columns : undefined, { paddingHorizontal: gutter }]}>
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
  pane: { width: "100%", maxWidth: 1120, alignSelf: "center" },
  columns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  column: { flex: 1, minWidth: 0 },
  after: { marginTop: spacing.md },
});
