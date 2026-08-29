import { useTranslation } from "react-i18next";
import { SEGMENT_AUTO_DELAY_MAX_MS, type SegmentSettings } from "@tentacle-tv/shared";
import { SETTING_FIELD, SettingToggleRow } from "./SettingToggleRow";

interface SegmentSettingsRowProps {
  title: string;
  hint: string;
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
 * Le délai est en MILLISECONDES, à découvert. C'est l'unité du moteur
 * (`packages/shared/src/playback`), la seule où l'on puisse demander « une
 * seconde et demie » ; l'arrondir à la seconde dans l'interface aurait rendu
 * inatteignable la moitié des valeurs que le lecteur sait tenir.
 */
export function SegmentSettingsRow({ title, hint, settings, onChange }: SegmentSettingsRowProps) {
  const { t } = useTranslation("preferences");
  const auto = settings.action === "auto";

  return (
    <div>
      <p className="text-sm font-medium text-content-primary">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{hint}</p>
      <select
        value={settings.action}
        aria-label={`${title} — ${t("segmentActionLabel")}`}
        onChange={(e) => {
          const action = e.target.value;
          if (action === "button" || action === "auto" || action === "off") onChange({ action });
        }}
        className={`mt-3 w-full max-w-xs ${SETTING_FIELD}`}
      >
        <option value="button">{t("segmentActionButton")}</option>
        <option value="auto">{t("segmentActionAuto")}</option>
        <option value="off">{t("segmentActionOff")}</option>
      </select>

      {auto && (
        <div className="mt-4 space-y-4 border-l border-line-subtle pl-4">
          <SettingToggleRow
            title={t("segmentCountdownTitle")}
            hint={t("segmentCountdownHint")}
            active={settings.countdownVisible}
            onChange={(countdownVisible) => onChange({ countdownVisible })}
          />
          <div>
            <label
              htmlFor={`delai-${title}`}
              className="text-sm font-medium text-content-primary"
            >
              {t("segmentDelayLabel")}
            </label>
            <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
              {t("segmentDelayHint")}
            </p>
            <input
              id={`delai-${title}`}
              type="number"
              min={0}
              max={SEGMENT_AUTO_DELAY_MAX_MS}
              step={500}
              value={settings.autoDelayMs}
              onChange={(e) => {
                const typed = Number.parseInt(e.target.value, 10);
                // Un champ vidé ne vaut pas zéro : on n'écrit rien tant qu'il
                // n'y a pas de nombre, sinon le délai tomberait à 0 entre deux
                // frappes et le passage serait sauté sans rien demander.
                if (Number.isFinite(typed)) onChange({ autoDelayMs: typed });
              }}
              className={`mt-2 w-32 ${SETTING_FIELD}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
