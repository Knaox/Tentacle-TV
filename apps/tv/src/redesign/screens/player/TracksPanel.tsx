import { memo } from "react";
import { PlayerSheet, SheetColumn, SheetDivider } from "./PlayerSheet";
import type { TracksPanelModel } from "./playerTypes";

/**
 * Le panneau des pistes : l'audio et les sous-titres, côte à côte — rien
 * d'autre (la qualité et ce qui n'est pas un choix de piste vivent dans
 * « Réglages », `SettingsPanel`, depuis le 2026-10-01 : rangée ici, la
 * qualité ne se trouvait pas). La feuille, la croix et leurs groupes :
 * `PlayerSheet`, préfixe `tracks`.
 * Clés : `tracks:close` (la croix), `tracks:audio:<clé>`,
 * `tracks:subtitle:<clé>` ; groupes `tracks:panel` et `tracks:back`.
 */

export interface TracksPanelLabels {
  audio: string;
  subtitles: string;
  auto: string;
}

export const TracksPanel = memo(function TracksPanel({
  model,
  labels,
  onSelectAudio,
  onSelectSubtitle,
  onClose,
}: {
  model: TracksPanelModel;
  labels: TracksPanelLabels;
  onSelectAudio?: (key: string) => void;
  onSelectSubtitle?: (key: string) => void;
  onClose?: () => void;
}) {
  return (
    <PlayerSheet prefix="tracks" onClose={onClose}>
      <SheetColumn
        title={labels.audio}
        icon="audio"
        options={model.audio}
        keyPrefix="tracks:audio"
        autoLabel={labels.auto}
        onSelect={onSelectAudio}
      />
      <SheetDivider />
      <SheetColumn
        title={labels.subtitles}
        icon="subtitles"
        options={model.subtitles}
        keyPrefix="tracks:subtitle"
        autoLabel={labels.auto}
        onSelect={onSelectSubtitle}
      />
    </PlayerSheet>
  );
});
