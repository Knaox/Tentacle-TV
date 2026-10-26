import { useTranslation } from "react-i18next";
import { useServerCapability } from "@tentacle-tv/api-client";
import { TRAILER_PREVIEW_DELAYS, parseTrailerPreviewDelay } from "@tentacle-tv/shared";
import { useTrailerPreviewDelay, useTrailerPreviewsSetting } from "../../trailerPreview";
import { SegmentedChoice } from "./SegmentedChoice";
import { ToggleSwitch } from "./ToggleSwitch";
import { SettingItem } from "./wide/SettingItem";

/**
 * « Aperçus de bande-annonce au survol » (Réglages › Accueil et découverte :
 * un comportement des cartes, pas une couleur) — réglages d'APPAREIL (le son d'une
 * bande-annonce qui part au survol se décide là où l'on est assis, pas pour
 * le compte), activés par défaut : l'aperçu lui-même, puis son DÉLAI — le
 * temps entre le début du survol et sa première image (shared
 * `previewDelay.ts`, 800 ms par défaut), qui ne paraît que les aperçus
 * allumés.
 *
 * Seulement face à un serveur qui sait servir les aperçus (`trailers.preview`) :
 * un client à jour face à un serveur plus ancien n'en montre rien.
 */
export function TrailerPreviewSetting() {
  const { t } = useTranslation("trailerPreview");
  const available = useServerCapability("trailers.preview");
  const [enabled, setEnabled] = useTrailerPreviewsSetting();
  const [delay, setDelay] = useTrailerPreviewDelay();
  if (!available) return null;

  return (
    <>
      <SettingItem
        setting="trailerPreviews"
        trailing={<ToggleSwitch checked={enabled} onChange={setEnabled} label={t("settingAccessibleName")} />}
      />
      {enabled && (
        <SettingItem
          setting="trailerPreviewDelay"
          trailing={(
            <SegmentedChoice
              label={t("delayTitle")}
              value={String(delay)}
              options={TRAILER_PREVIEW_DELAYS.map((choice) => ({ value: String(choice), label: t(`delay_${choice}`) }))}
              onChange={(value) => setDelay(parseTrailerPreviewDelay(value))}
              className="shrink-0"
            />
          )}
        />
      )}
    </>
  );
}
