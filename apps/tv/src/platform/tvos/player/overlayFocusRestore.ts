import { FOCUS_PREFERENCE_CYCLE } from "@tentacle-tv/tv-core";
import type { FocusNode } from "../../../components/player/focus/overlayFocusCore";

/**
 * La restauration du focus de l'habillage du lecteur sur Apple TV — la seule
 * primitive propre à tvOS de la mémoire du dernier bouton (`overlayFocusCore`,
 * commune à Android TV) : le cycle de la préférence native
 * (`FOCUS_PREFERENCE_CYCLE`, tv-core), faux → vrai → relâchée.
 */
export function restoreOverlayFocus(node: FocusNode): void {
  if (!node?.setNativeProps) return;
  node.setNativeProps({ hasTVPreferredFocus: false });
  setTimeout(() => {
    node.setNativeProps?.({ hasTVPreferredFocus: true });
    setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: false }), FOCUS_PREFERENCE_CYCLE.releaseMs);
  }, FOCUS_PREFERENCE_CYCLE.armMs);
}
