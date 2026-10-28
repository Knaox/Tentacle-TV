import { useTranslation } from "react-i18next";
import { setBackgroundTransfers, useBackgroundTransfers } from "../../downloads/backgroundTransfersStore";
import { ToggleSwitch } from "./ToggleSwitch";
import { SettingItem } from "./wide/SettingItem";

/**
 * « Continuer en arrière-plan » (Réglages › Téléchargements, bureau) : fermer la fenêtre laisse finir les
 * transferts en cours, films comme musique d'Octave ; l'application se ferme ensuite d'elle-même. Réglage de
 * CET appareil, allumé par défaut. Aussi dans les Réglages d'Octave (`OctaveTransfersSetting`), même source.
 */
export function BackgroundTransfersSetting() {
  const { t } = useTranslation("settingsWeb");
  const on = useBackgroundTransfers();
  if (on === null) return null;
  return (
    <SettingItem
      setting="downloadsBackground"
      trailing={<ToggleSwitch checked={on} onChange={(next) => void setBackgroundTransfers(next)} label={t("entries.downloadsBackground.label")} />}
    />
  );
}
