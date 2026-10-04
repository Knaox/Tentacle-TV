/**
 * Les VOLETS du profil : les pages de réglage du DEUXIÈME niveau, qu'un
 * téléphone ouvre en plein écran (`/settings/*`) et qu'une tablette pose dans
 * la colonne de détail, sous leur rubrique. Module pur — ni React ni expo.
 *
 * Où chacun se range (rubrique, groupe, condition d'affichage) : la structure
 * du profil, `profileStructure.ts`. Ici, seulement leur nom et leur route —
 * les routes restent celles d'avant la réorganisation : liens profonds,
 * notifications et écrans qui y renvoient (« Pour vous » → personnalisation)
 * arrivent toujours au même endroit.
 */

export type ProfilePaneId =
  | "personalization"
  | "playback"
  | "notifications"
  | "data"
  | "onDevice"
  | "devices"
  | "invites"
  | "password";

export const PROFILE_PANES: readonly ProfilePaneId[] = [
  "password",
  "devices",
  "playback",
  "data",
  "onDevice",
  "personalization",
  "notifications",
  "invites",
];

/** La route plein écran de chaque volet (téléphone, liens profonds). */
export const PROFILE_PANE_ROUTES = {
  personalization: "/settings/personalization",
  playback: "/settings/playback",
  notifications: "/settings/notifications",
  data: "/settings/data",
  onDevice: "/settings/on-device",
  devices: "/settings/devices",
  invites: "/settings/invites",
  password: "/settings/password",
} as const satisfies Record<ProfilePaneId, string>;
