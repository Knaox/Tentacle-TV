/**
 * Octave — la sélection multiple de titres (retour de Damien du 25/10), règle pure :
 * - Cmd-clic (Ctrl-clic hors Mac) ajoute ou retire UN titre ; Maj-clic étend du dernier titre désigné (l'ancre)
 *   au titre cliqué, sans rien perdre de ce qui était déjà choisi ;
 * - la case à cocher d'une rangée fait de même (Maj compris) ;
 * - dès qu'un titre est choisi, la liste est « en sélection » : un clic simple coche ou décoche (comme les cases),
 *   il ne lit plus — Échap ou « × » en sortent ;
 * - une seule liste à la fois : choisir dans une autre liste repart de zéro ;
 * - « Sélectionner » (mobile, et le bouton du bureau) OUVRE la sélection sans rien choisir (`open`) : décocher le
 *   dernier titre la garde ouverte, seul « Terminé » / « × » la ferme (ajout du 29/10, lot fv).
 * Partagée : web, bureau, mobile (`@tentacle-tv/shared/octave`).
 */

export type SelectGesture = "toggle" | "range";

export interface SelectionState {
  /** La liste qui tient la sélection ; `null` : aucune. */
  owner: string | null;
  keys: ReadonlySet<string>;
  /** Le dernier titre désigné (point de départ d'un Maj-clic). */
  anchor: string | null;
  /** Ouverte par « Sélectionner » : elle reste ouverte sans aucun titre choisi. */
  open?: boolean;
}

export const EMPTY_SELECTION: SelectionState = { owner: null, keys: new Set(), anchor: null };

export interface ClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

/** Ce que fait un clic sur une rangée : lire, ou choisir. */
export function clickGesture(modifiers: ClickModifiers, selecting: boolean): SelectGesture | "play" {
  if (modifiers.shiftKey) return "range";
  if (modifiers.metaKey || modifiers.ctrlKey) return "toggle";
  return selecting ? "toggle" : "play";
}

export function applyGesture(state: SelectionState, owner: string, order: readonly string[], key: string, gesture: SelectGesture): SelectionState {
  const own = state.owner === owner;
  const keys = new Set(own ? state.keys : []);
  const open = own && state.open === true;
  const anchor = own && state.anchor !== null && order.includes(state.anchor) ? state.anchor : null;
  if (gesture === "range" && anchor !== null) {
    const from = order.indexOf(anchor);
    const to = order.indexOf(key);
    if (to < 0) return state;
    for (let i = Math.min(from, to); i <= Math.max(from, to); i += 1) keys.add(order[i] as string);
    return { owner, keys, anchor, ...(open && { open }) };
  }
  // Un Maj-clic sans ancre désigne simplement ce titre.
  if (keys.has(key) && gesture === "toggle") keys.delete(key);
  else keys.add(key);
  if (keys.size === 0) return open ? { owner, keys, anchor: null, open } : EMPTY_SELECTION;
  return { owner, keys, anchor: key, ...(open && { open }) };
}

/** « Sélectionner » : la sélection de cette liste s'ouvre, vide. */
export function openSelection(owner: string): SelectionState {
  return { owner, keys: new Set(), anchor: null, open: true };
}

/** La liste est-elle en sélection (un titre choisi, ou ouverte par « Sélectionner ») ? */
export function isSelecting(state: SelectionState, owner: string): boolean {
  return state.owner === owner && (state.keys.size > 0 || state.open === true);
}

export function selectAll(owner: string, order: readonly string[], open = false): SelectionState {
  if (order.length === 0) return open ? openSelection(owner) : EMPTY_SELECTION;
  return { owner, keys: new Set(order), anchor: order[0] ?? null, ...(open && { open }) };
}

/** La liste a changé (un titre retiré, une page de plus) : ce qui n'y est plus quitte la sélection. */
export function pruneSelection(state: SelectionState, owner: string, order: readonly string[]): SelectionState {
  if (state.owner !== owner) return state;
  const present = new Set(order);
  const keys = new Set([...state.keys].filter((k) => present.has(k)));
  if (keys.size === state.keys.size) return state;
  if (keys.size === 0) return state.open ? openSelection(owner) : EMPTY_SELECTION;
  return { owner, keys, anchor: state.anchor !== null && present.has(state.anchor) ? state.anchor : null, ...(state.open && { open: true }) };
}

/** Les clés choisies, dans l'ordre de la liste (les gestes groupés gardent l'ordre affiché). */
export function orderedKeys(order: readonly string[], keys: ReadonlySet<string>): string[] {
  return order.filter((k) => keys.has(k));
}
