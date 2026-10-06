import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Chip } from "../../controls/Chip";
import { SectionTitle, settingsText } from "./settingsParts";
import type { SettingsRenderTier } from "./settingsTypes";

/**
 * La section « Mode Lite » de l'onglet Apparence (Android TV seulement) :
 * Automatique · Activé · Désactivé, en pastilles comme les autres choix
 * uniques ; dessous, ce qu'a détecté l'appareil (la raison de
 * l'automatique), puis ce que fait un changement — l'interface se relance,
 * la session reste. Le réglage vit dans le natif (lu avant la première
 * image) : `onSelectMode` l'écrit et recharge.
 */

const MODES = [
  // Automatique : l'appareil décide ; Activé : la jauge allégée ; Désactivé : tous les effets.
  { value: "auto", labelKey: "liteModeAuto", icon: "sliders" },
  { value: "on", labelKey: "reglageActive", icon: "gauge" },
  { value: "off", labelKey: "reglageDesactive", icon: "sparkles" },
] as const;

/** La raison détectée → sa phrase (`preferences:liteReason*`). */
const REASON_KEYS: Readonly<Record<string, string>> = {
  lowRamDevice: "liteReasonLowRamDevice",
  lowRam: "liteReasonLowRam",
  weakCores: "liteReasonWeakCores",
  slowBench: "liteReasonSlowBench",
  capable: "liteReasonCapable",
  unknown: "liteReasonUnknown",
};

export const LiteModeSection = memo(function LiteModeSection({ model, onSelectMode }: {
  model: SettingsRenderTier;
  onSelectMode?: (mode: SettingsRenderTier["mode"]) => void;
}) {
  const { t } = useTranslation("preferences");
  const reasonKey = REASON_KEYS[model.detected.reason] ?? "liteReasonUnknown";
  return (
    <View>
      <SectionTitle title={t("liteModeTitle")} caption={t("liteModeCaption")} />
      <View style={styles.chips}>
        {MODES.map((choice) => (
          <Chip
            key={choice.value}
            label={t(choice.labelKey)}
            icon={model.mode === choice.value ? "check" : choice.icon}
            selected={model.mode === choice.value}
            focusKey={`settings:lite:${choice.value}`}
            onPress={onSelectMode && model.mode !== choice.value ? () => onSelectMode(choice.value) : undefined}
          />
        ))}
      </View>
      <Text style={[settingsText.hint, styles.hint]}>
        {t("liteModeDetected", { reason: t(reasonKey, { detail: model.detected.detail ?? "" }) })}
      </Text>
      {model.forced ? <Text style={[settingsText.small, styles.note]}>{t("liteModeForced")}</Text> : null}
      <Text style={[settingsText.small, styles.note]}>{t("liteModeReloadHint")}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 8 },
  hint: { marginTop: 22, maxWidth: 1040 },
  note: { marginTop: 12, maxWidth: 1040 },
});
