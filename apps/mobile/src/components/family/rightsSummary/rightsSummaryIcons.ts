import type { RightsSummaryKind } from "@tentacle-tv/shared";
import type { SettingsIcon } from "@/components/settings/SettingsRow";

/** L'icône de chaque ligne du résumé des droits — le texte dit le sens, l'icône n'est qu'un repère. */
export const RIGHTS_SUMMARY_ICONS: Readonly<Record<RightsSummaryKind, SettingsIcon>> = {
  libraries: "folder",
  age: "shield",
  unrated: "eye-off",
  tags: "tag",
  schedule: "clock",
  requestTitles: "film",
  createGuests: "user-plus",
  parent: "users",
  watchTogether: "tv",
  offline: "smartphone",
  account: "info",
};

/** Les bibliothèques ne se lisent que pour un profil que ce compte peut régler (le serveur rend
 *  alors son contrôle parental) et sur un serveur qui les borne. */
export function readsProfileLibraries(input: { capable: boolean; parentalShown: boolean }): boolean {
  return input.capable && input.parentalShown;
}
