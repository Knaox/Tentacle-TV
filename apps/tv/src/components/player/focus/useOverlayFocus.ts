import { useCallback } from "react";
import {
  useOverlayFocusCore,
  type FocusNode,
  type OverlayFocusControl,
  type TransportKey,
} from "./overlayFocusCore";

export type { TransportKey, OverlayFocusControl, OverlayButtonProps } from "./overlayFocusCore";

interface UseOverlayFocusArgs {
  focusSignal: number;
  scrubbing: boolean;
  /** Le bouton visé par le signal courant — cf. `overlayFocusCore`. */
  focusTargetRef?: { readonly current: TransportKey | undefined };
}

/**
 * Mémoire de focus de l'OSD — variante **Android TV**.
 * Le moteur de focus Android applique `hasTVPreferredFocus` immédiatement : un
 * simple `setNativeProps({ hasTVPreferredFocus: true })` suffit à déplacer le
 * focus. (tvOS exige un cycle false→true, cf. `useOverlayFocus.ios.ts`.)
 */
export function useOverlayFocus({ focusSignal, scrubbing, focusTargetRef }: UseOverlayFocusArgs): OverlayFocusControl {
  const restore = useCallback((node: FocusNode) => {
    node?.setNativeProps?.({ hasTVPreferredFocus: true });
  }, []);
  return useOverlayFocusCore({ focusSignal, scrubbing, restore, focusTargetRef });
}
