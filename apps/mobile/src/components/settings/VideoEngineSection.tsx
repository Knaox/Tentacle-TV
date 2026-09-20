import { View, Text, StyleSheet, Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { setEngineSetting, useEngineSettings } from "@/player/engine/engineSettings";
import type { VideoEngineSetting } from "@/player/engine/types";
import { isMpvAvailable } from "../../../modules/mpv-player";
import { BrandSwitch } from "./BrandSwitch";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingsSection } from "./SettingsSection";
import { SteppedSlider } from "./SteppedSlider";

const ENGINE_OPTIONS: readonly VideoEngineSetting[] = ["auto", "native", "mpv"];
const ENGINE_LABEL_KEYS = { auto: "videoEngineAuto", native: "videoEngineSystem", mpv: "videoEngineAdvanced" } as const;
const ENGINE_HINT_KEYS = { auto: "videoEngineAutoHint", native: "videoEngineSystemHint", mpv: "videoEngineAdvancedHint" } as const;

/**
 * Les réglages d'APPAREIL du lecteur vidéo — ils ne suivent pas le compte :
 * ils dépendent de la puce, de l'écran et des écouteurs de ce téléphone. Le
 * mot « mpv » ne s'écrit jamais à l'écran : « lecteur avancé » et « lecteur
 * système ». Sans lecteur avancé dans cette build, la section n'existe pas.
 */
export function VideoEngineSection() {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  const settings = useEngineSettings();
  if (!isMpvAvailable()) return null;

  const scalePercent = Math.round(settings.subtitleScale * 100);
  return (
    <SettingsSection title={t("videoEngineTitle")} caption={t("videoEngineDevice")}>
      <View style={st.block}>
        <Text style={st.title}>{t("videoEngineLabel")}</Text>
        <SegmentedChoice
          accessibilityLabel={t("videoEngineLabel")}
          value={settings.engine}
          options={ENGINE_OPTIONS.map((value) => ({ value, label: t(ENGINE_LABEL_KEYS[value]) }))}
          onChange={(value) => {
            const chosen = ENGINE_OPTIONS.find((entry) => entry === value);
            if (chosen) setEngineSetting("engine", chosen);
          }}
        />
        <Text style={st.hint}>{t(ENGINE_HINT_KEYS[settings.engine])}</Text>
      </View>

      {Platform.OS === "ios" ? (
        <View style={[st.block, st.row]}>
          <View style={st.grow}>
            <Text style={st.title}>{t("preferSystemAtmos")}</Text>
            <Text style={st.hint}>{t("preferSystemAtmosHint")}</Text>
          </View>
          <BrandSwitch
            value={settings.preferSystemAtmos}
            onValueChange={(next) => setEngineSetting("preferSystemAtmos", next)}
            accessibilityLabel={t("preferSystemAtmos")}
          />
        </View>
      ) : (
        <View style={[st.block, st.row]}>
          <View style={st.grow}>
            <Text style={st.title}>{t("styledSubtitlesViaMpv")}</Text>
            <Text style={st.hint}>{t("styledSubtitlesViaMpvHint")}</Text>
          </View>
          <BrandSwitch
            value={settings.styledSubtitlesViaMpv}
            onValueChange={(next) => setEngineSetting("styledSubtitlesViaMpv", next)}
            accessibilityLabel={t("styledSubtitlesViaMpv")}
          />
        </View>
      )}

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
        <Text style={st.hint}>{t("subtitleTuningHint")}</Text>
      </View>
    </SettingsSection>
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
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    grow: { flex: 1, gap: spacing.xs },
    last: { borderBottomWidth: 0 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    hint: { ...typography.small, color: t.colors.text.tertiary, lineHeight: 17 },
  });
