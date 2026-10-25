/**
 * Octave — la sélection multiple de titres (retour de Damien du 25/10), règle pure :
 * - Cmd-clic (Ctrl-clic hors Mac) ajoute ou retire UN titre ; Maj-clic étend du dernier titre désigné (l'ancre)
 *   au titre cliqué, sans rien perdre de ce qui était déjà choisi ;
 * - la case à cocher d'une rangée fait de même (Maj compris) ;
 * - dès qu'un titre est choisi, la liste est « en sélection » : un clic simple coche ou décoche (comme les cases),
 *   il ne lit plus — Échap ou « × » en sortent ;
 * - une seule liste à la fois : choisir dans une autre liste repart de zéro.
 */

export type SelectGesture = "toggle" | "range";

export interface SelectionState {
  /** La liste qui tient la sélection ; `null` : aucune. */
  owner: string | null;
  keys: ReadonlySet<string>;
  /** Le dernier titre désigné (point de départ d'un Maj-clic). */
  anchor: string | null;
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
  const anchor = own && state.anchor !== null && order.includes(state.anchor) ? state.anchor : null;
  if (gesture === "range" && anchor !== null) {
    const from = order.indexOf(anchor);
    const to = order.indexOf(key);
    if (to < 0) return state;
    for (let i = Math.min(from, to); i <= Math.max(from, to); i += 1) keys.add(order[i] as string);
    return { owner, keys, anchor };
  }
  // Un Maj-clic sans ancre désigne simplement ce titre.
  if (keys.has(key) && gesture === "toggle") keys.delete(key);
  else keys.add(key);
  return keys.size === 0 ? EMPTY_SELECTION : { owner, keys, anchor: key };
}

export function selectAll(owner: string, order: readonly string[]): SelectionState {
  return order.length === 0 ? EMPTY_SELECTION : { owner, keys: new Set(order), anchor: order[0] ?? null };
}

/** La liste a changé (un titre retiré, une page de plus) : ce qui n'y est plus quitte la sélection. */
export function pruneSelection(state: SelectionState, owner: string, order: readonly string[]): SelectionState {
  if (state.owner !== owner) return state;
  const present = new Set(order);
  const keys = new Set([...state.keys].filter((k) => present.has(k)));
  if (keys.size === state.keys.size) return state;
  if (keys.size === 0) return EMPTY_SELECTION;
  return { owner, keys, anchor: state.anchor !== null && present.has(state.anchor) ? state.anchor : null };
}

/** Les clés choisies, dans l'ordre de la liste (les gestes groupés gardent l'ordre affiché). */
export function orderedKeys(order: readonly string[], keys: ReadonlySet<string>): string[] {
  return order.filter((k) => keys.has(k));
}
