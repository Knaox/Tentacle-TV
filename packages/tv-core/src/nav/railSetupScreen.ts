import type { ArrangeReading } from "./arrange";
import { libraryIdOf } from "./railKeys";

/**
 * La PRÉCONFIGURATION de la barre (« Quelles bibliothèques dans votre
 * barre ? ») — l'écran qu'un profil voit une fois par appareil, avant
 * l'accueil. Module pur : ce que l'écran décide (clés de focus, déplacement,
 * ordre et masquées à enregistrer, Retour, arrivée) ; l'adaptateur l'applique.
 *
 * - La liste ne montre que les BIBLIOTHÈQUES, dans l'ordre de la barre. Pour
 *   vous, Ma liste et Favoris gardent leur état et leur case : ils se règlent
 *   dans Réglages › Navigation.
 * - OK sur une ligne l'épingle ou la retire ; « Déplacer », à sa droite, la
 *   SOULÈVE — la machine commune (`arrange.ts`) : HAUT / BAS la déplacent, OK
 *   la pose, Retour annule. Le focus reste dans la colonne des pastilles :
 *   chaque pastille porte la bibliothèque de sa case (`railSetupArrangeReading`).
 * - Rien n'est enregistré avant « Continuer » ; « Passer » et Retour gardent la
 *   disposition d'avant. La disposition enregistrée, la porte (montrer, passer,
 *   attendre — bornée) et la diffusion aux autres profils sont la règle du
 *   socle (`railSetup.ts`, `railProfileStore.ts`).
 */

export const RAIL_SETUP_ROW_PREFIX = "railSetup:row:";
const MOVE_SUFFIX = ":move";

/** La ligne d'une case : OK épingle ou retire. */
export const railSetupRowKey = (slot: number): string => `${RAIL_SETUP_ROW_PREFIX}${slot}`;
/** La pastille « Déplacer » d'une case. */
export const railSetupMoveKey = (slot: number): string => `${RAIL_SETUP_ROW_PREFIX}${slot}${MOVE_SUFFIX}`;

export const RAIL_SETUP_CONTINUE_KEY = "railSetup:continue";
export const RAIL_SETUP_SKIP_KEY = "railSetup:skip";
/** La liste (elle défile avec beaucoup de bibliothèques) et le pied. */
export const RAIL_SETUP_LIST_GROUP = "railSetup:list";
export const RAIL_SETUP_ACTIONS_GROUP = "railSetup:actions";

/** Les bibliothèques d'un ordre complet de la barre, dans cet ordre. */
export function railSetupLibraryKeys(order: readonly string[]): string[] {
  return order.filter((key) => libraryIdOf(key) !== null);
}

/**
 * Pendant un déplacement : la pastille de la case `i` porte la bibliothèque
 * de cette case dans l'ordre EN COURS ; une ligne (verrouillée) ne fait rien ;
 * hors de la liste, l'entrée est posée.
 */
export function railSetupArrangeReading(focusKey: string, libraryOrder: readonly string[]): ArrangeReading {
  if (!focusKey.startsWith(RAIL_SETUP_ROW_PREFIX)) return { kind: "outside" };
  const match = /^(\d+):move$/.exec(focusKey.slice(RAIL_SETUP_ROW_PREFIX.length));
  const key = match ? libraryOrder[Number(match[1])] : undefined;
  return key ? { kind: "entry", key } : { kind: "inside" };
}

/** Ce qui ne doit pas prendre le focus pendant un déplacement : les lignes et le pied. */
export function railSetupLockedKeys(rowCount: number): string[] {
  const rows = Array.from({ length: rowCount }, (_, slot) => railSetupRowKey(slot));
  return [...rows, RAIL_SETUP_CONTINUE_KEY, RAIL_SETUP_SKIP_KEY];
}

/** Le focus d'entrée : la première bibliothèque — jamais une croix ni « Passer ». */
export function railSetupEntryKey(rowCount: number): string {
  return rowCount > 0 ? railSetupRowKey(0) : RAIL_SETUP_CONTINUE_KEY;
}

export type RailSetupStep = "libraries" | "apply";

/**
 * Retour : annule d'abord un déplacement ; sur la liste, il PASSE (jamais une
 * impasse) ; sur l'étape propriétaire, il vaut « Non merci ».
 */
export type RailSetupBackAction = "cancelMove" | "skip" | "decline";

export function railSetupBackAction(step: RailSetupStep, moving: boolean): RailSetupBackAction {
  if (moving) return "cancelMove";
  return step === "apply" ? "decline" : "skip";
}

/**
 * La route qui suit une session ouverte (jumelage réussi, profil ouvert,
 * démarrage) : la page quand elle est encore due sur cet appareil pour ce
 * profil, sinon l'accueil.
 */
export function routeAfterSession(setupPending: boolean): "RailSetup" | "Home" {
  return setupPending ? "RailSetup" : "Home";
}
