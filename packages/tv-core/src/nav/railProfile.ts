import { RAIL_PROFILE_KEY } from "./railKeys";
import { canOpenRailMenu } from "./railMenu";

/**
 * L'APPUI MAINTENU sur une entrée du rail — module pur. Une entrée
 * organisable ouvre son menu (`railMenu`) ; le PROFIL, sur une Apple TV passée
 * aux profils (Famille), mène à « Qui regarde ? » : OK y ouvre les réglages,
 * comme toujours, et le maintenir change de profil. Rien pendant un
 * déplacement.
 */
export type RailHold = "menu" | "switchProfile" | null;

export function railHold(entryKey: string, state: { moving: boolean; profiles: boolean }): RailHold {
  if (state.moving) return null;
  if (entryKey === RAIL_PROFILE_KEY) return state.profiles ? "switchProfile" : null;
  return canOpenRailMenu(entryKey, state.moving) ? "menu" : null;
}
