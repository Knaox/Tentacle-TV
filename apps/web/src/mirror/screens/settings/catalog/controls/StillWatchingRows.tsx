import { useTranslation } from "react-i18next";
import { Hourglass, Play, Timer, TimerReset, X } from "lucide-react";
import { useStillWatchingSettings, useStillWatchingTrial } from "@tentacle-tv/api-client";
import { stillWatchingAfterChoices, stillWatchingCountdownChoices } from "../../../../../components/settings/stillWatchingChoices";
import { isWebDebugEnabled } from "../../../../../lib/webDebug";
import { SettingsChoiceRow } from "../../ui/SettingsChoiceRow";
import { SettingsRow } from "../../ui/SettingsRow";
import { SwitchSettingRow, type ControlRowProps } from "./SettingRowKit";

/**
 * « Êtes-vous encore là ? » — le réglage du COMPTE
 * (`/api/preferences/still-watching`), que le catalogue ne pose que face à un
 * serveur qui déclare `playback.stillWatching` : l'interrupteur, puis les deux
 * durées tant que la question est activée, et « Voir la question
 * maintenant » derrière la porte du débogage du web seulement
 * (`lib/webDebug.ts`).
 */
export function StillWatchingRows({ scope, last }: ControlRowProps) {
  const { t } = useTranslation(["preferences", "player"]);
  const { available, settings, set } = useStillWatchingSettings();
  const trial = useStillWatchingTrial();
  if (!available) return null;
  const trialShown = isWebDebugEnabled();
  const trialText = trial.armed ? t("preferences:stillWatchingTrialArmed") : t("preferences:stillWatchingTrialHint");
  const trialLabel = trial.armed ? t("preferences:stillWatchingTrialCancel") : t("preferences:stillWatchingTrialTitle");

  return (
    <>
      <SwitchSettingRow
        icon={Hourglass}
        label={t("preferences:stillWatchingTitle")}
        description={t("preferences:stillWatchingHint")}
        scope={scope}
        value={settings.enabled}
        onChange={(enabled) => {
          if (!enabled) trial.cancel();
          set({ enabled });
        }}
        last={last && !settings.enabled}
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
            last={last && !trialShown}
          />
          {trialShown && (
            <>
              <SettingsRow
                icon={trial.armed ? X : Play}
                label={trialLabel}
                description={trialText}
                accent={!trial.armed}
                onPress={trial.armed ? trial.cancel : trial.arm}
                ariaLabel={`${trialLabel}. ${trialText}`}
                last={last}
              />
              {/* L'état armé, annoncé : la ligne est un bouton, son libellé ne se relit pas seul. */}
              <span role="status" className="sr-only">{trial.armed ? t("preferences:stillWatchingTrialArmed") : ""}</span>
            </>
          )}
        </>
      )}
    </>
  );
}
