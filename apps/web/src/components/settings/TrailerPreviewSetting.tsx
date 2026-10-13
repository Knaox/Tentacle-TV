import { useTranslation } from "react-i18next";
import { Clapperboard } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import { useServerCapability } from "@tentacle-tv/api-client";
import { useTrailerPreviewsSetting } from "../../trailerPreview";
import { ToggleSwitch } from "./ToggleSwitch";

const ICON = 17;

/**
 * « Aperçus de bande-annonce au survol » — réglage d'APPAREIL (le son d'une
 * bande-annonce qui part au survol se décide là où l'on est assis, pas pour
 * le compte), activé par défaut.
 *
 * Seulement face à un serveur qui sait servir les aperçus (`trailers.preview`) :
 * un client à jour face à un serveur plus ancien n'en montre rien.
 */
export function TrailerPreviewSetting() {
  const { t } = useTranslation("trailerPreview");
  const available = useServerCapability("trailers.preview");
  const [enabled, setEnabled] = useTrailerPreviewsSetting();
  if (!available) return null;

  return (
    <SettingsSection title={t("settingSection")}>
      <SettingsRow
        icon={<Clapperboard size={ICON} />}
        label={t("settingTitle")}
        description={t("settingDescription")}
        last
        trailing={<ToggleSwitch checked={enabled} onChange={setEnabled} label={t("settingAccessibleName")} />}
      />
    </SettingsSection>
  );
}
