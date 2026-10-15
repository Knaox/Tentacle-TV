import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStillWatchingSettings } from "@tentacle-tv/api-client";

import { BrandSwitch } from "./BrandSwitch";
import { SettingsChoiceRow } from "./SettingsChoiceRow";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";
import { stillWatchingChoices } from "./stillWatchingChoices";

/**
 * « Demander si vous regardez encore » — un réglage du COMPTE (serveur qui
 * déclare `playback.stillWatching`) : rien du tout face à un serveur qui ne
 * le connaît pas. Un interrupteur, puis, allumé, deux choix courts en
 * pastilles : quand demander, et combien de temps laisser pour répondre.
 */
export function StillWatchingSettingsSection() {
  const { t } = useTranslation("preferences");
  const { available, settings, set } = useStillWatchingSettings();
  const choices = useMemo(() => stillWatchingChoices(t), [t]);

  if (!available) return null;

  return (
    <SettingsSection>
      <SettingsRow
        icon="moon"
        label={t("stillWatchingTitle")}
        description={t("stillWatchingHint")}
        last={!settings.enabled}
        trailing={
          <BrandSwitch
            value={settings.enabled}
            onValueChange={(enabled) => set({ enabled })}
            accessibilityLabel={t("stillWatchingTitle")}
          />
        }
      />
      {settings.enabled && (
        <>
          <SettingsChoiceRow
            icon="clock"
            label={t("stillWatchingAfter")}
            options={choices.after}
            value={String(settings.afterMs)}
            onChange={(value) => set({ afterMs: Number(value) })}
          />
          <SettingsChoiceRow
            icon="watch"
            label={t("stillWatchingCountdown")}
            options={choices.countdown}
            value={String(settings.countdownMs)}
            onChange={(value) => set({ countdownMs: Number(value) })}
            last
          />
        </>
      )}
    </SettingsSection>
  );
}
