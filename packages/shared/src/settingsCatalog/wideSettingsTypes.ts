import type { ServerCapability } from "../serverCapabilities/serverCapabilities";
import type { SettingScope, SettingsCatalogContext, SettingsI18nRef, SettingsRequirement } from "./settingsCatalogTypes";

/**
 * Le catalogue des réglages du web LARGE et du bureau (refonte du 2026-10-26,
 * lot « Octave qualité ») : la même grammaire que le catalogue du mobile
 * (`settingsSections.ts` — rubriques, groupes, entrées, conditions, portée),
 * mais l'inventaire COMPLET de ce que l'écran large règle (décodage, HDR,
 * passages un à un, accueil, Octave…). Module PUR : le web fait correspondre
 * chaque identifiant à SON composant ; la recherche des réglages, le rail, les
 * pastilles de portée et les anciennes adresses lisent tous ce fichier.
 *
 * Deux niveaux, jamais trois : une rubrique (le rail), des groupes (les
 * cartes), des réglages (les lignes). Chaque réglage dit CE QU'IL FAIT (une
 * phrase) et OÙ IL VAUT (sa portée).
 */

/** Les rubriques du rail. Les identifiants sont les segments d'URL (`/settings/<id>`) : jamais renommés. */
export type WideSettingsSectionId =
  | "playback" | "languages" | "downloads" | "appearance" | "personalization" | "family" | "security";

/** Les intertitres du rail : regarder, l'interface, vous. */
export type WideSettingsRailGroup = "watch" | "interface" | "you";

/**
 * Où un réglage vaut : `account` (enregistré par le serveur, suit tous les
 * appareils), `device` (ce navigateur ou cet ordinateur seulement), `octave`
 * (le mode musique seulement, sur cet appareil). `null` : pas un réglage (une
 * information, un geste ponctuel).
 */
export type WideSettingScope = SettingScope | "octave";

/** Les réglages du web large, un par ligne ; l'identifiant est aussi l'ancre (`#<id>`). */
export type WideSettingId =
  // Lecture
  | "playbackMode" | "skipPassages" | "upNext" | "stillWatching" | "dataSaver"
  | "hardwareDecoding" | "hdrAuto" | "linuxSession"
  // Langues et sous-titres
  | "interfaceLanguage" | "libraryTracks"
  // Téléchargements
  | "downloadsLocation" | "downloadsSpace" | "downloadsBackground"
  // Apparence
  | "theme" | "liquidGlass" | "octaveAppearance"
  // Accueil et découverte
  | "octaveStartup" | "heroSource" | "cardDensity" | "homeRows" | "trailerPreviews" | "trailerPreviewDelay"
  | "trendingNow" | "recoPersonalized" | "recoVigie" | "recoCommunity" | "recoShareHistory" | "recoBalance" | "recoReset"
  // Famille
  | "familyProfiles" | "familyPin" | "askAtLaunch" | "familyLeave"
  // Compte et sécurité
  | "password" | "pairedDevices" | "linkedAccounts" | "changeServer" | "clearCache" | "deleteAccount";

/**
 * Les conditions propres au web large, en plus de celles du catalogue partagé :
 * - `desktopApp` : l'application de bureau (pas un navigateur) ;
 * - `glassToggle` : le verre natif existe (bureau, macOS 26) ;
 * - `octave` : le mode musique est offert à ce compte ;
 * - `downloads` : le bureau, avec le droit de télécharger ou des titres déjà là ;
 * - `backgroundTransfers` : la coquille sait finir les transferts fenêtre fermée ;
 * - `hardwareDecoding` : le lecteur natif (mpv) décode ici ;
 * - `hdrAuto` : un bureau Windows doté du lecteur natif ;
 * - `linuxSession` : la coquille Linux, qui sait choisir sa session graphique ;
 * - `vigieReco` : le serveur sait recommander hors bibliothèque (Vigie).
 */
export type WideSettingsRequirement =
  | SettingsRequirement
  | "desktopApp" | "glassToggle" | "octave" | "downloads" | "backgroundTransfers" | "hardwareDecoding" | "hdrAuto" | "linuxSession" | "vigieReco";

export interface WideSettingEntry {
  id: WideSettingId;
  scope: WideSettingScope | null;
  label: SettingsI18nRef;
  /** La phrase qui dit ce que fait le réglage, dans les mots de l'utilisateur. */
  description: SettingsI18nRef;
  /** D'autres mots qu'on taperait pour le chercher (liste séparée par des virgules). */
  keywords?: SettingsI18nRef;
  requires?: readonly WideSettingsRequirement[];
  capability?: ServerCapability;
}

export interface WideSettingsGroup {
  /** L'ancre du groupe (`#<id>`), unique dans sa rubrique. */
  id: string;
  title: SettingsI18nRef;
  entries: readonly WideSettingEntry[];
}

export interface WideSettingsSection {
  id: WideSettingsSectionId;
  railGroup: WideSettingsRailGroup;
  label: SettingsI18nRef;
  /** La phrase sous le titre : ce qu'on règle ici, et où ça vaut. */
  intro: SettingsI18nRef;
  groups: readonly WideSettingsGroup[];
}

/** Le contexte du catalogue partagé, plus les faits que seul le web large connaît. */
export interface WideSettingsContext extends SettingsCatalogContext {
  desktopApp: boolean;
  glassToggle: boolean;
  octave: boolean;
  downloads: boolean;
  /** Absent : la coquille ne le dit pas (web, bureau d'avant) — la ligne n'existe pas. */
  backgroundTransfers?: boolean;
  hardwareDecoding: boolean;
  hdrAuto: boolean;
  linuxSession: boolean;
  /** Absent : pas encore su (la ligne reste, le composant se tait s'il le faut). */
  vigieReco?: boolean;
}
