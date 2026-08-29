import { useTranslation } from "react-i18next";
import type { SegmentSettings } from "@tentacle-tv/shared";
import { SegmentDelaySlider } from "./SegmentDelaySlider";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingToggleRow } from "./SettingToggleRow";

interface SegmentSettingsRowProps {
  title: string;
  hint: string;
  /** Sert d'identifiant de champ — stable, contrairement au titre traduit. */
  fieldId: string;
  settings: SegmentSettings;
  onChange: (patch: Partial<SegmentSettings>) => void;
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
 */
export function SegmentSettingsRow({
  title, hint, fieldId, settings, onChange,
}: SegmentSettingsRowProps) {
  const { t } = useTranslation("preferences");
  const auto = settings.action === "auto";

  return (
    <div>
      <p className="text-sm font-medium text-content-primary">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{hint}</p>
      <SegmentedChoice
        label={`${title} — ${t("segmentActionLabel")}`}
        value={settings.action}
        options={[
          { value: "button", label: t("segmentActionButton") },
          { value: "auto", label: t("segmentActionAuto") },
          { value: "off", label: t("segmentActionOff") },
        ]}
        onChange={(action) => onChange({ action })}
        className="mt-3 max-w-full"
      />

      {auto && (
        <div className="mt-4 space-y-4 border-l border-line-subtle pl-4">
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
    </div>
  );
}
