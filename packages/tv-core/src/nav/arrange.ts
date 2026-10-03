import { isMovableRailKey, navEntryOf } from "./railKeys";
import { moveRailKeyTo } from "./railOrder";

/**
 * DÉPLACER une entrée dans une liste ordonnée, à la télécommande — la même
 * mécanique pour le rail (`nav:<entrée>`) et pour Réglages › Navigation
 * (`settings:nav:<case>`). Module pur : l'adaptateur lui dit où est le focus,
 * il dit quoi faire.
 *
 * - On SOULÈVE une entrée (`startArrange`) : l'ordre COMPLET de départ
 *   (masquées comprises) et sa case. Rien n'est enregistré avant la pose.
 * - La liste est rendue par POSITION : le focus natif passe à la case voisine
 *   (HAUT / BAS), et l'ordre en cours y amène l'entrée soulevée
 *   (`arrangeOnFocus` → `reorder`) — elle suit le focus sans réclamation.
 *   Les cibles qui ne bougent pas sont infocalisables le temps du
 *   déplacement (l'adaptateur les verrouille).
 * - Le focus SORT de la liste : l'entrée est posée là où elle est (`drop`).
 * - OK pose (`drop`) ; Retour annule : l'ordre d'avant, et le focus revient à
 *   l'entrée (rail) ou à sa case de départ (Réglages) — `from`.
 */

export interface ArrangeMove {
  /** L'entrée soulevée. */
  key: string;
  /** L'ordre en cours, complet ; rien d'enregistré avant la pose. */
  order: string[];
  /** Sa case au départ : Retour l'y ramène. */
  from: number;
}

/** Ce que vise le focus pendant un déplacement. */
export type ArrangeReading =
  /** Une entrée déplaçable de la liste. */
  | { kind: "entry"; key: string }
  /** Une autre cible de la liste (verrouillée, ou sans entrée) : rien ne bouge. */
  | { kind: "inside" }
  /** Hors de la liste : l'entrée est posée. */
  | { kind: "outside" };

export type ArrangeOutcome = { kind: "reorder"; move: ArrangeMove } | { kind: "drop" } | { kind: "none" };

export function startArrange(key: string, order: readonly string[], from: number): ArrangeMove {
  return { key, order: [...order], from };
}

/** Le focus se pose quelque part pendant le déplacement. */
export function arrangeOnFocus(move: ArrangeMove, reading: ArrangeReading): ArrangeOutcome {
  if (reading.kind === "outside") return { kind: "drop" };
  if (reading.kind === "inside" || reading.key === move.key) return { kind: "none" };
  return { kind: "reorder", move: { ...move, order: moveRailKeyTo(move.order, move.key, reading.key) } };
}

/**
 * Le RAIL : une clé `nav:<entrée>` organisable est une entrée ; une autre clé
 * du rail (Rechercher, Accueil, le profil… verrouillés) ne fait rien ; hors
 * du rail, on pose.
 */
export function railArrangeReading(focusKey: string): ArrangeReading {
  const entry = navEntryOf(focusKey);
  if (entry === null) return { kind: "outside" };
  return isMovableRailKey(entry) ? { kind: "entry", key: entry } : { kind: "inside" };
}

/**
 * Une liste de LIGNES `<préfixe><case>` (Réglages › Navigation :
 * `settings:nav:<case>`) : la ligne d'une case montre `keys[case]` (l'ordre
 * EN COURS) ; une autre clé du préfixe (pastille, bouton) ne fait rien ; hors
 * du préfixe, on pose.
 */
export function rowsArrangeReading(focusKey: string, prefix: string, keys: readonly string[]): ArrangeReading {
  if (!focusKey.startsWith(prefix)) return { kind: "outside" };
  const slot = /^(\d+)$/.exec(focusKey.slice(prefix.length));
  const key = slot ? keys[Number(slot[1])] : undefined;
  return key ? { kind: "entry", key } : { kind: "inside" };
}

/**
 * OK pendant un déplacement : dans le rail, OK pose où que soit le focus ; dans
 * des lignes, seulement sur la ligne soulevée (ailleurs, rien).
 */
export function rowsSelectWhileArranging(move: ArrangeMove, selectedKey: string): "drop" | "none" {
  return selectedKey === move.key ? "drop" : "none";
}
