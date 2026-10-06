import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { setEngineSetting, useEngineSettings } from "@/player/engine/engineSettings";
import { ENGINE_HINT_KEYS, isPlayerSettingShown, type PlayerSettingId, type PlayerSettingsContext } from "@/player/engine/playerSettingsPlatforms";
import type { VideoEngineSetting } from "@/player/engine/types";
import { BrandSwitch } from "./BrandSwitch";
import { SettingsOptionList, type SettingsOption } from "./SettingsOptionList";
import { SettingsRow, type SettingsIcon } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";
import { SteppedSlider } from "./SteppedSlider";

const ENGINE_OPTIONS: readonly VideoEngineSetting[] = ["auto", "native", "mpv"];
const ENGINE_LABEL_KEYS = { auto: "videoEngineAuto", native: "videoEngineSystem", mpv: "videoEngineAdvanced" } as const;
const ENGINE_ICONS = { auto: "zap", native: "smartphone", mpv: "cpu" } as const;

interface SwitchEntry {
  id: "preferSystemAtmos" | "styledSubtitlesViaMpv" | "matchScreenFrameRate";
  setting: "preferSystemAtmos" | "styledSubtitlesViaMpv" | "matchFrameRate";
  icon: SettingsIcon;
}

/** Les interrupteurs, dans l'ordre de l'écran ; leur plateforme vient de la table. */
const SWITCHES: readonly SwitchEntry[] = [
  { id: "preferSystemAtmos", setting: "preferSystemAtmos", icon: "speaker" },
  { id: "styledSubtitlesViaMpv", setting: "styledSubtitlesViaMpv", icon: "type" },
  { id: "matchScreenFrameRate", setting: "matchFrameRate", icon: "monitor" },
];

interface Props {
  /** La plateforme et la présence du lecteur avancé (`PlaybackPane`). */
  ctx: PlayerSettingsContext;
}

/**
 * Les réglages d'APPAREIL du lecteur vidéo — ils ne suivent pas le compte :
 * ils dépendent de la puce, de l'écran et des écouteurs de ce téléphone.
 * Deux sections : le moteur (lignes à coche, chacune avec sa phrase, propre à
 * la plateforme) et les interrupteurs que la plateforme a vraiment, puis la
 * taille et la position des sous-titres. Ce qui s'affiche vient de la table
 * `PLAYER_SETTINGS` — jamais d'un test de plateforme ici. Le mot « mpv » ne
 * s'écrit jamais à l'écran : « lecteur avancé » et « lecteur système ».
 */
export function VideoEngineSection({ ctx }: Props) {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  const settings = useEngineSettings();

  const isShown = (id: PlayerSettingId) => isPlayerSettingShown(id, ctx);
  const hintKeys = ENGINE_HINT_KEYS[ctx.platform];
  const engineOptions: SettingsOption<VideoEngineSetting>[] = ENGINE_OPTIONS.map((value) => ({
    value,
    label: t(ENGINE_LABEL_KEYS[value]),
    description: t(hintKeys[value]),
    icon: ENGINE_ICONS[value],
  }));
  const switches = SWITCHES.filter((entry) => isShown(entry.id));
  const showEngine = isShown("videoEngine");
  const showSubtitles = isShown("subtitleScale") && isShown("subtitlePosition");
  const scalePercent = Math.round(settings.subtitleScale * 100);

  return (
    <>
      {(showEngine || switches.length > 0) && (
        <SettingsSection title={t("videoEngineTitle")} caption={t("videoEngineDevice")}>
          {showEngine && (
            <SettingsOptionList
              options={engineOptions}
              value={settings.engine}
              onChange={(value) => setEngineSetting("engine", value)}
              closesCard={false}
            />
          )}
          {switches.map((entry, index) => (
            <SettingsRow
              key={entry.id}
              icon={entry.icon}
              label={t(entry.id)}
              description={t(`${entry.id}Hint`)}
              last={index === switches.length - 1}
              trailing={
                <BrandSwitch
                  value={settings[entry.setting]}
                  onValueChange={(next) => setEngineSetting(entry.setting, next)}
                  accessibilityLabel={t(entry.id)}
                />
              }
            />
          ))}
        </SettingsSection>
      )}

      {showSubtitles && (
      <SettingsSection title={t("subtitles")} caption={t("subtitleTuningHint")}>
        <View style={st.block}>
          <Text style={st.title}>{t("subtitleScale")}</Text>
          <SteppedSlider
            value={settings.subtitleScale}
            min={0.5}
            max={2}
            step={0.1}
            onChange={(value) => setEngineSetting("subtitleScale", Math.round(value * 10) / 10)}
            accessibilityLabel={t("subtitleScale")}
            valueText={`${scalePercent} %`}
            leftLabel={t("subtitleScaleSmall")}
            rightLabel={t("subtitleScaleLarge")}
          />
        </View>
        <View style={[st.block, st.last]}>
          <Text style={st.title}>{t("subtitlePosition")}</Text>
          <SteppedSlider
            value={settings.subtitlePosition}
            min={50}
            max={100}
            step={5}
            onChange={(value) => setEngineSetting("subtitlePosition", Math.round(value))}
            accessibilityLabel={t("subtitlePosition")}
            valueText={`${settings.subtitlePosition} %`}
            leftLabel={t("subtitlePositionHigh")}
            rightLabel={t("subtitlePositionLow")}
          />
        </View>
      </SettingsSection>
      )}
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    block: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
      gap: spacing.sm,
    },
    last: { borderBottomWidth: 0 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary },
  });
