import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { SelectionModal } from "../SelectionModal";
import { TVLibraryPrefCard } from "./TVLibraryPrefCard";
import { INTERFACE_LANGUAGES } from "../../utils/languageKeys";
import { TVPlaybackSettingsSection } from "./TVPlaybackSettingsSection";
import { TVDevicePlaybackSection } from "./TVDevicePlaybackSection";
import { useInterfaceLanguage } from "../../hooks/useInterfaceLanguage";
import { useLibraryTrackPrefs, type LibraryTrackSetting } from "../../hooks/useLibraryTrackPrefs";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

/**
 * Les réglages de lecture — parité `PlaybackScreenTv` (LG) : la langue de
 * l'interface, puis PAR bibliothèque l'audio, le mode de sous-titres et leur
 * langue. La logique (valeurs résolues, listes de choix, upsert du trio) est
 * commune aux deux téléviseurs : `useLibraryTrackPrefs`, `useInterfaceLanguage`.
 */
export function TVSettingsPlaybackSection() {
  const { t, i18n } = useTranslation("preferences");
  const { change: changeInterfaceLanguage } = useInterfaceLanguage();
  const { libraries, choose, reset } = useLibraryTrackPrefs();

  /** Le réglage dont on choisit la valeur, s'il y en a un. */
  const [open, setOpen] = useState<{ library: string; setting: LibraryTrackSetting } | null>(null);

  const apply = (value: string) => {
    if (!open) return;
    choose(open.library, open.setting.key, value);
    setOpen(null);
  };

  return (
    <View>
      {/* Passages d'un épisode, puis sa fin — réglages de COMPTE, partagés
          avec le téléphone et le web (cf. `TVPlaybackSettingsSection`). */}
      <TVPlaybackSettingsSection />
      {/* Réglages d'APPAREIL (Android TV) : le décodeur de ce téléviseur. */}
      <TVDevicePlaybackSection />
      <Text
        style={{
          color: Colors.textTertiary,
          fontSize: 13,
          fontWeight: "600",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {t("interfaceLanguage")}
      </Text>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 36 }}>
        {INTERFACE_LANGUAGES.map((language) => {
          const active = i18n.language.startsWith(language.code);
          return (
            <Focusable
              key={language.code}
              variant="button"
              focusRadius={Button.medium.borderRadius}
              scaleOverride={1.04}
              onPress={() => changeInterfaceLanguage(language.code)}
              accessibilityLabel={language.label}
            >
              <View
                style={{
                  minWidth: 160,
                  alignItems: "center",
                  ...Button.medium,
                  borderWidth: 1,
                  borderColor: active ? brandAlpha(0.6) : Colors.glassBorder,
                  backgroundColor: active ? brandAlpha(0.18) : "transparent",
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    color: active ? Colors.accentPurpleLight : Colors.textPrimary,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  {language.label}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </View>

      <View style={{ gap: 20 }}>
        {libraries.map((library) => (
          <TVLibraryPrefCard
            key={library.id}
            name={library.name}
            settings={library.settings}
            customized={library.customized}
            onOpen={(setting) => setOpen({ library: library.id, setting })}
            onReset={() => reset(library.id)}
          />
        ))}
      </View>

      {open && (
        <SelectionModal
          title={open.setting.label}
          options={open.setting.choices}
          selectedValue={open.setting.selection}
          onSelect={apply}
          onClose={() => setOpen(null)}
        />
      )}
    </View>
  );
}
