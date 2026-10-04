import type { I18nRef, ProfileSection } from "./profileStructure";

/**
 * Les rubriques du profil, dans l'ordre de la liste — LA source de la
 * structure (règles et types : `profileStructure.ts`). Une entrée nouvelle
 * s'ajoute ici, dans la rubrique dont elle parle ; jamais une ligne en dur
 * dans un écran.
 *
 *   Compte         — Mot de passe▸ · Famille ▢ · Appareils et TV▸ | Supprimer mon compte
 *   Lecture        — Lecteur▸ · Économie de données▸ | Hors ligne : Mes titres ▢ · Réglages hors ligne▸ · Passer hors ligne
 *   Apparence      — Thème · Langue · Liquid Glass | Accueil et recommandations▸
 *   Notifications  — (le volet lui-même)
 *   Serveur        — Changer de serveur · Invitations▸ · Sessions en direct ▢ | Vider le cache et réinitialiser
 *   Aide           — Support ▢ · Bandes-annonces ▢ · À propos ▢ · Politique de confidentialité ↗
 * (▸ = volet ; ▢ = écran ; | = groupe suivant.) « Mes statistiques » et
 * « Se déconnecter » ne sont pas des rubriques : la carte sous l'identité,
 * et la dernière ligne de la liste.
 */

const p = (key: string): I18nRef => ({ ns: "profile", key });

/** L'écran de la Famille — `FAMILY_ROUTE` de l'api-client, le même chemin partout. */
export const FAMILY_HREF = "/family";

export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  {
    id: "account",
    icon: "user",
    label: p("account"),
    summaries: [
      { requires: ["family"], label: p("accountSummaryFamily") },
      { label: p("accountSummary") },
    ],
    groups: [
      {
        entries: [
          { kind: "pane", id: "password", icon: "lock", label: p("password"), requires: ["online"] },
          // Réservée à la Famille du mobile : cachée tant que l'écran n'est pas
          // branché, et face à un serveur sans Famille (ou Famille coupée).
          { kind: "screen", id: "family", href: FAMILY_HREF, icon: "users", label: p("family"), requires: ["family"] },
          { kind: "pane", id: "devices", icon: "tv", label: p("devicesAndTv"), requires: ["online"] },
        ],
      },
      {
        entries: [
          { kind: "action", id: "deleteAccount", icon: "user-x", label: p("deleteAccount"), destructive: true, requires: ["online"] },
        ],
      },
    ],
  },
  {
    id: "playback",
    icon: "play-circle",
    label: p("playback"),
    summaries: [
      { requires: ["offlineVisible"], label: p("playbackSummaryOffline") },
      { label: p("playbackSummary") },
    ],
    groups: [
      {
        entries: [
          { kind: "pane", id: "playback", icon: "film", label: p("player") },
          { kind: "pane", id: "data", icon: "bar-chart-2", label: p("dataSaver") },
        ],
      },
      {
        title: p("offlineGroup"),
        entries: [
          { kind: "screen", id: "offlineTitles", href: "/on-device", icon: "smartphone", label: { ns: "offline", key: "myOfflineTitles" }, requires: ["offlineVisible"] },
          { kind: "pane", id: "onDevice", icon: "settings", label: { ns: "offline", key: "profileRowSettings" }, requires: ["offlineVisible"] },
          { kind: "action", id: "goOffline", icon: "wifi-off", label: { ns: "nav", key: "goOffline" }, requires: ["canGoOffline"] },
        ],
      },
    ],
  },
  {
    id: "appearance",
    icon: "sun",
    label: p("appearance"),
    summaries: [{ label: p("appearanceSummary") }],
    groups: [
      {
        entries: [
          { kind: "control", id: "theme" },
          { kind: "control", id: "language" },
          { kind: "control", id: "liquidGlass", requires: ["liquidGlass"] },
        ],
      },
      {
        entries: [
          { kind: "pane", id: "personalization", icon: "sliders", label: p("homeAndRecommendations"), requires: ["online"] },
        ],
      },
    ],
  },
  {
    id: "notifications",
    icon: "bell",
    label: p("notifications"),
    summaries: [{ label: p("notificationsSummary") }],
    groups: [
      { entries: [{ kind: "pane", id: "notifications", icon: "bell", label: p("notifications"), requires: ["online"] }] },
    ],
  },
  {
    id: "server",
    icon: "server",
    label: p("serverSection"),
    summaries: [
      { requires: ["admin"], label: p("serverSummaryAdmin") },
      { label: p("serverSummary") },
    ],
    groups: [
      {
        entries: [
          { kind: "action", id: "changeServer", icon: "repeat", label: p("changeServer"), requires: ["online"] },
          { kind: "pane", id: "invites", icon: "mail", label: p("invitations"), requires: ["online", "admin"] },
          { kind: "screen", id: "sessions", href: "/admin/sessions", icon: "activity", label: { ns: "sessions", key: "title" }, requires: ["online", "admin"] },
        ],
      },
      {
        entries: [
          { kind: "action", id: "clearCache", icon: "trash-2", label: p("clearCache"), destructive: true, requires: ["online"] },
        ],
      },
    ],
  },
  {
    id: "help",
    icon: "help-circle",
    label: p("help"),
    summaries: [
      { requires: ["online"], label: p("helpSummary") },
      { label: p("helpSummaryOffline") },
    ],
    groups: [
      {
        entries: [
          { kind: "screen", id: "support", href: "/support", icon: "life-buoy", label: p("support"), requires: ["online"] },
          { kind: "screen", id: "trailers", href: "/help/trailers", icon: "film", label: { ns: "trailerHelp", key: "helpEntryTitle" }, requires: ["online"] },
          { kind: "screen", id: "about", href: "/about", icon: "info", label: p("about") },
          { kind: "action", id: "privacyPolicy", icon: "shield", label: p("privacyPolicy") },
        ],
      },
    ],
  },
];
