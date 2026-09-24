import { useCallback } from "react";
import {
  useOverlayFocusCore,
  type FocusNode,
  type OverlayFocusControl,
  type TransportKey,
} from "./overlayFocusCore";
import { requestAndroidTvFocus } from "../../../hooks/useTvFocusClaim";

export type { TransportKey, OverlayFocusControl, OverlayButtonProps } from "./overlayFocusCore";

interface UseOverlayFocusArgs {
  focusSignal: number;
  scrubbing: boolean;
  /** Le bouton visé par le signal courant — cf. `overlayFocusCore`. */
  focusTargetRef?: { readonly current: TransportKey | undefined };
}

/**
 * Mémoire de focus de l'OSD — variante **Android TV**.
 * Android applique `hasTVPreferredFocus` sans délai, mais seulement sur une
 * transition faux → vrai : un bouton qui l'avait déjà ne reprenait pas le
 * focus (cf. `requestAndroidTvFocus`). tvOS a son propre cycle temporisé,
 * cf. `useOverlayFocus.ios.ts`.
 */
export function useOverlayFocus({ focusSignal, scrubbing, focusTargetRef }: UseOverlayFocusArgs): OverlayFocusControl {
  const restore = useCallback((node: FocusNode) => {
    requestAndroidTvFocus(node);
  }, []);
  return useOverlayFocusCore({ focusSignal, scrubbing, restore, focusTargetRef });
}
