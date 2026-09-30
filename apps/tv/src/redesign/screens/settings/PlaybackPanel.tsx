import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PRESET_HINT_KEYS, PRESET_LABEL_KEYS, SELECTABLE_PRESETS, type PlaybackPreset } from "@tentacle-tv/shared";
import { Chip } from "../../controls/Chip";
import { LibraryPrefCard } from "./LibraryPrefCard";
import { SectionTitle, settingsText } from "./settingsParts";
import { ToggleRow } from "./ToggleRow";
import type { InterfaceLanguage, LibrarySettingKey, SettingsPlayback } from "./settingsTypes";

/**
 * L'onglet Lecture, de haut en bas :
 * 1. « Ce que fait le lecteur » — UN choix parmi les modes du compte
 *    (`SELECTABLE_PRESETS`) ; « Personnalisé » se LIT (réglé sur ordinateur),
 *    il ne se choisit pas ;
 * 2. Android TV seulement : le décodeur de CE téléviseur (tunnel, fréquence) ;
 * 3. la langue de l'interface ;
 * 4. les pistes par défaut de chaque bibliothèque.
 * Branchement : `useOwnPlaybackSettings` + `detectPreset` / `setPlaybackSettings`
 * (`presetSettings`), `useExoTunneling` / `useExoMatchFrameRate`,
 * `useSetInterfaceLanguage` (+ `i18n.changeLanguage`, `tentacle_language`).
 */

export interface PlaybackPanelProps {
  playback: SettingsPlayback;
  onSelectPreset?: (preset: Exclude<PlaybackPreset, "custom">) => void;
  onSelectLanguage?: (language: InterfaceLanguage) => void;
  onOpenLibrarySetting?: (libraryId: string, key: LibrarySettingKey) => void;
  onResetLibrary?: (libraryId: string) => void;
  onToggleTunneling?: (next: boolean) => void;
  onToggleMatchFrameRate?: (next: boolean) => void;
}

const LANGUAGES: Array<{ code: InterfaceLanguage; label: string }> = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

export const PlaybackPanel = memo(function PlaybackPanel({
  playback,
  onSelectPreset,
  onSelectLanguage,
  onOpenLibrarySetting,
  onResetLibrary,
  onToggleTunneling,
  onToggleMatchFrameRate,
}: PlaybackPanelProps) {
  const { t } = useTranslation("preferences");
  const { preset, device } = playback;
  return (
    <View style={styles.root}>
      <View>
        <SectionTitle title={t("playbackModeLabel")} />
        <View style={styles.chips}>
          {SELECTABLE_PRESETS.map((value) => (
            <Chip
              key={value}
              label={t(PRESET_LABEL_KEYS[value])}
              icon={preset === value ? "check" : undefined}
              selected={preset === value}
              focusKey={`settings:preset:${value}`}
              onPress={onSelectPreset ? () => onSelectPreset(value) : undefined}
            />
          ))}
          {preset === "custom" ? (
            <Chip label={t(PRESET_LABEL_KEYS.custom)} icon="check" selected focusKey="settings:preset:custom" />
          ) : null}
        </View>
        <Text style={[settingsText.hint, styles.hint]}>{t(PRESET_HINT_KEYS[preset])}</Text>
        <Text style={[settingsText.small, styles.note]}>{t("playbackAdvancedOnDesktop")}</Text>
      </View>

      {device ? (
        <View>
          <SectionTitle title={t("videoEngineTitle")} caption={t("videoEngineDevice")} />
          <View style={styles.toggles}>
            <ToggleRow
              icon="layers"
              title={t("exoTunnelingLabel")}
              description={t("exoTunnelingHint")}
              value={device.tunneling}
              onLabel={t("reglageActive")}
              offLabel={t("reglageDesactive")}
              focusKey="settings:tunneling"
              onToggle={onToggleTunneling}
            />
            <ToggleRow
              icon="tv"
              title={t("exoMatchFrameRateLabel")}
              description={t("exoMatchFrameRateHint")}
              value={device.matchFrameRate}
              onLabel={t("reglageActive")}
              offLabel={t("reglageDesactive")}
              focusKey="settings:matchFrameRate"
              onToggle={onToggleMatchFrameRate}
            />
          </View>
        </View>
      ) : null}

      <View>
        <SectionTitle title={t("interfaceLanguage")} />
        <View style={styles.chips}>
          {LANGUAGES.map((language) => (
            <Chip
              key={language.code}
              label={language.label}
              icon={playback.interfaceLanguage === language.code ? "check" : undefined}
              selected={playback.interfaceLanguage === language.code}
              focusKey={`settings:lang:${language.code}`}
              onPress={onSelectLanguage ? () => onSelectLanguage(language.code) : undefined}
            />
          ))}
        </View>
      </View>

      {playback.libraries.length ? (
        <View>
          <SectionTitle title={t("title")} caption={t("subtitle")} />
          <View style={styles.cards}>
            {playback.libraries.map((library, index) => (
              <LibraryPrefCard
                key={library.id}
                library={library}
                focusPrefix={`settings:lib:${index}`}
                onOpen={onOpenLibrarySetting ? (key) => onOpenLibrarySetting(library.id, key) : undefined}
                onReset={onResetLibrary ? () => onResetLibrary(library.id) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 56 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  hint: { marginTop: 22, maxWidth: 1040 },
  note: { marginTop: 12, maxWidth: 1040 },
  toggles: { gap: 18 },
  cards: { gap: 22 },
});
