import type { FocusExtras, FocusStore } from "../../tvos/focus/focusStore";

/**
 * Android TV — rendre une cible non focalisable pour un temps, puis la
 * libérer : le pendant de `platform/tvos/focus/focusLocks.ts`, même API.
 *
 * Sur Android, ni `isTVSelectable` (tvOS seulement) ni `focusable={false}`
 * (React Native garde la vue focalisable, « pour l'accessibilité ») n'y font
 * rien : c'est `tvFocusable` (`ReactViewManager.setTvFocusable` →
 * `isFocusable`, et ses descendants bloqués). Même double voie que tvOS : la
 * liaison de la clé (prochain rendu) ET le nœud déjà monté.
 */

const LOCKED: FocusExtras = { native: { tvFocusable: false } };

type Settable = { setNativeProps?: (props: object) => void };

export function setFocusLocked(focus: FocusStore, key: string, locked: boolean): void {
  focus.bind(key, locked ? LOCKED : null);
  (focus.node(key) as Settable | null)?.setNativeProps?.({ tvFocusable: !locked });
}
