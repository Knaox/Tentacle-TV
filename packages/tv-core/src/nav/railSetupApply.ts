/**
 * L'ÉTAPE DU PROPRIÉTAIRE de la préconfiguration : « Appliquer aussi à
 * d'autres profils ? ». Elle suit « Continuer » quand le profil est le
 * propriétaire de la famille ET que d'autres profils vivent sur cette TV ; on
 * y retrouve la même étape depuis Réglages › Navigation (« Appliquer à
 * d'autres profils »). Un profil déjà configuré se dit, mais reste cochable :
 * appliquer REMPLACE sa disposition. Module pur.
 */

export const RAIL_SETUP_APPLY_TILE_PREFIX = "railSetup:applyTile:";
export const railSetupApplyTileKey = (index: number): string => `${RAIL_SETUP_APPLY_TILE_PREFIX}${index}`;
export const RAIL_SETUP_APPLY_CONFIRM_KEY = "railSetup:applyConfirm";
export const RAIL_SETUP_APPLY_DECLINE_KEY = "railSetup:applyDecline";
export const RAIL_SETUP_APPLY_TILES_GROUP = "railSetup:applyTiles";
export const RAIL_SETUP_APPLY_ACTIONS_GROUP = "railSetup:applyActions";

/** L'étape est due : le propriétaire, et au moins un autre profil sur cette TV. */
export function railSetupApplyDue(isOwner: boolean, targetCount: number): boolean {
  return isOwner && targetCount > 0;
}

/** Après « Continuer » : l'étape du propriétaire si elle est due, sinon c'est fini. */
export function railSetupAfterContinue(applyDue: boolean): "apply" | "done" {
  return applyDue ? "apply" : "done";
}

/** Coche ou décoche un profil ; l'ordre de la rangée est gardé. */
export function toggleRailSetupTarget(
  selected: readonly string[],
  userId: string,
  order: readonly string[],
): string[] {
  const next = new Set(selected);
  if (next.has(userId)) next.delete(userId);
  else next.add(userId);
  return order.filter((id) => next.has(id));
}

/**
 * « Appliquer » ne vaut rien sans profil coché : il reste à sa place, estompé
 * et hors d'atteinte du focus, jusqu'au premier.
 */
export function railSetupApplyEnabled(selected: readonly string[]): boolean {
  return selected.length > 0;
}

/** Le focus d'entrée de l'étape : le premier profil. */
export function railSetupApplyEntryKey(targetCount: number): string {
  return targetCount > 0 ? railSetupApplyTileKey(0) : RAIL_SETUP_APPLY_DECLINE_KEY;
}
