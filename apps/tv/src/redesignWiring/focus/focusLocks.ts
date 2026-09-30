import type { FocusExtras, FocusStore } from "./focusStore";

/**
 * Rendre une cible non focalisable pour un temps, puis la libérer. Sur tvOS,
 * c'est `isTVSelectable` qui en décide (`RCTTVView.canBecomeFocused`) —
 * `focusable: false` n'y fait rien.
 *
 * Le verrou passe par les deux voies : la liaison de la clé, lue au prochain
 * rendu de la cible, ET son nœud déjà monté — une cible mémoïsée (un bouton
 * aux props stables) ne se redessine pas, et garderait sinon son état.
 * Libérer retire toute la liaison ajoutée à la clé.
 */

const LOCKED: FocusExtras = { native: { isTVSelectable: false } };

type Settable = { setNativeProps?: (props: object) => void };

export function setFocusLocked(focus: FocusStore, key: string, locked: boolean): void {
  focus.bind(key, locked ? LOCKED : null);
  (focus.node(key) as Settable | null)?.setNativeProps?.({ isTVSelectable: !locked });
}
