import { View, Text, StyleSheet, Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { setEngineSetting, useEngineSettings } from "@/player/engine/engineSettings";
import type { VideoEngineSetting } from "@/player/engine/types";
import { isMpvAvailable } from "../../../modules/mpv-player";
import { BrandSwitch } from "./BrandSwitch";
import { SettingsOptionList, type SettingsOption } from "./SettingsOptionList";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";
import { SteppedSlider } from "./SteppedSlider";

const ENGINE_OPTIONS: readonly VideoEngineSetting[] = ["auto", "native", "mpv"];
const ENGINE_LABEL_KEYS = { auto: "videoEngineAuto", native: "videoEngineSystem", mpv: "videoEngineAdvanced" } as const;
const ENGINE_HINT_KEYS = { auto: "videoEngineAutoHint", native: "videoEngineSystemHint", mpv: "videoEngineAdvancedHint" } as const;
const ENGINE_ICONS = { auto: "zap", native: "smartphone", mpv: "cpu" } as const;

/**
 * Les réglages d'APPAREIL du lecteur vidéo — ils ne suivent pas le compte :
 * ils dépendent de la puce, de l'écran et des écouteurs de ce téléphone.
 * Deux sections : le moteur (lignes à coche, chacune avec sa phrase) et son
 * interrupteur propre à la plateforme, puis la taille et la position des
 * sous-titres. Le mot « mpv » ne s'écrit jamais à l'écran : « lecteur
 * avancé » et « lecteur système ». Sans lecteur avancé dans cette build, rien.
 */
export function VideoEngineSection() {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  const settings = useEngineSettings();
  if (!isMpvAvailable()) return null;

  const engineOptions: SettingsOption<VideoEngineSetting>[] = ENGINE_OPTIONS.map((value) => ({
    value,
    label: t(ENGINE_LABEL_KEYS[value]),
    description: t(ENGINE_HINT_KEYS[value]),
    icon: ENGINE_ICONS[value],
  }));
  const scalePercent = Math.round(settings.subtitleScale * 100);
  const ios = Platform.OS === "ios";
  const switchKey = ios ? "preferSystemAtmos" : "styledSubtitlesViaMpv";
  const switchValue = ios ? settings.preferSystemAtmos : settings.styledSubtitlesViaMpv;

  return (
    <>
      <SettingsSection title={t("videoEngineTitle")} caption={t("videoEngineDevice")}>
        <SettingsOptionList
          options={engineOptions}
          value={settings.engine}
          onChange={(value) => setEngineSetting("engine", value)}
          closesCard={false}
        />
        <SettingsRow
          icon={ios ? "speaker" : "type"}
          label={t(switchKey)}
          description={t(`${switchKey}Hint`)}
          last
          trailing={
            <BrandSwitch
              value={switchValue}
              onValueChange={(next) => setEngineSetting(switchKey, next)}
              accessibilityLabel={t(switchKey)}
            />
          }
        />
      </SettingsSection>

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
