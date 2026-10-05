import { focusLockWaitsForBlur } from "@tentacle-tv/tv-core";
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
 *
 * Jamais sous le focus (`focusLockWaitsForBlur`, tv-core) : verrouiller la
 * cible focalisée faisait boucler react-native-tvos dans le guide qui la vise
 * — débordement de pile, l'app tombait au jumelage. Le verrou attend alors
 * la perte du focus ; un déverrouillage entre-temps l'annule.
 */

/** Les props d'une cible verrouillée (Android : `tvFocusable`). */
export const FOCUS_LOCKED: FocusExtras = { native: { tvFocusable: false } };

type Settable = { setNativeProps?: (props: object) => void };

/** Les verrous en attente de la perte du focus, par magasin puis par clé : leur désabonnement. */
const waiting = new WeakMap<FocusStore, Map<string, () => void>>();

function apply(focus: FocusStore, key: string, locked: boolean): void {
  focus.bind(key, locked ? FOCUS_LOCKED : null);
  (focus.node(key) as Settable | null)?.setNativeProps?.({ tvFocusable: !locked });
}

export function setFocusLocked(focus: FocusStore, key: string, locked: boolean): void {
  let pending = waiting.get(focus);
  if (!pending) {
    pending = new Map();
    waiting.set(focus, pending);
  }
  pending.get(key)?.();
  pending.delete(key);
  if (!focusLockWaitsForBlur(locked, key, focus.focusedKey())) return apply(focus, key, locked);
  const queue = pending;
  const off = focus.subscribe((changed, focused) => {
    if (changed !== key || focused) return;
    off();
    queue.delete(key);
    apply(focus, key, true);
  });
  queue.set(key, off);
}
