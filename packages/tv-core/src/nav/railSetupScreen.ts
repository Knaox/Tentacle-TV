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
 *   disposition d'avant.
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

/**
 * L'ordre COMPLET à enregistrer : chaque case qu'occupait une bibliothèque de
 * la page reçoit, dans l'ordre choisi, la bibliothèque suivante — Pour vous,
 * Ma liste et Favoris ne bougent pas, ni une bibliothèque que la page ne
 * montre pas (hors des droits du profil aujourd'hui : elle garde sa case). Une
 * bibliothèque que l'ordre complet ne connaissait pas (créée depuis) se range
 * à la suite.
 */
export function railSetupFullOrder(fullOrder: readonly string[], libraryOrder: readonly string[]): string[] {
  const queue = libraryOrder.filter((key, index) => libraryOrder.indexOf(key) === index);
  const placed = new Set(queue);
  const result: string[] = [];
  for (const key of fullOrder) {
    if (!placed.has(key)) result.push(key);
    else {
      const next = queue.shift();
      if (next !== undefined) result.push(next);
    }
  }
  return [...result, ...queue];
}

/**
 * Les masquées à enregistrer : celles d'avant qui ne sont pas des
 * bibliothèques (Pour vous, Ma liste, Favoris gardent leur état), plus chaque
 * bibliothèque de la page qui n'est pas épinglée.
 */
export function railSetupHidden(
  currentHidden: readonly string[],
  libraryKeys: readonly string[],
  isPinned: (key: string) => boolean,
): string[] {
  const kept = currentHidden.filter((key) => libraryIdOf(key) === null);
  return [...kept, ...libraryKeys.filter((key) => !isPinned(key))];
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

/** Ce que dit le socle pour le profil actif (`show` : à partir de deux bibliothèques). */
export type RailSetupGateStatus = "show" | "skip" | "wait";

/**
 * L'attente bornée de l'arrivée : hors ligne ou serveur lent, la page ne
 * retient pas l'accueil — elle y file sans rien marquer, et reviendra.
 */
export const RAIL_SETUP_WAIT_MAX_MS = 5_000;

export type RailSetupArrival = "wait" | "show" | "home";

/**
 * L'arrivée sur la page : le socle dit `wait` tant qu'il ne sait pas (rien
 * ne paraît, l'accueil non plus), `show`, ou `skip` (l'accueil). Une page
 * montrée le RESTE jusqu'au choix du profil : une relecture des
 * bibliothèques ne la retire pas sous la télécommande.
 */
export function railSetupArrival(previous: RailSetupArrival, gate: RailSetupGateStatus, waitedMs: number): RailSetupArrival {
  if (previous !== "wait") return previous;
  if (gate === "show") return "show";
  if (gate === "skip" || waitedMs >= RAIL_SETUP_WAIT_MAX_MS) return "home";
  return "wait";
}
