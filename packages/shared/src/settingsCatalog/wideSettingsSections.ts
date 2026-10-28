import type { SettingsI18nRef } from "./settingsCatalogTypes";
import type {
  WideSettingEntry, WideSettingId, WideSettingScope, WideSettingsRequirement, WideSettingsSection,
} from "./wideSettingsTypes";

/**
 * Les rubriques du web LARGE et du bureau, dans l'ordre du rail — LA source de
 * leur structure (règles : `wideSettingsRules.ts`). Rangées par INTENTION, pas
 * par portée ni par technique (NN/g, Material : « ce que l'utilisateur veut
 * faire ») ; chaque réglage dans la rubrique où on le chercherait :
 *
 *   REGARDER   Lecture                — sauts et enchaînement · « encore là ? » · données · vidéo de l'ordinateur
 *              Langues et sous-titres — langue de l'interface · audio et sous-titres de chaque bibliothèque
 *              Téléchargements        — emplacement · espace · continuer en arrière-plan (bureau)
 *   INTERFACE  Apparence              — thème · Liquid Glass · Octave
 *              Accueil et découverte  — démarrage · bandeau · rangées · aperçus au survol · recommandations
 *   VOUS       Famille                — profils · mon code PIN · « Qui regarde ? » · quitter
 *              Compte et sécurité     — mot de passe · appareils · comptes liés · serveur · cache · suppression
 *
 * Avant (jusqu'au 2026-10-26) : « Lecture » portait la langue de l'interface
 * et les langues des bibliothèques, la vidéo de l'ordinateur ET l'économie de
 * données avait sa rubrique (« Données ») ; les comptes liés vivaient dans
 * « Personnalisation ». `WIDE_LEGACY_ANCHORS` renvoie les anciennes adresses.
 *
 * Tous les textes : espace i18n `settingsWeb` (`entries.<id>.label`,
 * `.description`, `.keywords`).
 */

const w = (key: string): SettingsI18nRef => ({ ns: "settingsWeb", key });

function entry(
  id: WideSettingId,
  scope: WideSettingScope | null,
  options: { requires?: readonly WideSettingsRequirement[]; capability?: WideSettingEntry["capability"]; keywords?: boolean } = {},
): WideSettingEntry {
  return {
    id,
    scope,
    label: w(`entries.${id}.label`),
    description: w(`entries.${id}.description`),
    ...(options.keywords === false ? {} : { keywords: w(`entries.${id}.keywords`) }),
    ...(options.requires ? { requires: options.requires } : {}),
    ...(options.capability ? { capability: options.capability } : {}),
  };
}

const group = (section: string, id: string, entries: readonly WideSettingEntry[]) => ({
  id,
  title: w(`groups.${section}.${id}`),
  entries,
});

const section = (
  id: WideSettingsSection["id"],
  railGroup: WideSettingsSection["railGroup"],
  groups: WideSettingsSection["groups"],
): WideSettingsSection => ({ id, railGroup, label: w(`sections.${id}.label`), intro: w(`sections.${id}.intro`), groups });

/** Hors session personnelle (un profil de la Famille), le serveur refuse ces gestes : leurs lignes disparaissent. */
const PERSONAL_ONLINE: readonly WideSettingsRequirement[] = ["online", "personal"];

