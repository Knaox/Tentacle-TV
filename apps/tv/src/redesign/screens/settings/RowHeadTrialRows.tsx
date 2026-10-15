import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { RowHeadEnd, RowHeadOptions, RowHeadRelease } from "@tentacle-tv/tv-core";
import { Chip } from "../../controls/Chip";
import { settingsText } from "./settingsParts";

/**
 * L'ESSAI « la carte en aperçu passe en tête » (lot du 16/10), sous les
 * aperçus de Réglages › Lecture : ce que fait une rangée en bout de course, et
 * quand le focus la quitte (tv-core `trailerPreviewRowHead.ts`). Réglage de CE
 * téléviseur, le temps de choisir ; il partira, le choix fait.
 */

const ENDS: ReadonlyArray<{ value: RowHeadEnd; label: string; hint: string }> = [
  { value: "stop", label: "tvRowHeadEndStop", hint: "tvRowHeadEndStopHint" },
  { value: "overscroll", label: "tvRowHeadEndOverscroll", hint: "tvRowHeadEndOverscrollHint" },
];

const RELEASES: ReadonlyArray<{ value: RowHeadRelease; label: string; hint: string }> = [
  { value: "stay", label: "tvRowHeadReleaseStay", hint: "tvRowHeadReleaseStayHint" },
  { value: "return", label: "tvRowHeadReleaseReturn", hint: "tvRowHeadReleaseReturnHint" },
];

export const RowHeadTrialRows = memo(function RowHeadTrialRows({
  model,
  onChange,
}: {
  model: RowHeadOptions;
  onChange?: (patch: Partial<RowHeadOptions>) => void;
}) {
  const { t } = useTranslation("trailerPreview");
  const end = ENDS.find((choice) => choice.value === model.end) ?? ENDS[0];
  const release = RELEASES.find((choice) => choice.value === model.release) ?? RELEASES[0];
  return (
    <View>
      <Text style={[settingsText.label, styles.label]}>{t("tvRowHeadEndLabel")}</Text>
      <View style={styles.chips}>
        {ENDS.map((choice) => (
          <Chip
            key={choice.value}
            label={t(choice.label)}
            icon={model.end === choice.value ? "check" : undefined}
            selected={model.end === choice.value}
            focusKey={`settings:rowHeadEnd:${choice.value}`}
            onPress={onChange ? () => onChange({ end: choice.value }) : undefined}
          />
        ))}
      </View>
      <Text style={[settingsText.hint, styles.hint]}>{t(end.hint)}</Text>
      <Text style={[settingsText.label, styles.label]}>{t("tvRowHeadReleaseLabel")}</Text>
      <View style={styles.chips}>
        {RELEASES.map((choice) => (
          <Chip
            key={choice.value}
            label={t(choice.label)}
            icon={model.release === choice.value ? "check" : undefined}
            selected={model.release === choice.value}
            focusKey={`settings:rowHeadRelease:${choice.value}`}
            onPress={onChange ? () => onChange({ release: choice.value }) : undefined}
          />
        ))}
      </View>
      <Text style={[settingsText.hint, styles.hint]}>{t(release.hint)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  label: { marginTop: 30, marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  hint: { marginTop: 14 },
});
