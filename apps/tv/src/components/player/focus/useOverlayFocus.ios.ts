import { useCallback } from "react";
import {
  useOverlayFocusCore,
  type FocusNode,
  type OverlayFocusControl,
} from "./overlayFocusCore";

export type { TransportKey, OverlayFocusControl, OverlayButtonProps } from "./overlayFocusCore";

interface UseOverlayFocusArgs {
  focusSignal: number;
  scrubbing: boolean;
}

/**
 * Mémoire de focus de l'OSD — variante **Apple TV (tvOS)**.
 *
 * Sur tvOS, re-poser `hasTVPreferredFocus: true` alors qu'il est déjà `true` ne
 * redéplace PAS le focus (react-native-tvos #849) : il faut un cycle
 * false→true. C'est la SEULE différence avec Android — tout le reste (quel
 * bouton est « le dernier », verrou scrub, signaux) vient du cœur partagé.
 *
 * Cohabite avec l'`autoFocus` natif de la TVFocusGuideView : les deux ciblent le
 * MÊME dernier bouton (plus de `hasTVPreferredFocus` permanent sur play/pause qui
 * causait le « saut » de focus sur Apple TV).
 */
export function useOverlayFocus({ focusSignal, scrubbing }: UseOverlayFocusArgs): OverlayFocusControl {
  const restore = useCallback((node: FocusNode) => {
    if (!node?.setNativeProps) return;
    node.setNativeProps({ hasTVPreferredFocus: false });
    setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
  }, []);
  return useOverlayFocusCore({ focusSignal, scrubbing, restore });
}