export const WIDE_SETTINGS_SECTIONS: readonly WideSettingsSection[] = [
  section("playback", "watch", [
    group("playback", "player", [
      entry("playbackMode", "account"),
      entry("skipPassages", "account"),
      entry("upNext", "account"),
    ]),
    group("playback", "stillWatching", [entry("stillWatching", "account", { capability: "playback.stillWatching" })]),
    // L'économie de données règle ce que la LECTURE consomme : elle avait sa rubrique d'une ligne (« Données »).
    group("playback", "data", [entry("dataSaver", "device")]),
    group("playback", "video", [
      entry("hardwareDecoding", "device", { requires: ["hardwareDecoding"] }),
      entry("hdrAuto", "device", { requires: ["hdrAuto"] }),
      entry("linuxSession", "device", { requires: ["linuxSession"] }),
    ]),
  ]),
  // Les pistes choisies d'office : la question la plus posée (« pourquoi pas la VF ? »), une rubrique à elle.
  section("languages", "watch", [
    group("languages", "tracks", [entry("libraryTracks", "account")]),
    group("languages", "interface", [entry("interfaceLanguage", "account")]),
  ]),
  section("downloads", "watch", [
    group("downloads", "storage", [
      entry("downloadsLocation", "device", { requires: ["downloads"] }),
      entry("downloadsSpace", null, { requires: ["downloads"], keywords: false }),
    ]),
    // Films et musique d'Octave : un seul moteur, une seule ligne (aussi dans les Réglages d'Octave).
    group("downloads", "transfers", [entry("downloadsBackground", "device", { requires: ["downloads", "backgroundTransfers"] })]),
  ]),
  section("appearance", "interface", [
    group("appearance", "theme", [entry("theme", "device")]),
    group("appearance", "effects", [entry("liquidGlass", "device", { requires: ["glassToggle"] })]),
    group("appearance", "octave", [entry("octaveAppearance", "octave", { requires: ["octave"] })]),
  ]),
  section("personalization", "interface", [
    group("personalization", "startup", [entry("octaveStartup", "device", { requires: ["octave"] })]),
    group("personalization", "hero", [entry("heroSource", "account", { requires: ["online"] })]),
    group("personalization", "rows", [
      entry("cardDensity", "account", { requires: ["online"] }),
      entry("homeRows", "account", { requires: ["online"] }),
    ]),
    // Ce qui se passe PENDANT qu'on parcourt : un comportement des cartes, pas une couleur.
    group("personalization", "previews", [
      entry("trailerPreviews", "device", { capability: "trailers.preview" }),
      entry("trailerPreviewDelay", "device", { capability: "trailers.preview" }),
    ]),
    group("personalization", "reco", [
      entry("trendingNow", "account", { requires: ["online"], capability: "reco.trending" }),
      entry("recoPersonalized", "account", { requires: ["online"] }),
      entry("recoVigie", "account", { requires: ["online", "vigieReco"] }),
      entry("recoCommunity", "account", { requires: ["online"] }),
      entry("recoShareHistory", "account", { requires: ["online"] }),
      entry("recoBalance", "account", { requires: ["online"] }),
      entry("recoReset", null, { requires: ["online"] }),
    ]),
  ]),
  section("family", "you", [
    group("family", "profiles", [entry("familyProfiles", "account", { requires: ["family", "familyEntry"] })]),
    group("family", "myPin", [entry("familyPin", "account", { requires: ["family", "familyEntry", "personal"] })]),
    group("family", "launch", [
      entry("askAtLaunch", "device", { requires: ["family", "canSwitchProfile", "personal", "launchAsked"] }),
    ]),
    group("family", "leave", [entry("familyLeave", null, { requires: ["family", "familyEntry", "personal"] })]),
  ]),
  section("security", "you", [
    group("security", "signIn", [
      entry("password", "account", { requires: [...PERSONAL_ONLINE, "manageAccount"] }),
      entry("pairedDevices", "account", { requires: [...PERSONAL_ONLINE, "pairDevices"] }),
    ]),
    // Où partent les notes (TMDB) : un compte lié se cherche dans « Compte », pas dans l'accueil.
    group("security", "linked", [entry("linkedAccounts", "account", { requires: ["online"] })]),
    group("security", "thisDevice", [
      entry("changeServer", "device", { requires: ["desktopApp", "personal"] }),
      entry("clearCache", "device", { requires: ["online"] }),
    ]),
    group("security", "danger", [entry("deleteAccount", "account", { requires: [...PERSONAL_ONLINE, "manageAccount"] })]),
  ]),
];

/** Chaque réglage, par identifiant. */
export const WIDE_SETTINGS_BY_ID: Readonly<Record<WideSettingId, WideSettingEntry>> = Object.fromEntries(
  WIDE_SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries.map((e) => [e.id, e]))),
) as Record<WideSettingId, WideSettingEntry>;

/** La rubrique d'un réglage. */
export const WIDE_SETTING_SECTION: Readonly<Record<WideSettingId, WideSettingsSection["id"]>> = Object.fromEntries(
  WIDE_SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries.map((e) => [e.id, s.id]))),
) as Record<WideSettingId, WideSettingsSection["id"]>;
