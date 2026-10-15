import { useTranslation } from "react-i18next";
import { Hourglass, Timer, TimerReset } from "lucide-react";
import { useStillWatchingSettings } from "@tentacle-tv/api-client";
import { ToggleSwitch } from "../../../../components/settings/ToggleSwitch";
import { stillWatchingAfterChoices, stillWatchingCountdownChoices } from "../../../../components/settings/stillWatchingChoices";
import { SettingsChoiceRow } from "../ui/SettingsChoiceRow";
import { SettingsRow } from "../ui/SettingsRow";
import { SettingsSection } from "../ui/SettingsSection";

/**
 * « Vous regardez encore ? » dans le panneau Lecture du miroir — le même
 * réglage du COMPTE que les Réglages du web (`StillWatchingSetting`), dans les
 * lignes de l'app : l'interrupteur, puis les deux durées en segmentés compacts
 * tant que la question est activée. Rien face à un serveur qui ne déclare pas
 * `playback.stillWatching`.
 */
export function StillWatchingSection() {
  const { t } = useTranslation(["preferences", "player"]);
  const { available, settings, set } = useStillWatchingSettings();
  if (!available) return null;

  return (
    <SettingsSection title={t("player:stillWatching.title")} caption={t("preferences:stillWatchingHint")}>
      <SettingsRow
        icon={Hourglass}
        label={t("preferences:stillWatchingTitle")}
        last={!settings.enabled}
        trailing={
          <ToggleSwitch
            checked={settings.enabled}
            onChange={(enabled) => set({ enabled })}
            label={t("preferences:stillWatchingTitle")}
          />
        }
      />
      {settings.enabled && (
        <>
          <SettingsChoiceRow
            icon={Timer}
            label={t("preferences:stillWatchingAfter")}
            options={stillWatchingAfterChoices(t)}
            value={String(settings.afterMs)}
            onChange={(value) => set({ afterMs: Number(value) })}
          />
          <SettingsChoiceRow
            icon={TimerReset}
            label={t("preferences:stillWatchingCountdown")}
            options={stillWatchingCountdownChoices(t)}
            value={String(settings.countdownMs)}
            onChange={(value) => set({ countdownMs: Number(value) })}
            last
          />
        </>
      )}
    </SettingsSection>
  );
}
