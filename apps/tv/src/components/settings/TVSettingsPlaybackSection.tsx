import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useLibraryPreferences,
  useSetLibraryPreference,
  useDeleteLibraryPreference,
  useSetInterfaceLanguage,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import { Focusable } from "../focus/Focusable";
import { SelectionModal } from "../SelectionModal";
import { TVLibraryPrefCard, type TvSetting } from "./TVLibraryPrefCard";
import { LANGUAGE_KEYS, LANGUAGE_CODES, INTERFACE_LANGUAGES, SUBTITLE_MODES } from "../../utils/languageKeys";
import { TVPlaybackSettingsSection } from "./TVPlaybackSettingsSection";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

/**
 * Les réglages de lecture — parité `PlaybackScreenTv` (LG) : la langue de
 * l'interface, puis PAR bibliothèque l'audio, le mode de sous-titres et leur
 * langue, via les hooks partagés de `@tentacle-tv/api-client` (même stockage
 * serveur que le web et la LG). Les `fetch()` bruts, l'état de chargement
 * manuel et la liste locale de 20 langues de l'ancien écran disparaissent —
 * on y gagne les 38 langues et le bouton « Réinitialiser » par bibliothèque.
 */
export function TVSettingsPlaybackSection() {
  const { t, i18n } = useTranslation("preferences");
  const { storage } = useTentacleConfig();
  const { data: libraries } = useLibraries();
  const { data: preferences } = useLibraryPreferences();
  const savePreference = useSetLibraryPreference();
  const deletePreference = useDeleteLibraryPreference();
  const setLanguage = useSetInterfaceLanguage();

  /** Le réglage dont on choisit la valeur, s'il y en a un. */
  const [open, setOpen] = useState<{ library: string; setting: TvSetting } | null>(null);

  const languages = useMemo(
    () => LANGUAGE_CODES.map((code) => ({ value: code, label: t(LANGUAGE_KEYS[code]) })),
    [t],
  );
  const modes = useMemo(
    () => SUBTITLE_MODES.map((mode) => ({ value: mode.value, label: t(mode.key) })),
    [t],
  );

  const languageName = useCallback(
    (code: string | null | undefined, fallbackLabel: string) =>
      code ? (LANGUAGE_KEYS[code] ? t(LANGUAGE_KEYS[code]) : code) : fallbackLabel,
    [t],
  );

  const changeInterfaceLanguage = useCallback(
    (code: string) => {
      i18n.changeLanguage(code);
      storage.setItem("tentacle_language", code);
      setLanguage.mutate(code);
    },
    [i18n, storage, setLanguage],
  );

  const apply = useCallback(
    (value: string) => {
      if (!open) return;
      const current = preferences?.find((pref) => pref.libraryId === open.library);
      // Une valeur vide efface le réglage sans effacer les deux autres : le
      // backend fait un upsert du trio, pas une fusion champ par champ.
      savePreference.mutate({
        libraryId: open.library,
        audioLang: open.setting.key === "audio" ? value || null : (current?.audioLang ?? null),
        subtitleLang:
          open.setting.key === "sousTitres" ? value || null : (current?.subtitleLang ?? null),
        subtitleMode:
          open.setting.key === "mode"
            ? (value as "none" | "always" | "forced" | "signs")
            : (current?.subtitleMode ?? "none"),
      });
      setOpen(null);
    },
    [savePreference, open, preferences],
  );

  return (
    <View>
      {/* Passages d'un épisode, puis sa fin — réglages de COMPTE, partagés
          avec le téléphone et le web (cf. `TVPlaybackSettingsSection`). */}
      <TVPlaybackSettingsSection />
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
        {(libraries ?? []).map((library) => {
          const pref = preferences?.find((entry) => entry.libraryId === library.Id);
          const settings: TvSetting[] = [
            {
              key: "audio",
              label: t("audio"),
              value: languageName(pref?.audioLang, t("default")),
              choices: [{ value: "", label: t("default") }, ...languages],
              selection: pref?.audioLang ?? "",
            },
            {
              key: "mode",
              label: t("subtitleMode"),
              value: t(
                // Une valeur persistée hors liste (legacy) ne doit pas faire
                // tomber l'écran : repli sur « désactivés ».
                (SUBTITLE_MODES.find((mode) => mode.value === (pref?.subtitleMode ?? "none")) ??
                  SUBTITLE_MODES[0]).key,
              ),
              choices: modes,
              selection: pref?.subtitleMode ?? "none",
            },
            {
              key: "sousTitres",
              label: t("subtitles"),
              value: languageName(pref?.subtitleLang, t("none")),
              choices: [{ value: "", label: t("none") }, ...languages],
              selection: pref?.subtitleLang ?? "",
            },
          ];

          return (
            <TVLibraryPrefCard
              key={library.Id}
              name={library.Name}
              settings={settings}
              customized={!!pref}
              onOpen={(setting) => setOpen({ library: library.Id, setting })}
              onReset={() => deletePreference.mutate(library.Id)}
            />
          );
        })}
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
