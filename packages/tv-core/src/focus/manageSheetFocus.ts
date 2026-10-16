import type { ManageGesture, ManageGestureKind } from "../session/familyManageSheet";

/**
 * Le focus de la FICHE d'un profil dans « Gérer les profils » (TV) — module
 * pur. Chaque geste est une rangée de la fiche (`familyManageSheet.ts`), une
 * section de voisinage à elle seule : HAUT / BAS vont d'un geste à l'autre ;
 * le code PIN a deux boutons côte à côte (changer, retirer). L'entrée : le
 * premier geste. Un geste qui change de forme (un code posé : « Créer » devient
 * « Changer » et « Retirer ») garde le focus sur sa rangée.
 */

export const MANAGE_SHEET_GROUP = "manage:sheet";

export type ManagePinVariant = "create" | "change" | "remove";

/** La clé d'un bouton de la fiche : `manage:sheet:<geste>`, `manage:sheet:pin:<variante>`. */
export function manageSheetKey(kind: ManageGestureKind, variant?: ManagePinVariant): string {
  return variant ? `manage:sheet:${kind}:${variant}` : `manage:sheet:${kind}`;
}

/** La section d'une rangée de la fiche. */
export function manageSheetRowKey(kind: ManageGestureKind): string {
  return `manage:sheetRow:${kind}`;
}

/** Les boutons d'un geste, dans l'ordre de la rangée. */
export function manageGestureKeys(gesture: ManageGesture): string[] {
  if (gesture.kind === "pin") {
    return gesture.hasPin ? [manageSheetKey("pin", "change"), manageSheetKey("pin", "remove")] : [manageSheetKey("pin", "create")];
  }
  return [manageSheetKey(gesture.kind)];
}

/** L'entrée de la fiche : son premier bouton ; aucun geste (la fiche vient de perdre le sien) : null. */
export function manageSheetEntryKey(gestures: readonly ManageGesture[]): string | null {
  return gestures.length > 0 ? manageGestureKeys(gestures[0])[0] : null;
}

/**
 * Après un geste qui change la rangée (un code posé ou retiré), le focus
 * reste sur la MÊME rangée — son premier bouton tel qu'elle est devenue ; un
 * bouton toujours là garde le focus.
 */
export function manageSheetFocusAfter(gestures: readonly ManageGesture[], focusedKey: string | null): string | null {
  if (!focusedKey) return manageSheetEntryKey(gestures);
  for (const gesture of gestures) {
    const keys = manageGestureKeys(gesture);
    if (keys.includes(focusedKey)) return focusedKey;
    if (focusedKey.startsWith(`${manageSheetKey(gesture.kind)}:`) || focusedKey === manageSheetKey(gesture.kind)) return keys[0];
  }
  return manageSheetEntryKey(gestures);
}

const ALL_GESTURES: readonly ManageGestureKind[] = ["photo", "pin", "requestTitles", "parentRole", "createGuests", "parental", "delete", "remove"];

/** Toutes les clés possibles de la fiche : la garde du clic fantôme (la fiche s'ouvre sous un OK). */
export function manageSheetGuardedKeys(): string[] {
  return ALL_GESTURES.flatMap((kind) =>
    kind === "pin" ? (["create", "change", "remove"] as const).map((variant) => manageSheetKey("pin", variant)) : [manageSheetKey(kind)],
  );
}
