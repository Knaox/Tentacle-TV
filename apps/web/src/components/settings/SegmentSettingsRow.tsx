import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { SegmentSettings, SkipLabelKey } from "@tentacle-tv/shared";
import { PlaybackPreview } from "./PlaybackPreview";
import { SegmentDelaySlider } from "./SegmentDelaySlider";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingToggleRow } from "./SettingToggleRow";
import { SubSetting } from "./SubSetting";

interface SegmentSettingsRowProps {
  title: string;
  hint: string;
  /** Sert d'identifiant de champ — stable, contrairement au titre traduit. */
  fieldId: string;
  settings: SegmentSettings;
  onChange: (patch: Partial<SegmentSettings>) => void;
  /** Le libellé que porte le bouton de CE passage, dans l'aperçu. */
  labelKey: SkipLabelKey;
}

/**
 * Un passage d'épisode et ce que le lecteur en fait.
 *
 * Trois réglages, mais deux ne servent qu'au saut automatique : le décompte et
 * son délai n'apparaissent QUE là — un bouton qu'on doit choisir n'a pas de
 * minuteur, et proposer d'en régler un serait mentir sur ce qui va se passer.
 *
 * Le choix de l'action est à plat plutôt que dans un menu déroulant : les
 * trois possibilités se lisent d'un coup d'œil, ce qui est tout l'enjeu ici.
 * Il est À DROITE du titre (refonte de nov. 2026) : les cinq passages
 * s'alignent, on compare leurs choix en descendant la colonne.
 */
export function SegmentSettingsRow({
  title, hint, fieldId, settings, onChange, labelKey,
}: SegmentSettingsRowProps) {
  const { t } = useTranslation("preferences");
  const auto = settings.action === "auto";
  const titleId = useId();

  return (
    <SubSetting
      title={title}
      hint={hint}
      titleId={titleId}
      trailing={(
        <SegmentedChoice
          label={`${title} — ${t("segmentActionLabel")}`}
          value={settings.action}
          options={[
            { value: "button", label: t("segmentActionButton") },
            { value: "auto", label: t("segmentActionAuto") },
            { value: "off", label: t("segmentActionOff") },
          ]}
          onChange={(action) => onChange({ action })}
          className="max-w-full"
        />
      )}
    >
      {/* L'aperçu de CE passage, sous ses propres choix : il n'y a rien à
          relier, et rien à comprendre avant de le lire. */}
      <PlaybackPreview settings={settings} labelKey={labelKey} />

      {auto && (
        <div className="mt-4 space-y-4 rounded-tile bg-surface-2 p-4">
          <SettingToggleRow
            title={t("segmentCountdownTitle")}
            hint={t("segmentCountdownHint")}
            active={settings.countdownVisible}
            onChange={(countdownVisible) => onChange({ countdownVisible })}
          />
          <SegmentDelaySlider
            id={`delay-${fieldId}`}
            valueMs={settings.autoDelayMs}
            onChange={(autoDelayMs) => onChange({ autoDelayMs })}
          />
        </div>
      )}
    </SubSetting>
  );
}
