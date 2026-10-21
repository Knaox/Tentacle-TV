import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  setPlaybackSettings, useOwnPlaybackSettings, useStillWatchingSettings, useTrendingNowSetting,
} from "@tentacle-tv/api-client";
import type { SegmentAction } from "@tentacle-tv/shared";
import { SettingsChoiceRow } from "../SettingsChoiceRow";
import type { SettingScope } from "../ScopeBadge";
import { stillWatchingChoices } from "../stillWatchingChoices";
import { SegmentedSettingRow, SwitchSettingRow } from "./SettingRowKit";
import { StillWatchingTrialRow } from "./StillWatchingTrialRow";

interface RowProps {
  scope: SettingScope | null;
  last?: boolean;
}

const INTRO_ACTIONS: readonly SegmentAction[] = ["button", "auto", "off"];
const INTRO_LABEL_KEYS = { button: "playback.introsButton", auto: "playback.introsAuto", off: "playback.introsOff" } as const;
const INTRO_HINT_KEYS = { button: "playback.introsButtonHint", auto: "playback.introsAutoHint", off: "playback.introsOffHint" } as const;

/**
 * « Intros et résumés » — un réglage du COMPTE (`/api/preferences/playback`) :
 * proposer, passer, laisser. Il règle l'intro ET le résumé d'un même geste ;
 * le reste (délais, décompte visible, génériques) se règle sur le bureau et
 * n'est jamais touché ici. Les réglages PROPRES : dans un groupe Watch
 * Together, ceux de l'hôte gouvernent la lecture, mais ce sont bien les
 * siens qu'on règle.
 */
export function IntrosRow({ scope, last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  const settings = useOwnPlaybackSettings();
  const value = settings.intro.action;
  const options = INTRO_ACTIONS.map((action) => ({ value: action, label: t(INTRO_LABEL_KEYS[action]) }));
  return (
    <SegmentedSettingRow
      icon="fast-forward"
      label={t("playback.intros")}
      scope={scope}
      options={options}
      value={value}
      hint={t(INTRO_HINT_KEYS[value])}
      onChange={(next) => {
        const action = INTRO_ACTIONS.find((entry) => entry === next);
        if (action) setPlaybackSettings({ intro: { action }, recap: { action } });
      }}
      last={last}
    />
  );
}

/** « Épisode suivant automatique » — `next.nextAutoPlay` du compte ; la fiche et le décompte restent ceux du compte. */
export function NextAutoPlayRow({ scope, last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  const settings = useOwnPlaybackSettings();
  return (
    <SwitchSettingRow
      icon="skip-forward"
      label={t("playback.nextAutoPlay")}
      description={t("playback.nextAutoPlayHint")}
      scope={scope}
      value={settings.next.nextAutoPlay}
      onChange={(nextAutoPlay) => setPlaybackSettings({ next: { nextAutoPlay } })}
      last={last}
    />
  );
}

/**
 * « Êtes-vous encore là ? » — la MÊME portée que le bureau : le réglage du
 * compte (`/api/preferences/still-watching`), rendu seulement face à un
 * serveur qui déclare `playback.stillWatching` (la structure le garde). Un
 * interrupteur, puis, allumé, quand demander, combien de temps laisser, et
 * « Essayer » pour voir la question sans attendre (`StillWatchingTrialRow`).
 */
export function StillWatchingRows({ scope, last }: RowProps) {
  const { t } = useTranslation("preferences");
  const { available, settings, set } = useStillWatchingSettings();
  const choices = useMemo(() => stillWatchingChoices(t), [t]);
  if (!available) return null;
  return (
    <>
      <SwitchSettingRow
        icon="moon"
        label={t("stillWatchingTitle")}
        description={t("stillWatchingHint")}
        scope={scope}
        value={settings.enabled}
        onChange={(enabled) => set({ enabled })}
        last={last && !settings.enabled}
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
          />
          <StillWatchingTrialRow last={last} />
        </>
      )}
    </>
  );
}

/**
 * « Tendances actuelles dans Pour vous » — préférence du COMPTE (`trendingNow`
 * de `/api/preferences/reco`). Le mobile ne rend pas cette rangée : le
 * réglage vaut pour l'ordinateur et la TV, et la phrase le dit.
 */
export function TrendingNowRow({ scope, last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  const { available, enabled, setEnabled } = useTrendingNowSetting();
  if (!available) return null;
  return (
    <SwitchSettingRow
      icon="trending-up"
      label={t("playback.trendingNow")}
      description={t("playback.trendingNowHint")}
      scope={scope}
      value={enabled}
      onChange={setEnabled}
      last={last}
    />
  );
}
