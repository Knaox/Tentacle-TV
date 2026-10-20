import { useTranslation } from "react-i18next";
import { BarChart3, FastForward, SkipForward, TrendingUp } from "lucide-react";
import {
  setPlaybackSettings, useOwnPlaybackSettings, useTrendingNowSetting,
} from "@tentacle-tv/api-client";
import type { SegmentAction } from "@tentacle-tv/shared";
import { useDataSaverActive, useDataSaverSetting } from "../../../../../offline/useDataSaver";
import type { DataSaverSetting } from "../../../../../offline/dataSaver";
import { SegmentedSettingRow, SwitchSettingRow, type ControlRowProps } from "./SettingRowKit";

const INTRO_ACTIONS: readonly SegmentAction[] = ["button", "auto", "off"];
const INTRO_LABEL_KEYS = { button: "playback.introsButton", auto: "playback.introsAuto", off: "playback.introsOff" } as const;
const INTRO_HINT_KEYS = { button: "playback.introsButtonHint", auto: "playback.introsAutoHint", off: "playback.introsOffHint" } as const;

/**
 * « Intros et résumés » — réglage du COMPTE (`/api/preferences/playback`),
 * le même geste que le mobile : il règle l'intro ET le résumé ; délais,
 * décompte visible et génériques restent ceux du compte (page Lecture du
 * bureau). Les réglages PROPRES : dans un groupe Watch Together, l'hôte
 * gouverne la lecture, mais ce sont bien les siens qu'on règle.
 */
export function IntrosRow({ scope, last }: ControlRowProps) {
  const { t } = useTranslation("settingsMobile");
  const value = useOwnPlaybackSettings().intro.action;
  return (
    <SegmentedSettingRow
      icon={FastForward}
      label={t("playback.intros")}
      scope={scope}
      options={INTRO_ACTIONS.map((action) => ({ value: action, label: t(INTRO_LABEL_KEYS[action]) }))}
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

/** « Épisode suivant automatique » — `next.nextAutoPlay` du compte. */
export function NextAutoPlayRow({ scope, last }: ControlRowProps) {
  const { t } = useTranslation("settingsMobile");
  const settings = useOwnPlaybackSettings();
  return (
    <SwitchSettingRow
      icon={SkipForward}
      label={t("playback.nextAutoPlay")}
      description={t("playback.nextAutoPlayHint")}
      scope={scope}
      value={settings.next.nextAutoPlay}
      onChange={(nextAutoPlay) => setPlaybackSettings({ next: { nextAutoPlay } })}
      last={last}
    />
  );
}

/** « Tendances actuelles dans Pour vous » — préférence du COMPTE (`trendingNow`). */
export function TrendingNowRow({ scope, last }: ControlRowProps) {
  const { t } = useTranslation("settingsMobile");
  const { available, enabled, setEnabled } = useTrendingNowSetting();
  if (!available) return null;
  return (
    <SwitchSettingRow
      icon={TrendingUp}
      label={t("playback.trendingNow")}
      description={t("playback.trendingNowHint")}
      scope={scope}
      value={enabled}
      onChange={setEnabled}
      last={last}
    />
  );
}

const SAVER_MODES: readonly DataSaverSetting[] = ["auto", "on", "off"];
const SAVER_LABEL_KEYS = { auto: "saverModeAuto", on: "saverModeOn", off: "saverModeOff" } as const;
const SAVER_HINT_KEYS = { auto: "saverModeAutoHint", on: "saverModeOnHint", off: "saverModeOffHint" } as const;

/** « Économie de données » — réglage de CET appareil (`tentacle_data_saver`, la clé du mobile). */
export function DataSaverRow({ scope, last }: ControlRowProps) {
  const { t } = useTranslation(["settingsMobile", "downloads"]);
  const { setting, setSetting } = useDataSaverSetting();
  const active = useDataSaverActive();
  const hint = t(`downloads:${SAVER_HINT_KEYS[setting]}`);
  return (
    <SegmentedSettingRow
      icon={BarChart3}
      label={t("playback.dataSaver")}
      scope={scope}
      options={SAVER_MODES.map((mode) => ({ value: mode, label: t(`downloads:${SAVER_LABEL_KEYS[mode]}`) }))}
      value={setting}
      hint={active ? `${hint} ${t("downloads:saverActiveNow")}.` : hint}
      onChange={(next) => {
        const mode = SAVER_MODES.find((entry) => entry === next);
        if (mode) setSetting(mode);
      }}
      last={last}
    />
  );
}
