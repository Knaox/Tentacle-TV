import { useTranslation } from "react-i18next";
import { SettingsSection } from "@tentacle-tv/ui";
import { useStillWatchingSettings } from "@tentacle-tv/api-client";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingToggleRow } from "./SettingToggleRow";
import { stillWatchingAfterChoices, stillWatchingCountdownChoices } from "./stillWatchingChoices";

/**
 * « Vous regardez encore ? » dans Réglages › Lecture — un réglage du COMPTE
 * (réglé ici, il vaut sur le téléphone et les téléviseurs), écrit par le
 * crochet partagé, qui en garde une copie locale pour le hors ligne.
 *
 * Seulement face à un serveur qui déclare `playback.stillWatching` : un client
 * à jour face à un serveur plus ancien n'en montre rien. Les deux durées ne
 * paraissent que lorsque la question est activée — régler le délai d'une
 * fonction éteinte n'a pas de sens.
 */
export function StillWatchingSetting() {
  const { t } = useTranslation(["preferences", "player"]);
  const { available, settings, set } = useStillWatchingSettings();
  if (!available) return null;

  return (
    <SettingsSection title={t("player:stillWatching.title")}>
      <div className="p-5">
        <SettingToggleRow
          title={t("preferences:stillWatchingTitle")}
          hint={t("preferences:stillWatchingHint")}
          active={settings.enabled}
          onChange={(enabled) => set({ enabled })}
        />

        {settings.enabled && (
          <div className="mt-5 flex flex-col gap-5 border-t border-line-subtle pt-5">
            <div>
              <p className="text-sm font-medium text-content-primary">{t("preferences:stillWatchingAfter")}</p>
              <SegmentedChoice
                label={t("preferences:stillWatchingAfter")}
                value={String(settings.afterMs)}
                options={stillWatchingAfterChoices(t)}
                onChange={(value) => set({ afterMs: Number(value) })}
                className="mt-3"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-content-primary">{t("preferences:stillWatchingCountdown")}</p>
              <SegmentedChoice
                label={t("preferences:stillWatchingCountdown")}
                value={String(settings.countdownMs)}
                options={stillWatchingCountdownChoices(t)}
                onChange={(value) => set({ countdownMs: Number(value) })}
                className="mt-3"
              />
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
