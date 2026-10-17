import type { OwnPinMode } from "@tentacle-tv/tv-core";
import type { FamilyProfileColor, HeroMode, PlaybackPreset, StillWatchingSettings } from "@tentacle-tv/shared";
import type { IconName } from "../../icons/Icon";

/**
 * Le contrat des réglages : ce que l'intégration résout avant de monter la
 * vue. Les libellés FIXES (titres, aides, boutons) sont traduits par la vue ;
 * tout ce qui dépend du compte, du serveur ou de l'appareil arrive résolu.
 */

export type SettingsTab = "account" | "playback" | "home" | "appearance" | "navigation" | "about" | "licenses";

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
  /** Apple TV passée aux profils (Famille) : le profil ouvert. Absent : la
   *  TV d'avant les profils — le compte jumelé, « Changer de serveur » et
   *  « Déjumeler », comme toujours. */
  profile?: SettingsProfile | null;
  /** La galerie des avatars : « Changer la photo » (il en a une), « Choisir une
   *  photo » (il n'en a pas). Absent : un serveur qui ne déclare pas
   *  `avatars.devicePhoto` — aucun bouton. */
  photo?: "change" | "choose" | null;
}

export interface SettingsProfile {
  /** « Propriétaire de la famille », « Parent · famille de Damien », « Membre · famille de Damien »,
   *  « Invité · famille de Damien » — d'après la liste relue (tv-core `openProfileState`).
   *  Null : aucun rôle à dire (un compte sans famille, le compte de démonstration de la revue). */
  role: string | null;
  color: FamilyProfileColor;
  /** « Gérer les profils » : un profil qui gère, avec son code PIN (décision du 16/10). */
  canManage: boolean;
  /** Il gérerait avec un code : l'indice « Posez un code… », au-dessus de « Créer un code PIN ». */
  manageNeedsPin: boolean;
  /** Seul le profil du propriétaire déjumelle la TV. */
  canUnpair: boolean;
  /** Ce que dit « Oublier ce jumelage » : ce que fait le déjumelage, ou qui peut le faire. */
  unpairCaption: string;
  /** SON code PIN : a-t-il un code, et les gestes offerts (aucun pour un invité ni pour le compte de démonstration — `ownPinModesFor`). */
  pin: { hasPin: boolean; modes: OwnPinMode[] };
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

/** Le réglage « Avance rapide » du profil (Apple TV) : ce que fait le
 *  décompte du défilement à son terme, et au bout de combien. */
export interface SettingsScrubCountdown {
  outcome: "return" | "resume";
  delaySeconds: number;
  /** Les délais offerts, en secondes. */
  delays: readonly number[];
}

export interface SettingsPlayback {
  /** Le mode lu sur les réglages du compte (`detectPreset`). */
  preset: PlaybackPreset;
  interfaceLanguage: InterfaceLanguage;
  libraries: LibraryPrefModel[];
  /** Android TV seulement : les réglages d'APPAREIL du décodeur. Absent sur
   *  tvOS — la section ne s'affiche pas. */
  device?: { tunneling: boolean; matchFrameRate: boolean } | null;
  /** Apple TV seulement : le réglage « Avance rapide ». Absent ailleurs — la
   *  section ne s'affiche pas. */
  scrubCountdown?: SettingsScrubCountdown | null;
  /** Les aperçus de bande-annonce au focus des cartes. Absent : le serveur ne
   *  sait pas en servir (capacité `trailers.preview`) — la section ne s'affiche pas. */
  trailerPreviews?: SettingsTrailerPreviews | null;
  /** « Vous regardez encore ? », réglage du COMPTE. Absent : le serveur ne le
   *  connaît pas (capacité `playback.stillWatching`) — la section ne s'affiche pas. */
  stillWatching?: StillWatchingSettings | null;
}

/** Les aperçus de bande-annonce au focus : réglages de CE téléviseur. */
export interface SettingsTrailerPreviews {
  enabled: boolean;
  sound: boolean;
  /** Le délai entre l'arrivée du focus et la première image (ms, tv-core `TV_TRAILER_PREVIEW_DELAYS`). */
  delay: number;
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

/**
 * L'onglet « Licences » : la mention de l'AGPL et la source de CETTE version,
 * puis les documents à lire — les composants tiers, chaque texte de licence.
 */
export interface SettingsLicenses {
  statement: string;
  sourceUrl: string;
  documents: Array<{ title: string; caption: string }>;
}

/** Un document ouvert dans le lecteur : son titre, son texte en blocs. */
export interface LicenseReaderModel {
  title: string;
  blocks: string[];
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

/**
 * Le mode Lite (Android TV seulement, trait `renderTierSetting`) : le réglage,
 * le niveau en vigueur et ce qu'a DÉTECTÉ l'automatique (tv-core
 * `device/renderTier`), dit en sous-titre.
 */
export interface SettingsRenderTier {
  mode: "auto" | "on" | "off";
  tier: "normal" | "lite";
  detected: { tier: "normal" | "lite"; reason: string; detail?: string };
  /** Une propriété de débogage impose le niveau (`debug.tentacle.lite`). */
  forced: boolean;
}

/**
 * L'onglet « Personnalisation » : le bandeau principal de l'accueil, réglage
 * du COMPTE (`/api/preferences/home-layout`) — tous ses appareils suivent.
 * Les sources arrivent déjà réduites à ce que le serveur sait servir (shared
 * `heroModesOffered`) ; les libellés sont traduits par la vue (shared
 * `heroModeLabelKey` / `heroModeHintKey`).
 */
export interface SettingsHome {
  /** Les sources proposées, dans l'ordre affiché. */
  modes: readonly HeroMode[];
  /** La source retenue. */
  current: HeroMode;
  /** « Un titre choisi » : le nom du titre à l'affiche ; absent tant qu'il n'est pas lu. */
  fixedTitle?: string | null;
  /** « Un titre choisi » demandé sans aucun favori : la section le dit. */
  noFavorites?: boolean;
  /** « Tendances actuelles » en tête de « Pour vous » (préférence du compte) ;
   *  absent face à un serveur qui ne déclare pas `reco.trending` : pas d'interrupteur. */
  trendingNow?: boolean;
}

