import { useEffect, useRef, type RefObject } from "react";
import { Platform } from "react-native";

type FocusableNode = { setNativeProps?: (props: object) => void } | null;

/**
 * RÉCLAMER le focus pour une surface posée au-dessus de la vidéo.
 *
 * `hasTVPreferredFocus` ne suffit jamais : il n'est honoré qu'au MONTAGE, et si
 * le moteur de focus tient déjà un élément valide ailleurs — l'habillage, le
 * fond — il l'ignore purement et simplement. C'est ce qui rendait l'affiche de
 * fin innavigable : ni « Lire maintenant » ni « Masquer » ne prenaient jamais
 * le focus, et le D-pad n'avait plus rien à déplacer.
 *
 * Le geste diffère selon la plateforme, et c'est toute la raison d'être de ce
 * hook — le reste du lecteur ne devrait pas avoir à le savoir :
 *
 *  - **tvOS** : `hasTVPreferredFocus` doit être CYCLÉ (false → true → false).
 *    Poser `true` sur une prop déjà à `true` ne produit rien ; le repasser à
 *    false ensuite rend la main à l'utilisateur, sans quoi le bouton retient le
 *    focus et le D-pad ne peut plus en sortir (RN-tvos #849) ;
 *  - **Android** : un `setNativeProps` direct vaut `requestFocus`.
 *
 * # Le nonce, et pourquoi un booléen ne suffisait pas
 *
 * La réclamation se fait au front MONTANT de `active` : une surface prend le
 * focus quand elle apparaît, et l'habillage qui s'ouvre par-dessus garde le
 * sien. Mais il existe un second moment où il faut le reprendre sans que rien
 * n'apparaisse — quand l'HABILLAGE S'ÉTEINT. Ses boutons cessent alors d'être
 * focusables, le focus se perd, et le bouton de saut resté à l'écran était
 * inatteignable : le D-pad n'émettait plus rien. Incrémenter `nonce` réclame de
 * nouveau, sans avoir à faire clignoter `active`.
 */
export function useTvFocusClaim(
  ref: RefObject<unknown>,
  active: boolean,
  nonce = 0,
) {
  const previous = useRef(false);
  const seenNonce = useRef(nonce);

  useEffect(() => {
    const rising = active && !previous.current;
    const renewed = active && nonce !== seenNonce.current;
    previous.current = active;
    seenNonce.current = nonce;
    if (!rising && !renewed) return;

    const node = ref.current as FocusableNode;
    if (!node?.setNativeProps) return;

    if (Platform.OS !== "ios") {
      // Android : le moteur de focus honore la demande immédiatement. Le délai
      // laisse la vue être posée quand la réclamation part de son montage.
      const id = setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: true }), 120);
      return () => clearTimeout(id);
    }

    let id2: ReturnType<typeof setTimeout>;
    let id3: ReturnType<typeof setTimeout>;
    const id1 = setTimeout(() => {
      node.setNativeProps?.({ hasTVPreferredFocus: false });
      id2 = setTimeout(() => {
        node.setNativeProps?.({ hasTVPreferredFocus: true });
        // Relâche la préférence une fois le focus pris → l'utilisateur peut
        // repartir au D-pad (sinon la surface « piège » le focus).
        id3 = setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: false }), 120);
      }, 50);
    }, 40);
    return () => { clearTimeout(id1); clearTimeout(id2); clearTimeout(id3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, nonce]);
}
