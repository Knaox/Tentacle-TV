import type { PlaybackPreset } from "@tentacle-tv/shared";
import type { IconName } from "../../icons/Icon";

/**
 * Le contrat des réglages : ce que l'intégration résout avant de monter la
 * vue. Les libellés FIXES (titres, aides, boutons) sont traduits par la vue ;
 * tout ce qui dépend du compte, du serveur ou de l'appareil arrive résolu.
 */

export type SettingsTab = "account" | "playback" | "appearance" | "navigation" | "about";

export type InterfaceLanguage = "fr" | "en";

/** Les deux actions du compte, chacune à double appui. */
export type AccountAction = "changeServer" | "logout";

export interface SettingsAccount {
  /** Le nom du compte jumelé (`tentacle_user`). */
  name: string;
  /** Le portrait Jellyfin ; absent → l'initiale. */
  avatarUri?: string;
  /** L'adresse du serveur Tentacle (`tentacle_server_url`). */
  serverUrl: string;
  /** « Apple TV » ou « Android TV » (`TV_PLATFORM_LABEL`). */
  deviceLabel: string;
}

/** Les trois réglages de piste d'une bibliothèque. */
export type LibrarySettingKey = "audio" | "subtitleMode" | "subtitles";

export interface LibraryPrefModel {
  id: string;
  name: string;
  /** Les valeurs AFFICHÉES, déjà résolues (« Par défaut », « Japonais »,
   *  « Forcés uniquement ») : la liste des langues vit dans l'app. */
  values: Record<LibrarySettingKey, string>;
  /** Une préférence existe : « Réinitialiser » paraît. */
  customized: boolean;
}

export interface SettingsPlayback {
  /** Le mode lu sur les réglages du compte (`detectPreset`). */
  preset: PlaybackPreset;
  interfaceLanguage: InterfaceLanguage;
  libraries: LibraryPrefModel[];
  /** Android TV seulement : les réglages d'APPAREIL du décodeur. Absent sur
   *  tvOS — la section ne s'affiche pas. */
  device?: { tunneling: boolean; matchFrameRate: boolean } | null;
}

export interface SettingsChoice {
  value: string;
  label: string;
}

/** La grande liste de choix, ouverte par un réglage de bibliothèque. */
export interface ChoiceListModel {
  /** Le réglage (« Audio »). */
  title: string;
  /** Sa portée (« Animés »). */
  context?: string;
  options: SettingsChoice[];
  /** La valeur retenue (`""` = par défaut / aucun). */
  selected: string;
}

export interface SettingsAbout {
  /** `versions.json`, champ `tv`. */
  version: string;
  serverUrl: string;
  userName: string;
  deviceLabel: string;
  year: number;
}

/** Une entrée de la navigation, au réglage « Navigation ». */
export interface NavigationSettingsEntry {
  key: string;
  label: string;
  icon: IconName;
  hidden: boolean;
}

/** Le réglage « Navigation » : les entrées organisables de la barre de gauche. */
export interface SettingsNavigation {
  /** Dans l'ordre choisi, masquées comprises. */
  entries: NavigationSettingsEntry[];
  /** L'entrée soulevée : HAUT / BAS la déplacent, OK la pose. */
  movingKey: string | null;
  /** Une entrée est masquée : « Tout afficher » paraît. */
  canShowAll: boolean;
  /** L'ordre a été changé : « Ordre par défaut » paraît. */
  canResetOrder: boolean;
}
