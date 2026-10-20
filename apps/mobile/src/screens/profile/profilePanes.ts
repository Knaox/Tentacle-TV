/**
 * Les VOLETS des réglages : les pages du DEUXIÈME niveau, qu'un téléphone
 * ouvre en plein écran (`/settings/*`) et qu'une tablette pose dans la
 * colonne de détail, sous leur rubrique. Module pur — ni React ni expo.
 *
 * Où chacun se range (rubrique, groupe, condition d'affichage) : la structure
 * du profil, `profileStructure.ts`. Les routes restent celles d'avant : liens
 * profonds, notifications et écrans qui y renvoient (« Pour vous » →
 * personnalisation) arrivent toujours au même endroit. Celles des volets
 * fondus dans une page (lecteur, économie de données, réglages hors ligne)
 * redirigent vers elle : `LEGACY_PANE_REDIRECTS`.
 */

export type ProfilePaneId =
  | "password"
  | "mediaLanguages"
  | "personalization"
  | "devices"
  | "notifications"
  | "invites";

export const PROFILE_PANES: readonly ProfilePaneId[] = [
  "password",
  "mediaLanguages",
  "personalization",
  "devices",
  "notifications",
  "invites",
];

/** La route plein écran de chaque volet (téléphone, liens profonds). */
export const PROFILE_PANE_ROUTES = {
  password: "/settings/password",
  mediaLanguages: "/settings/media-languages",
  personalization: "/settings/personalization",
  devices: "/settings/devices",
  notifications: "/settings/notifications",
  invites: "/settings/invites",
} as const satisfies Record<ProfilePaneId, string>;

/** Les anciens volets devenus une page de rubrique : leur route y mène. */
export const LEGACY_PANE_REDIRECTS = {
  "/settings/playback": "/profile/playback",
  "/settings/data": "/profile/playback",
  "/settings/on-device": "/profile/offline",
} as const;
