import type { SettingsPaneId, SettingsScreenId } from "@tentacle-tv/shared";

/**
 * Les ROUTES du mobile pour le catalogue des réglages (`@tentacle-tv/shared`
 * › settingsCatalog, rendu aussi par le web étroit) : le catalogue nomme des
 * volets et des écrans, chaque client les fait correspondre à SES routes.
 * Module pur — ni React ni expo.
 *
 * Les volets (deuxième niveau) : un écran plein sur téléphone (`/settings/*`),
 * la colonne de détail sur tablette. Les routes restent celles d'avant : liens
 * profonds, notifications et écrans qui y renvoient (« Pour vous » →
 * personnalisation) arrivent toujours au même endroit. Celles des volets
 * fondus dans une page (lecteur, économie de données, réglages hors ligne)
 * redirigent vers elle : `LEGACY_PANE_REDIRECTS`.
 */

/** La route plein écran de chaque volet (téléphone, liens profonds). */
export const PROFILE_PANE_ROUTES = {
  password: "/settings/password",
  mediaLanguages: "/settings/media-languages",
  personalization: "/settings/personalization",
  devices: "/settings/devices",
  notifications: "/settings/notifications",
  invites: "/settings/invites",
} as const satisfies Record<SettingsPaneId, string>;

/** L'écran de la Famille — `FAMILY_ROUTE` de l'api-client, le même chemin partout. */
export const FAMILY_HREF = "/family";

/** Les écrans à part entière vers lesquels renvoie le catalogue. */
export const SETTINGS_SCREEN_ROUTES = {
  family: FAMILY_HREF,
  sessions: "/admin/sessions",
  offlineTitles: "/on-device",
  support: "/support",
  about: "/about",
} as const satisfies Record<SettingsScreenId, string>;

/** Les anciens volets devenus une page de rubrique : leur route y mène. */
export const LEGACY_PANE_REDIRECTS = {
  "/settings/playback": "/profile/playback",
  "/settings/data": "/profile/playback",
  "/settings/on-device": "/profile/offline",
} as const;
