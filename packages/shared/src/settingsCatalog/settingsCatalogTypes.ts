import type { ServerCapability } from "../serverCapabilities/serverCapabilities";

/**
 * Le CATALOGUE des réglages du mobile et du web étroit (refonte du
 * 2026-10-20, décision de Damien : une structure, deux rendus). Six
 * rubriques, chacune une page de groupes ; chaque entrée est un réglage sur
 * place, une page (volet ou écran), une action ou un bloc. DEUX niveaux,
 * jamais trois. Module PUR : ni React, ni route, ni plateforme lue ici — le
 * client passe son contexte (`SettingsCatalogContext`) et fait correspondre
 * chaque identifiant à SON composant et à SA route.
 */

export type SettingsSectionId = "account" | "playback" | "devices" | "offline" | "notifications" | "help";

/** Les clients qui rendent le catalogue. */
export type SettingsPlatform = "mobile" | "web";

/**
 * La PORTÉE d'un réglage : `account` suit le compte (préférence enregistrée
 * par le serveur — le bureau, la TV, le téléphone la partagent), `device` ne
 * vit que dans le stockage de l'appareil. La pastille « Compte » / « Cet
 * appareil » ne dit que ça.
 */
export type SettingScope = "account" | "device";

/** Un libellé : sa clé et son espace i18n. */
export interface SettingsI18nRef {
  ns: string;
  key: string;
}

/**
 * Ce qu'une entrée exige pour paraître (toutes les conditions à la fois) :
 * - `online` : le serveur répond (pas hors ligne) ;
 * - `admin` : un administrateur ;
 * - `offlineVisible` : le droit de garder des titres, ou des titres déjà là ;
 * - `canGoOffline` : en ligne ET hors ligne permis (« Passer hors ligne ») ;
 * - `family` : le serveur annonce la Famille, activée, et l'écran est branché ;
 * - `familyEntry` : la page de la Famille mène à quelque chose pour ce compte —
 *   sa famille, une invitation reçue, ou une famille qu'il peut fonder (shared
 *   `familyEntryShown` : un droit coupé par l'administration n'y laisse rien) ;
 * - `canSwitchProfile` : en ligne, et la famille a au moins deux profils ;
 * - `launchAsked` : l'administration propose « Qui regarde ? » d'office sur
 *   cette plateforme (capacité `family.launchPlatforms`) ;
 * - `liquidGlass` : le rendu Liquid Glass existe sur cet appareil (iOS 26) ;
 * - `advancedEngine` : le lecteur avancé est dans ce binaire (moteur, sous-titres) ;
 * - `engineOptions` : la plateforme a au moins une option de lecteur ;
 * - `bootIntro` : l'ouverture animée du logo existe dans ce binaire ;
 * - `liveTransfers` : l'appareil sait montrer un transfert en direct (Live
 *   Activity d'iOS, notification permanente d'Android) ;
 * - `personal` : la session PERSONNELLE du compte, pas une session de profil
 *   de la Famille (l'app ouverte au nom d'un autre profil) — le serveur y
 *   refuse push, hors ligne, jumelage, mot de passe, compte, administration et
 *   gestes personnels de la Famille : leurs lignes disparaissent.
 * - `tickets`, `manageAccount`, `pairDevices`, `push`, `invites` : ce que le
 *   serveur dit que CETTE session peut faire (droits du compte, `SettingsAbility`) —
 *   « rien d'affiché sans le droit » (décision de Damien, 2026-10-20).
 * Ce qui dépend du CODE du serveur passe par `capability`, jamais par ici.
 */
export type SettingsRequirement =
  | "online" | "admin" | "offlineVisible" | "canGoOffline" | "family" | "familyEntry" | "canSwitchProfile" | "launchAsked"
  | "liquidGlass" | "advancedEngine" | "engineOptions" | "bootIntro" | "liveTransfers" | "personal"
  | SettingsAbility;

/**
 * Les DROITS de la session que les réglages lisent (le serveur les déclare,
 * `useAccountAbilities` ; face à un serveur d'avant, le comportement d'avant :
 * tout vrai) : écrire au support, gérer son compte (mot de passe, suppression),
 * jumeler une TV, recevoir des notifications push, créer des invitations.
 */
export type SettingsAbility = "tickets" | "manageAccount" | "pairDevices" | "push" | "invites";

/** Les réglages qui se font SUR PLACE ; leur portée est dans `settingsScopes.ts`. */
export type SettingsControlId =
  | "photo" | "userName" | "switchProfile" | "askAtLaunch"
  | "intros" | "nextAutoPlay" | "stillWatching" | "language" | "trendingNow"
  | "theme" | "liquidGlass" | "subtitleSize" | "subtitlePosition" | "dataSaver" | "engine" | "engineOptions"
  | "bootIntro" | "bootSound"
  | "wifiOnly" | "backgroundTransfers" | "notifyReady" | "liveTransfers"
  | "advancedOnDesktop";

