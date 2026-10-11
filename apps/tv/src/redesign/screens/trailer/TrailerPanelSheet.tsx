import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_TYPE } from "@tentacle-tv/theme";
import { fonts, white } from "../../theme/tokens";
import { PlayerSheet, SheetColumn, SheetDivider, SheetHeading } from "../player/PlayerSheet";
import { TRAILER_PANEL_COLUMN, TRAILER_PANEL_PREFIX } from "@tentacle-tv/tv-core";
import type { TrailerPanelModel } from "./trailerTypes";

/**
 * Le panneau d'un choix de la bande-annonce — les sous-titres OU la qualité —
 * sur la feuille du grand lecteur (`PlayerSheet`, `SheetColumn`,
 * `TrackOptionRow` : les mêmes briques, jamais une copie). Une seule colonne
 * de choix ; à côté, sans rien de focalisable, une phrase qui dit ce que fait
 * le choix (retenu pour les suivantes, « Auto » qui suit la connexion) — la
 * feuille ne reste pas à moitié vide.
 *
 * Clés : `trailerSubtitles:close` / `trailerQuality:close` (la croix),
 * `<préfixe>:list:<clé>` ; groupes `<préfixe>:panel` et `<préfixe>:back`.
 */

export interface TrailerPanelLabels {
  title: string;
  /** La pastille d'un choix fait par la qualité automatique. */
  auto: string;
  noteTitle: string;
  note: string;
}

export const TrailerPanelSheet = memo(function TrailerPanelSheet({
  panel,
  labels,
  onSelect,
  onClose,
}: {
  panel: TrailerPanelModel;
  labels: TrailerPanelLabels;
  onSelect?: (key: string) => void;
  onClose?: () => void;
}) {
  const prefix = TRAILER_PANEL_PREFIX[panel.kind];
  return (
    <PlayerSheet prefix={prefix} onClose={onClose}>
      <SheetColumn
        title={labels.title}
        icon={panel.kind === "subtitles" ? "subtitles" : "sliders"}
        options={panel.options}
        keyPrefix={`${prefix}:${TRAILER_PANEL_COLUMN}`}
        autoLabel={labels.auto}
        onSelect={onSelect}
      />
      <SheetDivider />
      <View style={styles.note}>
        <SheetHeading title={labels.noteTitle} icon="info" />
        <Text style={styles.paragraph}>{labels.note}</Text>
      </View>
    </PlayerSheet>
  );
});

const styles = StyleSheet.create({
  note: { flex: 1, paddingHorizontal: 20 },
  // Une mesure de lecture, comme le guide de la qualité du grand lecteur.
  paragraph: { ...fonts.medium, fontSize: TV_TYPE.body, lineHeight: TV_TYPE.bodyLineHeight, color: white(0.74), paddingLeft: 16, paddingTop: 6, maxWidth: 660 },
});
