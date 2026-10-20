import { useTranslation } from "react-i18next";
import { setEngineSetting, useEngineSettings } from "@/player/engine/engineSettings";
import { ENGINE_HINT_KEYS } from "@/player/engine/playerSettingsPlatforms";
import type { VideoEngineSetting } from "@/player/engine/types";
import type { DataSaverSetting } from "@/offline/dataSaverStore";
import { playerSettingsContext } from "@/screens/profile/playerSettingsContext";
import { useDataSaverActive, useDataSaverSetting } from "@/offline/useDataSaver";
import type { SettingScope } from "../ScopeBadge";
import { SteppedSlider } from "../SteppedSlider";
import { BlockSettingRow, SegmentedSettingRow } from "./SettingRowKit";

interface RowProps {
  scope: SettingScope | null;
  last?: boolean;
}


/**
 * La taille des sous-titres dessinés par le lecteur avancé — réglage de CET
 * appareil (`tentacle_sub_scale`), 160 % pour qui n'a jamais réglé.
 */
export function SubtitleSizeRow({ scope, last }: RowProps) {
  const { t } = useTranslation(["settingsMobile", "preferences"]);
  const { subtitleScale } = useEngineSettings();
  return (
    <BlockSettingRow icon="type" label={t("playback.subtitleSize")} description={t("playback.subtitleSizeHint")} scope={scope} last={last}>
      <SteppedSlider
        value={subtitleScale}
        min={0.5}
        max={2}
        step={0.1}
        onChange={(value) => setEngineSetting("subtitleScale", Math.round(value * 10) / 10)}
        accessibilityLabel={t("playback.subtitleSize")}
        valueText={`${Math.round(subtitleScale * 100)} %`}
        leftLabel={t("preferences:subtitleScaleSmall")}
        rightLabel={t("preferences:subtitleScaleLarge")}
      />
    </BlockSettingRow>
  );
}

/** La position verticale des sous-titres (`tentacle_sub_pos`) : 100 % = le bas de l'image. */
export function SubtitlePositionRow({ scope, last }: RowProps) {
  const { t } = useTranslation(["settingsMobile", "preferences"]);
  const { subtitlePosition } = useEngineSettings();
  return (
    <BlockSettingRow icon="align-center" label={t("playback.subtitlePosition")} description={t("playback.subtitlePositionHint")} scope={scope} last={last}>
      <SteppedSlider
        value={subtitlePosition}
        min={50}
        max={100}
        step={5}
        onChange={(value) => setEngineSetting("subtitlePosition", Math.round(value))}
        accessibilityLabel={t("playback.subtitlePosition")}
        valueText={`${subtitlePosition} %`}
        leftLabel={t("preferences:subtitlePositionHigh")}
        rightLabel={t("preferences:subtitlePositionLow")}
      />
    </BlockSettingRow>
  );
}

const SAVER_MODES: readonly DataSaverSetting[] = ["auto", "on", "off"];
const SAVER_LABEL_KEYS = { auto: "saverModeAuto", on: "saverModeOn", off: "saverModeOff" } as const;
const SAVER_HINT_KEYS = { auto: "saverModeAutoHint", on: "saverModeOnHint", off: "saverModeOffHint" } as const;

/**
 * L'économie de données — par APPAREIL (`tentacle_data_saver`) : la qualité
 * du lien dépend de l'endroit où tourne l'app. « Automatique » suit la
 * latence mesurée et les données mobiles du téléphone ; la phrase dit ce que
 * fait le mode choisi, et s'il est actif en ce moment.
 */
export function DataSaverRow({ scope, last }: RowProps) {
  const { t } = useTranslation(["settingsMobile", "downloads"]);
  const { setting, setSetting } = useDataSaverSetting();
  const active = useDataSaverActive();
  const hint = t(`downloads:${SAVER_HINT_KEYS[setting]}`);
  return (
    <SegmentedSettingRow
      icon="bar-chart-2"
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

const ENGINES: readonly VideoEngineSetting[] = ["auto", "native", "mpv"];
const ENGINE_LABEL_KEYS = { auto: "playback.engineAuto", native: "playback.engineSystem", mpv: "playback.engineAdvanced" } as const;

/**
 * Le lecteur vidéo de CET appareil (`tentacle_video_engine`) : Auto, Système,
 * Avancé — le mot « mpv » ne s'écrit jamais. La phrase du moteur retenu, propre
 * à la plateforme (AirPlay et Dolby Vision n'existent pas sur Android).
 */
export function EngineRow({ scope, last }: RowProps) {
  const { t } = useTranslation(["settingsMobile", "preferences"]);
  const { engine } = useEngineSettings();
  return (
    <SegmentedSettingRow
      icon="film"
      label={t("playback.engine")}
      scope={scope}
      options={ENGINES.map((value) => ({ value, label: t(ENGINE_LABEL_KEYS[value]) }))}
      value={engine}
      hint={t(`preferences:${ENGINE_HINT_KEYS[playerSettingsContext().platform][engine]}`)}
      onChange={(next) => {
        const chosen = ENGINES.find((entry) => entry === next);
        if (chosen) setEngineSetting("engine", chosen);
      }}
      last={last}
    />
  );
}
