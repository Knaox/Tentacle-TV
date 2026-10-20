import type { I18nRef, ProfileSection } from "./profileStructure";

/**
 * Les rubriques des réglages, dans l'ordre de la liste — LA source de la
 * structure (règles et types : `profileStructure.ts` ; portée de chaque
 * réglage : `settingsScopes.ts`). Une entrée nouvelle s'ajoute ici, dans la
 * rubrique dont elle parle ; jamais une ligne en dur dans un écran.
 *
 *   Compte               — Photo · Nom · Mot de passe▸ | Famille ▢ · Changer de profil | Serveur… | Supprimer mon compte
 *   Lecture et apparence — (phrase de portée) | SUR TOUS TES APPAREILS : intros, épisode suivant,
 *                          « encore là ? », langues▸, langue, accueil▸, tendances
 *                          | SUR CET APPAREIL : thème, Liquid Glass, sous-titres, données, lecteur
 *                          | Réglages avancés : sur l'app bureau
 *   TV et appareils      — (le volet lui-même)
 *   Hors ligne           — Mes titres ▢ · Passer hors ligne | (espace, transferts, tout retirer)
 *   Notifications        — (le volet lui-même)
 *   Aide et à propos     — Support ▢ · À propos ▢ · Confidentialité ↗ · Réglages avancés
 * (▸ = volet ; ▢ = écran ; | = groupe suivant.) « Mes statistiques » et
 * « Se déconnecter » ne sont pas des rubriques : la carte sous l'identité,
 * et la dernière ligne de la liste.
 */

const p = (key: string): I18nRef => ({ ns: "profile", key });
const s = (key: string): I18nRef => ({ ns: "settingsMobile", key });

/** L'écran de la Famille — `FAMILY_ROUTE` de l'api-client, le même chemin partout. */
export const FAMILY_HREF = "/family";

export const PROFILE_SECTIONS: readonly ProfileSection[] = [
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
          { kind: "control", id: "photo", requires: ["online", "personal"] },
          { kind: "control", id: "userName", requires: ["online"] },
          { kind: "pane", id: "password", icon: "lock", label: p("password"), requires: ["online", "personal"] },
        ],
      },
      {
        title: s("account.familyGroup"),
        entries: [
          // Cachée face à un serveur sans Famille (ou Famille coupée).
          { kind: "screen", id: "family", href: FAMILY_HREF, icon: "users", label: p("family"), requires: ["family", "personal"] },
          { kind: "control", id: "switchProfile", requires: ["family", "canSwitchProfile"] },
        ],
      },
      {
        title: s("account.serverGroup"),
        entries: [
          { kind: "action", id: "changeServer", icon: "repeat", label: p("changeServer"), requires: ["online", "personal"] },
          { kind: "pane", id: "invites", icon: "mail", label: p("invitations"), requires: ["online", "admin", "personal"] },
          { kind: "screen", id: "sessions", href: "/admin/sessions", icon: "activity", label: { ns: "sessions", key: "title" }, requires: ["online", "admin", "personal"] },
          { kind: "action", id: "clearCache", icon: "trash-2", label: p("clearCache"), destructive: true, requires: ["online"] },
        ],
      },
      {
        entries: [
          { kind: "action", id: "deleteAccount", icon: "user-x", label: p("deleteAccount"), destructive: true, requires: ["online", "personal"] },
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
          { kind: "control", id: "stillWatching", requires: ["stillWatching"] },
          { kind: "pane", id: "mediaLanguages", icon: "message-square", label: s("playback.mediaLanguages") },
          { kind: "control", id: "language" },
          { kind: "pane", id: "personalization", icon: "sliders", label: p("homeAndRecommendations"), requires: ["online"] },
          { kind: "control", id: "trendingNow", requires: ["trendingNow"] },
        ],
      },
      {
        title: s("playback.thisDevice"),
        caption: s("playback.thisDeviceCaption"),
        scope: "device",
        entries: [
          { kind: "control", id: "theme" },
          { kind: "control", id: "liquidGlass", requires: ["liquidGlass"] },
          { kind: "control", id: "subtitleSize", requires: ["advancedEngine"] },
          { kind: "control", id: "subtitlePosition", requires: ["advancedEngine"] },
          { kind: "control", id: "dataSaver" },
          { kind: "control", id: "engine", requires: ["advancedEngine"] },
          { kind: "control", id: "engineOptions", requires: ["engineOptions"] },
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
      { entries: [{ kind: "pane", id: "devices", icon: "tv", label: s("sections.tv"), requires: ["online", "personal"] }] },
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
          { kind: "screen", id: "offlineTitles", href: "/on-device", icon: "smartphone", label: { ns: "offline", key: "myOfflineTitles" }, requires: ["offlineVisible", "personal"] },
          { kind: "action", id: "goOffline", icon: "wifi-off", label: { ns: "nav", key: "goOffline" }, requires: ["canGoOffline", "personal"] },
        ],
      },
      { entries: [{ kind: "block", id: "offlineSettings", requires: ["offlineVisible", "personal"] }] },
    ],
  },
  {
    id: "notifications",
    icon: "bell",
    label: s("sections.notifications"),
    summaries: [{ label: s("sections.notificationsSummary") }],
    groups: [
      { entries: [{ kind: "pane", id: "notifications", icon: "bell", label: p("notifications"), requires: ["online", "personal"] }] },
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
          { kind: "screen", id: "support", href: "/support", icon: "life-buoy", label: p("support"), requires: ["online"] },
          { kind: "screen", id: "about", href: "/about", icon: "info", label: p("about") },
          { kind: "action", id: "privacyPolicy", icon: "shield", label: p("privacyPolicy") },
        ],
      },
      { entries: [{ kind: "control", id: "advancedOnDesktop" }] },
    ],
  },
];
