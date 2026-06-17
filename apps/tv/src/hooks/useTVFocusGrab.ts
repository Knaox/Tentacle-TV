import { useEffect, useRef, type RefObject } from "react";
import { Platform } from "react-native";

type FocusableNode = { setNativeProps?: (props: object) => void } | null;

/**
 * Prend le focus tvOS sur `ref` au FRONT MONTANT de `active` (false→true).
 *
 * Sur Apple TV, le focus est piloté par le focus engine : si l'élément focalisé
 * disparaît (OSD caché, panneau fermé…), le focus est perdu et le D-pad n'émet
 * plus rien. `hasTVPreferredFocus` n'est honoré qu'au montage, pas sur un simple
 * changement de prop → on force le grab via `setNativeProps(false)` puis `true`
 * (workaround RN-tvos #849, même pattern que TVNavChrome).
 *
 * No-op sur Android (le focus y est géré différemment + useFocusRecovery).
 */
export function useTVFocusGrab(ref: RefObject<unknown>, active: boolean) {
  const prevActive = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const rising = active && !prevActive.current;
    prevActive.current = active;
    if (!rising) return;

    const node = ref.current as FocusableNode;
    if (!node?.setNativeProps) return;

    let id2: ReturnType<typeof setTimeout>;
    let id3: ReturnType<typeof setTimeout>;
    const id1 = setTimeout(() => {
      node.setNativeProps?.({ hasTVPreferredFocus: false });
      id2 = setTimeout(() => {
        node.setNativeProps?.({ hasTVPreferredFocus: true });
        // Relâche la préférence une fois le focus pris → l'utilisateur peut
        // repartir au D-pad (sinon le bouton « piège » le focus).
        id3 = setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: false }), 120);
      }, 50);
    }, 40);
    return () => { clearTimeout(id1); clearTimeout(id2); clearTimeout(id3); };
  }, [active, ref]);
}