/**
 * Le TYPE de contrôle d'un réglage sur place — ce que chaque client dessine :
 * un segmenté, un interrupteur, un curseur, des aperçus (thème), une ligne
 * qui ouvre une feuille, une ligne d'information, un renvoi.
 */
export type SettingsControlType = "segmented" | "switch" | "slider" | "chips" | "tiles" | "sheet" | "info" | "disclosure" | "link";

/** Les pages de deuxième niveau (volets) : un écran sur téléphone, la colonne de détail sur tablette. */
export type SettingsPaneId = "password" | "mediaLanguages" | "personalization" | "devices" | "notifications" | "invites";

/** Les écrans à part entière vers lesquels le catalogue renvoie ; chaque client a SA route. */
export type SettingsScreenId = "family" | "sessions" | "offlineTitles" | "support" | "about";

export type SettingsActionId = "changeServer" | "goOffline" | "removeAllOffline" | "clearCache" | "deleteAccount" | "privacyPolicy";

/** Un contenu riche posé tel quel, hors carte (il a déjà les siennes). */
export type SettingsBlockId = "scopeIntro" | "offlineSpace";

interface EntryBase {
  requires?: readonly SettingsRequirement[];
  /** Le serveur doit déclarer cette capacité. */
  capability?: ServerCapability;
  /** Les clients où l'entrée existe ; absent = tous. */
  platforms?: readonly SettingsPlatform[];
}

export interface SettingsControlEntry extends EntryBase {
  kind: "control";
  id: SettingsControlId;
}

export interface SettingsPaneEntry extends EntryBase {
  kind: "pane";
  id: SettingsPaneId;
  icon: string;
  label: SettingsI18nRef;
}

export interface SettingsScreenEntry extends EntryBase {
  kind: "screen";
  id: SettingsScreenId;
  icon: string;
  label: SettingsI18nRef;
}

export interface SettingsActionEntry extends EntryBase {
  kind: "action";
  id: SettingsActionId;
  icon: string;
  label: SettingsI18nRef;
  destructive?: boolean;
}

export interface SettingsBlockEntry extends EntryBase {
  kind: "block";
  id: SettingsBlockId;
}

export type SettingsCatalogEntry = SettingsControlEntry | SettingsPaneEntry | SettingsScreenEntry | SettingsActionEntry | SettingsBlockEntry;

export interface SettingsCatalogGroup {
  title?: SettingsI18nRef;
  /** La phrase sous la carte. */
  caption?: SettingsI18nRef;
  /** La portée commune du groupe (« Sur tous vos appareils » / « Sur cet appareil »). */
  scope?: SettingScope;
  entries: readonly SettingsCatalogEntry[];
}

/** Le résumé d'une rubrique sous son nom : le premier dont les conditions tiennent. */
export interface SettingsSectionSummary {
  requires?: readonly SettingsRequirement[];
  label: SettingsI18nRef;
}

export interface SettingsCatalogSection {
  id: SettingsSectionId;
  icon: string;
  label: SettingsI18nRef;
  summaries: readonly SettingsSectionSummary[];
  groups: readonly SettingsCatalogGroup[];
}

export interface SettingsCatalogContext {
  platform: SettingsPlatform;
  /** Ce que le serveur déclare (`useServerCapabilities`). */
  capabilities: ReadonlySet<ServerCapability>;
  offline: boolean;
  isAdmin: boolean;
  offlineVisible: boolean;
  /** Hors ligne permis par le serveur et l'appareil. */
  canGoOffline: boolean;
  family: boolean;
  /** La page de la Famille a quelque chose à montrer à ce compte (`familyEntryShown`). Absent : oui
   *  (le comportement d'avant). */
  familyEntry?: boolean;
  /** La famille a au moins deux profils et le serveur sait en changer. */
  canSwitchProfile: boolean;
  /** « Qui regarde ? » proposé d'office sur cette plateforme ; absent : oui (serveur d'avant). */
  launchAsked?: boolean;
  liquidGlass: boolean;
  advancedEngine: boolean;
  engineOptions: boolean;
  /** Les droits de cette session (vides tant qu'ils ne sont pas connus : rien ne s'affiche). */
  abilities: ReadonlySet<SettingsAbility>;
  /** L'ouverture animée du logo (et son son) existe dans ce binaire. */
  bootIntro: boolean;
  /** L'appareil sait montrer un transfert en direct (écran verrouillé, notification permanente). */
  liveTransfers: boolean;
  /** L'app est ouverte au nom d'un autre profil de la famille. */
  profileSession: boolean;
}
