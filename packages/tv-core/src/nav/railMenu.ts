import { isMovableRailKey, isNavKey, isNavMenuKey, navKeyOf } from "./railKeys";
import { moveRailKey } from "./railOrder";

/**
 * Le MENU d'une entrée du rail, ouvert par l'appui long — module pur.
 *
 * Seule une entrée organisable a un menu (Pour vous, Ma liste, Favoris, une
 * bibliothèque), et jamais pendant un déplacement. En tête, son nom et sa place
 * parmi les organisables visibles (« 4 sur 6 ») ; ses lignes : Déplacer,
 * Monter, Descendre, Masquer, Tout afficher (s'il y a du masqué), Réglages de
 * la navigation. Une ligne impossible (Monter, déjà en tête) reste à sa place,
 * estompée : le focus ne saute pas quand elle le devient. Les six lignes sont
 * gardées du clic fantôme : le menu s'ouvre sous un OK encore enfoncé.
 *
 * Monter / Descendre enregistrent tout de suite et laissent le menu ouvert
 * (OK, OK, OK) ; les autres le ferment. Fermé par Retour (ou par « Tout
 * afficher »), le premier focus que tvOS rend au rail va à l'entrée du menu —
 * elle a pu changer de case.
 */

export type RailMenuAction = "move" | "up" | "down" | "hide" | "showAll" | "settings";

/** Les lignes que la garde anti-clic fantôme protège : toutes. */
export const RAIL_MENU_ACTIONS: readonly RailMenuAction[] = ["move", "up", "down", "hide", "showAll", "settings"];

export interface RailMenuModel {
  key: string;
  label: string;
  /** Sa place parmi les entrées organisables visibles (1 = la première). */
  position: number;
  count: number;
  canUp: boolean;
  canDown: boolean;
  canShowAll: boolean;
}

export interface RailCatalogEntry {
  key: string;
  label: string;
  hidden: boolean;
}

/** Une entrée qu'on peut tenir : organisable, et pas pendant un déplacement. */
export function canOpenRailMenu(entryKey: string, moving: boolean): boolean {
  return isMovableRailKey(entryKey) && !moving;
}

/** Le menu de l'entrée tenue, sur les entrées organisables (ordre choisi, masquées comprises) ; null si elle n'est plus visible. */
export function railMenuModel(entries: readonly RailCatalogEntry[], heldKey: string | null): RailMenuModel | null {
  if (!heldKey) return null;
  const visible = entries.filter((entry) => !entry.hidden);
  const index = visible.findIndex((entry) => entry.key === heldKey);
  if (index < 0) return null;
  return {
    key: heldKey,
    label: visible[index].label,
    position: index + 1,
    count: visible.length,
    canUp: index > 0,
    canDown: index < visible.length - 1,
    canShowAll: entries.some((entry) => entry.hidden),
  };
}

/** Les lignes, dans l'ordre. Seules Monter et Descendre peuvent être impossibles (`disabled`) : à leur place, estompées. */
export function railMenuItems(model: Pick<RailMenuModel, "canUp" | "canDown" | "canShowAll">): Array<{ action: RailMenuAction; disabled?: boolean }> {
  return [
    { action: "move" },
    { action: "up", disabled: !model.canUp },
    { action: "down", disabled: !model.canDown },
    { action: "hide" },
    ...(model.canShowAll ? [{ action: "showAll" as const }] : []),
    { action: "settings" },
  ];
}

export type RailMenuEffect =
  /** Monter, Descendre : le nouvel ordre, enregistré tout de suite ; le menu reste ouvert. */
  | { kind: "reorder"; order: string[] }
  /** Masquer : le menu se ferme ; la suivante prend la case (et le focus). */
  | { kind: "hide"; key: string }
  /** Tout afficher : le menu se ferme ; le focus retrouvera l'entrée. */
  | { kind: "showAll"; returnTo: string }
  /** Déplacer : le menu se ferme, l'entrée est soulevée (`nav/arrange`). */
  | { kind: "move"; key: string }
  /** Réglages de la navigation. */
  | { kind: "settings" };

export function railMenuEffect(
  action: RailMenuAction,
  heldKey: string,
  keys: readonly string[],
  isHidden: (entryKey: string) => boolean,
): RailMenuEffect {
  switch (action) {
    case "up":
    case "down":
      return { kind: "reorder", order: moveRailKey(keys, heldKey, action === "up" ? -1 : 1, (other) => !isHidden(other)) };
    case "hide":
      return { kind: "hide", key: heldKey };
    case "showAll":
      return { kind: "showAll", returnTo: heldKey };
    case "move":
      return { kind: "move", key: heldKey };
    case "settings":
      return { kind: "settings" };
  }
}

/** Le focus rendu au rail après la fermeture du menu arrive dans ce délai ; au-delà, il était parti ailleurs. */
export const RAIL_MENU_RETURN_WITHIN_MS = 1500;

export interface RailMenuReturn {
  key: string;
  at: number;
}

/** Le menu se ferme (Retour) : l'entrée à retrouver — aucune s'il n'y avait plus d'entrée tenue (relevé B2). */
export function railMenuReturnOnClose(heldKey: string | null, now: number): RailMenuReturn | null {
  return heldKey ? { key: heldKey, at: now } : null;
}

/**
 * La Modal du menu vient de se retirer : la case à réclamer d'office, pour une
 * plateforme qui rend le focus SANS l'annoncer (Android : la fenêtre de
 * l'activité le redonne à ce qui l'avait). Rien hors délai.
 */
export function railMenuReturnTarget(pending: RailMenuReturn | null, now: number): string | null {
  if (!pending || now - pending.at > RAIL_MENU_RETURN_WITHIN_MS) return null;
  return navKeyOf(pending.key);
}

/**
 * Un focus se pose sur `focusKey` : le premier focus rendu au rail (une clé de
 * la navigation hors des lignes du menu) CONSOMME l'attente ; s'il arrive à
 * temps et sur une autre case, il faut réclamer l'entrée du menu.
 */
export function railMenuReturnOnFocus(pending: RailMenuReturn | null, focusKey: string, now: number): { consume: boolean; claim: string | null } {
  if (!pending || !isNavKey(focusKey) || isNavMenuKey(focusKey)) return { consume: false, claim: null };
  if (now - pending.at > RAIL_MENU_RETURN_WITHIN_MS) return { consume: true, claim: null };
  const target = navKeyOf(pending.key);
  return { consume: true, claim: focusKey === target ? null : target };
}
