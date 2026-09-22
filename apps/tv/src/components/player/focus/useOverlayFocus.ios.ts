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
export function useOverlayFocus({ focusSignal, scrubbing, focusTargetRef }: UseOverlayFocusArgs): OverlayFocusControl {
  const restore = useCallback((node: FocusNode) => {
    if (!node?.setNativeProps) return;
    node.setNativeProps({ hasTVPreferredFocus: false });
    setTimeout(() => {
      node.setNativeProps?.({ hasTVPreferredFocus: true });
      // RELÂCHER, et c'est ce qui manquait : une préférence laissée à `true`
      // retient le focus — le moteur y ramène la sélection à chaque occasion,
      // et l'utilisateur ne peut plus s'en éloigner durablement.
      setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: false }), 120);
    }, 50);
  }, []);
  return useOverlayFocusCore({ focusSignal, scrubbing, restore, focusTargetRef });
}
