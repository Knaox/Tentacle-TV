import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Chip } from "../../controls/Chip";
import { SectionTitle, settingsText } from "./settingsParts";
import type { SettingsScrubCountdown } from "./settingsTypes";

/**
 * La section « Avance rapide » de l'onglet Lecture (Apple TV) : ce que fait
 * le décompte lancé quand on lâche la télécommande pendant une avance
 * rapide — revenir où l'on était (le défaut) ou reprendre à la nouvelle
 * position —, et son délai. Deux choix uniques en pastilles, comme le mode du
 * lecteur au-dessus ; la phrase du dessous dit, en clair, ce que fera le
 * choix posé. Réglage du profil, rangé sur le téléviseur
 * (`lib/scrubCountdownSettings.ts`).
 */

const OUTCOMES = [
  { value: "return", labelKey: "scrubCountdownReturn", icon: "history" },
  { value: "resume", labelKey: "scrubCountdownResume", icon: "play" },
] as const;

export const ScrubCountdownSection = memo(function ScrubCountdownSection({
  model,
  onSelectOutcome,
  onSelectDelay,
}: {
  model: SettingsScrubCountdown;
  onSelectOutcome?: (outcome: SettingsScrubCountdown["outcome"]) => void;
  onSelectDelay?: (seconds: number) => void;
}) {
  const { t } = useTranslation("preferences");
  const { outcome, delaySeconds } = model;
  return (
    <View>
      <SectionTitle title={t("scrubCountdownTitle")} caption={t("scrubCountdownCaption")} />
      <Text style={[settingsText.label, styles.label]}>{t("scrubCountdownEndLabel")}</Text>
      <View style={styles.chips}>
        {OUTCOMES.map((choice) => (
          <Chip
            key={choice.value}
            label={t(choice.labelKey)}
            icon={outcome === choice.value ? "check" : choice.icon}
            selected={outcome === choice.value}
            focusKey={`settings:scrubOutcome:${choice.value}`}
            onPress={onSelectOutcome ? () => onSelectOutcome(choice.value) : undefined}
          />
        ))}
      </View>
      <Text style={[settingsText.label, styles.label, styles.second]}>{t("scrubCountdownDelayLabel")}</Text>
      <View style={styles.chips}>
        {model.delays.map((seconds) => (
          <Chip
            key={seconds}
            label={t("scrubCountdownDelay", { seconds })}
            icon={delaySeconds === seconds ? "check" : undefined}
            selected={delaySeconds === seconds}
            focusKey={`settings:scrubDelay:${seconds}`}
            onPress={onSelectDelay ? () => onSelectDelay(seconds) : undefined}
          />
        ))}
      </View>
      <Text style={[settingsText.hint, styles.hint]}>
        {t(outcome === "return" ? "scrubCountdownReturnHint" : "scrubCountdownResumeHint", { seconds: delaySeconds })}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  label: { marginTop: 26, marginBottom: 16 },
  second: { marginTop: 30 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  hint: { marginTop: 22, maxWidth: 1040 },
});
