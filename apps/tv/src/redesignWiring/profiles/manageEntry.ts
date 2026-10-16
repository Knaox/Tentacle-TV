import {
  MANAGE_BACK_KEY,
  STATUS_PRIMARY_KEY,
  manageEntryKey,
  manageSheetFocusAfter,
  pinDigitKey,
  type ManageEntryInput,
  type ManageGesture,
} from "@tentacle-tv/tv-core";
import type { ManageViewModel } from "../../redesign/screens/profiles/ManageProfilesView";

/**
 * L'ENTRÉE du focus de « Gérer les profils », selon ce que la page montre :
 * rien pendant un chargement ; « Réessayer » ou « Créer un code PIN » ; le
 * premier chiffre d'un pavé (sa croix s'il est bloqué) ; sinon la règle de
 * tv-core (`manageEntryKey`) — la fiche entre par la rangée du dernier geste
 * (la même rangée si elle a changé de forme), sinon par son premier geste.
 */
export function manageEntryOf(
  kind: ManageViewModel["kind"],
  state: { unlockLocked: boolean; pinLocked: boolean; input: ManageEntryInput; gestures: readonly ManageGesture[]; lastSheetKey: string | null },
): string | null {
  switch (kind) {
    case "loading":
      return null;
    case "error":
    case "needsPin":
      return STATUS_PRIMARY_KEY;
    case "pin":
      return state.unlockLocked ? MANAGE_BACK_KEY : pinDigitKey("1");
    case "guestPin":
      return state.pinLocked ? MANAGE_BACK_KEY : pinDigitKey("1");
    case "profile":
      return manageEntryKey({ ...state.input, view: "profile", sheetEntry: manageSheetFocusAfter(state.gestures, state.lastSheetKey) });
    default:
      return manageEntryKey(state.input);
  }
}
