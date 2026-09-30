import { i18n, uiLanguage, type SubtitleMode } from "@tentacle-tv/shared";
import type {
  ChoiceListModel,
  LibraryPrefModel,
  LibrarySettingKey,
  SettingsAbout,
  SettingsAccount,
  SettingsChoice,
  SettingsPlayback,
} from "../../../src/redesign/screens/settings/settingsTypes";
import type { SettingsViewProps } from "../../../src/redesign/screens/settings/SettingsView";
// Les listes de langues et de modes de l'app : l'intégration résoudra les
// valeurs avec elles, le banc aussi (le banc n'est pas une vue).
import { LANGUAGE_CODES, LANGUAGE_KEYS, SUBTITLE_MODES } from "../../../src/utils/languageKeys";
import type { BenchData } from "./benchData";
import { paletteOf } from "./models";
import { benchNavigationSettings } from "./navModels";
import { navOf } from "./screenModels";

/**
 * Les props des réglages, tirées de l'instantané Knaoxtest : le vrai compte
 * (nom, portrait), les vraies bibliothèques, la version TV de `versions.json`.
 * L'instantané ne porte ni les préférences de bibliothèque ni les réglages de
 * lecture du compte : un jeu plausible les remplace (voir `PREF_SEEDS`).
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

/** Le serveur de développement du banc. */
export const DEV_SERVER = "http://localhost:3001";
export const TV_VERSION: string = require("../../../../../versions.json").tv;
export const DEVICE_LABEL = "Apple TV";

interface PrefSeed {
  audio: string | null;
  subtitleMode: SubtitleMode;
  subtitles: string | null;
}

/** Des préférences plausibles, par type de bibliothèque : VO sous-titrée pour
 *  les animés, défauts pour les films, VO et sous-titres forcés pour les séries. */
const PREF_SEEDS: Record<string, PrefSeed | null> = {
  "Animés": { audio: "jpn", subtitleMode: "always", subtitles: "fre" },
  Films: null,
  "Séries": { audio: "original", subtitleMode: "forced", subtitles: "fre" },
};

const languageLabel = (code: string | null, fallback: string) =>
  code ? (LANGUAGE_KEYS[code] ? t(`preferences:${LANGUAGE_KEYS[code]}`) : code) : fallback;

const modeLabel = (mode: SubtitleMode) =>
  t(`preferences:${(SUBTITLE_MODES.find((entry) => entry.value === mode) ?? SUBTITLE_MODES[0]).key}`);

const seedOf = (name: string): PrefSeed | null => PREF_SEEDS[name] ?? null;

export function librariesOf(data: BenchData): LibraryPrefModel[] {
  return data.snapshot.libraries.map((library) => {
    const seed = seedOf(library.name);
    return {
      id: library.id,
      name: library.name,
      values: {
        audio: languageLabel(seed?.audio ?? null, t("preferences:default")),
        subtitleMode: modeLabel(seed?.subtitleMode ?? "none"),
        subtitles: languageLabel(seed?.subtitles ?? null, t("preferences:none")),
      },
      customized: seed !== null,
    };
  });
}

const languages = (): SettingsChoice[] =>
  LANGUAGE_CODES.map((code) => ({ value: code, label: t(`preferences:${LANGUAGE_KEYS[code]}`) }));

/** La liste de choix d'un réglage, telle que l'app la construit. */
export function choiceListOf(data: BenchData, libraryIndex: number, key: LibrarySettingKey): ChoiceListModel {
  const library = data.snapshot.libraries[libraryIndex];
  const seed = library ? seedOf(library.name) : null;
  const titles: Record<LibrarySettingKey, string> = {
    audio: t("preferences:audio"),
    subtitleMode: t("preferences:subtitleMode"),
    subtitles: t("preferences:subtitles"),
  };
  const options: Record<LibrarySettingKey, () => SettingsChoice[]> = {
    audio: () => [{ value: "", label: t("preferences:default") }, { value: "original", label: t("preferences:langOriginal") }, ...languages()],
    subtitleMode: () => SUBTITLE_MODES.map((mode) => ({ value: mode.value, label: t(`preferences:${mode.key}`) })),
    subtitles: () => [{ value: "", label: t("preferences:none") }, ...languages()],
  };
  const selected: Record<LibrarySettingKey, string> = {
    audio: seed?.audio ?? "",
    subtitleMode: seed?.subtitleMode ?? "none",
    subtitles: seed?.subtitles ?? "",
  };
  return { title: titles[key], context: library?.name, options: options[key](), selected: selected[key] };
}

export function accountOf(data: BenchData): SettingsAccount {
  const profile = data.snapshot.profile;
  return {
    name: profile?.name ?? data.snapshot.account,
    avatarUri: profile?.image ? data.imageFile(profile.image) : undefined,
    serverUrl: DEV_SERVER,
    deviceLabel: DEVICE_LABEL,
  };
}

export function playbackOf(data: BenchData, overrides: Partial<SettingsPlayback> = {}): SettingsPlayback {
  return {
    preset: "default",
    interfaceLanguage: uiLanguage(i18n.language),
    libraries: librariesOf(data),
    device: null,
    ...overrides,
  };
}

export function aboutOf(data: BenchData): SettingsAbout {
  return {
    version: TV_VERSION,
    serverUrl: DEV_SERVER,
    userName: data.snapshot.profile?.name ?? data.snapshot.account,
    deviceLabel: DEVICE_LABEL,
    year: new Date().getFullYear(),
  };
}

const heroItem = (data: BenchData) => data.list("resume")[0] ?? data.list("movies")[0];

/** Le fond d'œuvre de l'aperçu du verre : celui du titre en reprise. */
export function glassPreviewOf(data: BenchData): string | undefined {
  const item = heroItem(data);
  return item ? data.image(item.SeriesId ?? item.Id, "Backdrop") ?? data.image(item.Id, "Backdrop") : undefined;
}

/** La lumière du fond : celle du héros de l'accueil, d'où l'on vient. */
export function heroPaletteOf(data: BenchData) {
  const item = heroItem(data);
  return item ? paletteOf(data, item) : undefined;
}

export function settingsPropsOf(data: BenchData, overrides: Partial<SettingsViewProps> = {}): SettingsViewProps {
  return {
    nav: navOf(data, "Settings"),
    tab: "account",
    account: accountOf(data),
    playback: playbackOf(data),
    about: aboutOf(data),
    navigation: benchNavigationSettings(data),
    glassPreviewUri: glassPreviewOf(data),
    palette: heroPaletteOf(data),
    ...overrides,
  };
}

/** Les images d'une scène des réglages, à précharger. */
export function settingsImages(data: BenchData): string[] {
  return [accountOf(data).avatarUri, glassPreviewOf(data)].filter((uri): uri is string => !!uri);
}
