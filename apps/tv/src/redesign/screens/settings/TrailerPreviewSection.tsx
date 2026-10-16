import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SectionTitle } from "./settingsParts";
import { ToggleRow } from "./ToggleRow";
import type { SettingsTrailerPreviews } from "./settingsTypes";

/**
 * Les aperçus de bande-annonce au focus des cartes (Réglages › Lecture) : les
 * allumer, et leur son — réglages de CE téléviseur. Absente quand le serveur
 * ne sait pas servir d'aperçu (capacité `trailers.preview`).
 */
export const TrailerPreviewSection = memo(function TrailerPreviewSection({
  model,
  onToggleEnabled,
  onToggleSound,
}: {
  model: SettingsTrailerPreviews;
  onToggleEnabled?: (next: boolean) => void;
  onToggleSound?: (next: boolean) => void;
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
    </View>
  );
});

const styles = StyleSheet.create({
  toggles: { gap: 18 },
});
