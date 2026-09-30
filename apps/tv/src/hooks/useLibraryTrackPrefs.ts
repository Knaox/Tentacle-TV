import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteLibraryPreference,
  useLibraries,
  useLibraryPreferences,
  useSetLibraryPreference,
} from "@tentacle-tv/api-client";
import type { LibrarySettingKey } from "../redesign/screens/settings/settingsTypes";
import { LANGUAGE_CODES, LANGUAGE_KEYS, SUBTITLE_MODES } from "../utils/languageKeys";

/**
 * Les pistes par défaut de chaque bibliothèque — l'audio, le mode et la
 * langue des sous-titres —, telles que les réglages des deux téléviseurs les
 * montrent : la valeur retenue, son libellé résolu, la liste de choix.
 * Mêmes hooks et même stockage serveur que le web et la LG.
 */

export interface TrackChoice {
  value: string;
  label: string;
}

export interface LibraryTrackSetting {
  key: LibrarySettingKey;
  /** Ce qu'on règle (« Audio »). */
  label: string;
  /** La valeur affichée, résolue (« Japonais », « Par défaut »). */
  value: string;
  choices: TrackChoice[];
  /** La valeur retenue (`""` = par défaut / aucun). */
  selection: string;
}

export interface LibraryTrackPrefs {
  id: string;
  name: string;
  /** Une préférence existe : « Réinitialiser » a un sens. */
  customized: boolean;
  settings: LibraryTrackSetting[];
}

type SubtitleMode = "none" | "always" | "forced" | "signs";

export function useLibraryTrackPrefs() {
  const { t } = useTranslation("preferences");
  const { data: libraries } = useLibraries();
  const { data: preferences } = useLibraryPreferences();
  const { mutate: save } = useSetLibraryPreference();
  const { mutate: remove } = useDeleteLibraryPreference();

  const languages = useMemo<TrackChoice[]>(
    () => LANGUAGE_CODES.map((code) => ({ value: code, label: t(LANGUAGE_KEYS[code]) })),
    [t],
  );
  const modes = useMemo<TrackChoice[]>(
    () => SUBTITLE_MODES.map((mode) => ({ value: mode.value, label: t(mode.key) })),
    [t],
  );

  const items = useMemo<LibraryTrackPrefs[]>(() => {
    const languageName = (code: string | null | undefined, fallback: string) =>
      code ? (LANGUAGE_KEYS[code] ? t(LANGUAGE_KEYS[code]) : code) : fallback;
    return (libraries ?? []).map((library) => {
      const pref = preferences?.find((entry) => entry.libraryId === library.Id);
      const mode = pref?.subtitleMode ?? "none";
      return {
        id: library.Id,
        name: library.Name ?? "",
        customized: !!pref,
        settings: [
          {
            key: "audio",
            label: t("audio"),
            value: languageName(pref?.audioLang, t("default")),
            choices: [{ value: "", label: t("default") }, { value: "original", label: t("langOriginal") }, ...languages],
            selection: pref?.audioLang ?? "",
          },
          {
            key: "subtitleMode",
            label: t("subtitleMode"),
            // Une valeur persistée hors liste (ancienne) ne fait pas tomber
            // l'écran : repli sur « désactivés ».
            value: t((SUBTITLE_MODES.find((entry) => entry.value === mode) ?? SUBTITLE_MODES[0]).key),
            choices: modes,
            selection: mode,
          },
          {
            key: "subtitles",
            label: t("subtitles"),
            value: languageName(pref?.subtitleLang, t("none")),
            choices: [{ value: "", label: t("none") }, ...languages],
            selection: pref?.subtitleLang ?? "",
          },
        ],
      };
    });
  }, [libraries, preferences, languages, modes, t]);

  /** Retient une valeur. Vide, elle efface CE réglage sans effacer les deux
   *  autres : le backend fait un upsert du trio, pas une fusion champ par champ. */
  const choose = useCallback((libraryId: string, key: LibrarySettingKey, value: string) => {
    const current = preferences?.find((pref) => pref.libraryId === libraryId);
    save({
      libraryId,
      audioLang: key === "audio" ? value || null : (current?.audioLang ?? null),
      subtitleLang: key === "subtitles" ? value || null : (current?.subtitleLang ?? null),
      subtitleMode: key === "subtitleMode" ? (value as SubtitleMode) : (current?.subtitleMode ?? "none"),
    });
  }, [preferences, save]);

  const reset = useCallback((libraryId: string) => remove(libraryId), [remove]);

  return { libraries: items, choose, reset };
}
