import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TRAILER_PREVIEW_DELAYS, type TrailerPreviewDelay } from "@tentacle-tv/shared";
import { Chip } from "../../controls/Chip";
import { SectionTitle, settingsText } from "./settingsParts";
import { ToggleRow } from "./ToggleRow";
import type { SettingsTrailerPreviews } from "./settingsTypes";

/**
 * Les aperçus de bande-annonce au focus des cartes (Réglages › Lecture) : les
 * allumer, leur son, et le DÉLAI avant la première image — réglages de CE
 * téléviseur. Le son et le délai ne paraissent que les aperçus allumés (régler
 * une fonction éteinte n'a pas de sens). Absente quand le serveur ne sait pas
 * servir d'aperçu (capacité `trailers.preview`).
 */
export const TrailerPreviewSection = memo(function TrailerPreviewSection({
  model,
  onToggleEnabled,
  onToggleSound,
  onSelectDelay,
}: {
  model: SettingsTrailerPreviews;
  onToggleEnabled?: (next: boolean) => void;
  onToggleSound?: (next: boolean) => void;
  onSelectDelay?: (delay: TrailerPreviewDelay) => void;
}) {
  const { t } = useTranslation(["trailerPreview", "preferences"]);
  return (
    <View>
      <SectionTitle title={t("trailerPreview:settingSection")} />
      <View style={styles.toggles}>
        <ToggleRow
          icon="trailer"
          title={t("trailerPreview:tvSettingTitle")}
          description={t("trailerPreview:tvSettingDescription")}
          value={model.enabled}
          onLabel={t("preferences:reglageActive")}
          offLabel={t("preferences:reglageDesactive")}
          focusKey="settings:trailerPreviews"
          onToggle={onToggleEnabled}
        />
        {model.enabled ? (
          <ToggleRow
            icon="audio"
            title={t("trailerPreview:tvSoundTitle")}
            description={t("trailerPreview:tvSoundDescription")}
            value={model.sound}
            onLabel={t("preferences:reglageActive")}
            offLabel={t("preferences:reglageDesactive")}
            focusKey="settings:trailerPreviewSound"
            onToggle={onToggleSound}
          />
        ) : null}
      </View>
      {model.enabled ? (
        <View>
          <Text style={[settingsText.label, styles.label]}>{t("trailerPreview:delayTitle")}</Text>
          <View style={styles.chips}>
            {TRAILER_PREVIEW_DELAYS.map((delay) => (
              <Chip
                key={delay}
                label={t(`trailerPreview:delay_${delay}`)}
                icon={model.delay === delay ? "check" : undefined}
                selected={model.delay === delay}
                focusKey={`settings:trailerPreviewDelay:${delay}`}
                onPress={onSelectDelay ? () => onSelectDelay(delay) : undefined}
              />
            ))}
          </View>
          <Text style={[settingsText.hint, styles.hint]}>{t("trailerPreview:tvDelayDescription")}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  toggles: { gap: 18 },
  label: { marginTop: 30, marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  hint: { marginTop: 22, maxWidth: 1040 },
});
