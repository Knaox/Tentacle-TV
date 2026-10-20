import type { SettingsI18nRef, SettingsPlatform, SettingsRequirement, SettingsCatalogSection } from "./settingsCatalogTypes";

/**
 * Les rubriques des réglages, dans l'ordre de la liste — LA source de la
 * structure, rendue par le mobile ET le web étroit (règles :
 * `settingsCatalogRules.ts` ; portée et type de contrôle de chaque réglage :
 * `settingsControls.ts`). Une entrée nouvelle s'ajoute ici, dans la rubrique
 * dont elle parle ; jamais une ligne en dur dans un écran.
 *
 *   Compte               — Photo · Nom · Mot de passe▸ | Famille ▢ · Changer de profil | Serveur… | Supprimer mon compte
 *   Lecture et apparence — (phrase de portée) | SUR TOUS VOS APPAREILS : intros, épisode suivant,
 *                          « encore là ? », langues▸, langue, accueil▸, tendances
 *                          | SUR CET APPAREIL : thème, Liquid Glass, sous-titres, données, lecteur
 *                          | OUVERTURE : animation, son
 *                          | Réglages avancés : sur l'app bureau
 *   TV et appareils      — (le volet lui-même)
 *   Hors ligne           — Mes titres ▢ · Passer hors ligne | (espace) | TRANSFERTS : Wi-Fi seulement,
 *                          arrière-plan, « prêt », suivi en direct | TITRES : tout retirer
 *   Notifications        — (le volet lui-même)
 *   Aide et à propos     — Support ▢ · À propos ▢ · Confidentialité ↗ · Réglages avancés
 * (▸ = volet ; ▢ = écran ; | = groupe suivant.)
 */

/**
 * Ce que seul le mobile sait faire : lecteur natif, Liquid Glass, garder hors
 * ligne, notifications PUSH (un navigateur n'en reçoit pas), changer de serveur
 * (dans un navigateur, le serveur EST l'adresse).
 */
const MOBILE: readonly SettingsPlatform[] = ["mobile"];

const p = (key: string): SettingsI18nRef => ({ ns: "profile", key });
const s = (key: string): SettingsI18nRef => ({ ns: "settingsMobile", key });
const o = (key: string): SettingsI18nRef => ({ ns: "offline", key });

/** Les réglages hors ligne : le droit de garder des titres, en session personnelle. */
const OFFLINE: readonly SettingsRequirement[] = ["offlineVisible", "personal"];

export const SETTINGS_SECTIONS: readonly SettingsCatalogSection[] = [
  {
    id: "account",
    icon: "user",
    label: s("sections.account"),
    summaries: [
      { requires: ["family"], label: s("sections.accountSummaryFamily") },
      { label: s("sections.accountSummary") },
    ],
    groups: [
      {
        entries: [
          // La photo passe aussi en session de profil (le proxy pose celle du profil).
          { kind: "control", id: "photo", requires: ["online"] },
          { kind: "control", id: "userName", requires: ["online"] },
          { kind: "pane", id: "password", icon: "lock", label: p("password"), requires: ["online", "personal", "manageAccount"] },
        ],
      },
      {
        title: s("account.familyGroup"),
        entries: [
          // Cachée face à un serveur sans Famille (ou Famille coupée).
          { kind: "screen", id: "family", icon: "users", label: p("family"), requires: ["family", "personal"] },
          { kind: "control", id: "switchProfile", requires: ["family", "canSwitchProfile"] },
          // « Qui regarde ? » au démarrage, réglé par l'appareil (shared `familyMobileLaunch.ts`, web :
          // `familyPickerDevice.ts`) — en session personnelle, comme sur le bureau, et si
          // l'administration le propose d'office sur la plateforme.
          { kind: "control", id: "askAtLaunch", requires: ["family", "canSwitchProfile", "personal", "launchAsked"] },
        ],
      },
      {
        title: s("account.serverGroup"),
        entries: [
          { kind: "action", id: "changeServer", icon: "repeat", label: p("changeServer"), requires: ["online", "personal"], platforms: MOBILE },
          { kind: "pane", id: "invites", icon: "mail", label: p("invitations"), requires: ["online", "admin", "personal", "invites"] },
          { kind: "screen", id: "sessions", icon: "activity", label: { ns: "sessions", key: "title" }, requires: ["online", "admin", "personal"] },
          { kind: "action", id: "clearCache", icon: "trash-2", label: p("clearCache"), destructive: true, requires: ["online"] },
        ],
      },
      {
        entries: [
          { kind: "action", id: "deleteAccount", icon: "user-x", label: p("deleteAccount"), destructive: true, requires: ["online", "personal", "manageAccount"] },
        ],
      },
    ],
  },
  {
    id: "playback",
    icon: "play-circle",
    label: s("sections.playback"),
    // Le résumé lu est l'état (« Sombre · Français ») : `ProfileSectionList`.
    summaries: [{ label: p("playbackSummary") }],
    groups: [
      { entries: [{ kind: "block", id: "scopeIntro" }] },
      {
        title: s("playback.everywhere"),
        caption: s("playback.everywhereCaption"),
        scope: "account",
        entries: [
          { kind: "control", id: "intros" },
          { kind: "control", id: "nextAutoPlay" },
          { kind: "control", id: "stillWatching", capability: "playback.stillWatching" },
          { kind: "pane", id: "mediaLanguages", icon: "message-square", label: s("playback.mediaLanguages") },
          { kind: "control", id: "language" },
          { kind: "pane", id: "personalization", icon: "sliders", label: p("homeAndRecommendations"), requires: ["online"] },
          { kind: "control", id: "trendingNow", requires: ["online"], capability: "reco.trending" },
        ],
      },
      {
        title: s("playback.thisDevice"),
        caption: s("playback.thisDeviceCaption"),
        scope: "device",
        entries: [
          { kind: "control", id: "theme" },
          { kind: "control", id: "liquidGlass", requires: ["liquidGlass"], platforms: MOBILE },
          { kind: "control", id: "subtitleSize", requires: ["advancedEngine"], platforms: MOBILE },
          { kind: "control", id: "subtitlePosition", requires: ["advancedEngine"], platforms: MOBILE },
          { kind: "control", id: "dataSaver" },
          { kind: "control", id: "engine", requires: ["advancedEngine"], platforms: MOBILE },
          { kind: "control", id: "engineOptions", requires: ["engineOptions"], platforms: MOBILE },
        ],
      },
      {
        // L'ouverture animée du logo, au lancement (session ouverture-mobile).
        title: s("boot.group"),
        scope: "device",
        entries: [
          { kind: "control", id: "bootIntro", requires: ["bootIntro"], platforms: MOBILE },
          { kind: "control", id: "bootSound", requires: ["bootIntro"], platforms: MOBILE },
        ],
      },
      { entries: [{ kind: "control", id: "advancedOnDesktop" }] },
    ],
  },
  // Jumeler une TV se trouve SANS CHERCHER : une rubrique d'un seul volet,
  // qui ouvre directement les cases du code.
  {
    id: "devices",
    icon: "tv",
    label: s("sections.tv"),
    summaries: [{ label: s("sections.tvSummary") }],
    groups: [
      { entries: [{ kind: "pane", id: "devices", icon: "tv", label: s("sections.tv"), requires: ["online", "personal", "pairDevices"] }] },
    ],
  },
  {
    id: "offline",
    icon: "smartphone",
    label: s("sections.offline"),
    summaries: [{ label: s("sections.offlineSummary") }],
    groups: [
      {
        entries: [
          { kind: "screen", id: "offlineTitles", icon: "smartphone", label: { ns: "offline", key: "myOfflineTitles" }, requires: ["offlineVisible", "personal"], platforms: MOBILE },
          { kind: "action", id: "goOffline", icon: "wifi-off", label: { ns: "nav", key: "goOffline" }, requires: ["canGoOffline", "personal"], platforms: MOBILE },
        ],
      },
      { entries: [{ kind: "block", id: "offlineSpace", requires: ["offlineVisible", "personal"], platforms: MOBILE }] },
      {
        title: o("sectionTransfers"),
        scope: "device",
        entries: [
          { kind: "control", id: "wifiOnly", requires: OFFLINE, platforms: MOBILE },
          { kind: "control", id: "backgroundTransfers", requires: OFFLINE, platforms: MOBILE },
          { kind: "control", id: "notifyReady", requires: OFFLINE, platforms: MOBILE },
          { kind: "control", id: "liveTransfers", requires: [...OFFLINE, "liveTransfers"], platforms: MOBILE },
        ],
      },
      {
        title: o("sectionTitles"),
        entries: [
          { kind: "action", id: "removeAllOffline", icon: "trash-2", label: o("removeAll"), destructive: true, requires: OFFLINE, platforms: MOBILE },
        ],
      },
    ],
  },
  {
    id: "notifications",
    icon: "bell",
    label: s("sections.notifications"),
    summaries: [{ label: s("sections.notificationsSummary") }],
    groups: [
      { entries: [{ kind: "pane", id: "notifications", icon: "bell", label: p("notifications"), requires: ["online", "personal", "push"], platforms: MOBILE }] },
    ],
  },
  {
    id: "help",
    icon: "help-circle",
    label: s("sections.help"),
    summaries: [
      { requires: ["online"], label: s("sections.helpSummary") },
      { label: s("sections.helpSummaryOffline") },
    ],
    groups: [
      {
        entries: [
          { kind: "screen", id: "support", icon: "life-buoy", label: p("support"), requires: ["online", "tickets"] },
          { kind: "screen", id: "about", icon: "info", label: p("about") },
          { kind: "action", id: "privacyPolicy", icon: "shield", label: p("privacyPolicy") },
        ],
      },
      { entries: [{ kind: "control", id: "advancedOnDesktop" }] },
    ],
  },
];
