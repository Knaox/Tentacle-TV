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
    return claimTvFocus(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, nonce]);
}

/**
 * Déplacer le focus sur Android TV — toujours par une transition faux → vrai.
 *
 * `ReactViewManager.setTVPreferredFocus` compare la valeur à l'état de la vue
 * et n'appelle `requestFocus()` que sur une TRANSITION : poser `true` sur une
 * vue qui l'a déjà ne fait rien. On le croyait « immédiat, une fois pour
 * toutes » ; c'était une fois par vue. Retour sur l'accueil ne rendait le
 * focus au rail qu'une seule fois par session, et une pastille de filtre ne le
 * reprenait qu'à la fermeture de son premier menu. Les deux écritures partent
 * dans l'ordre, dans le même lot : la première remet l'état, la seconde agit.
 */
export function requestAndroidTvFocus(target: unknown): void {
  const node = target as FocusableNode;
  node?.setNativeProps?.({ hasTVPreferredFocus: false });
  node?.setNativeProps?.({ hasTVPreferredFocus: true });
}

/**
 * La réclamation elle-même, hors cycle de rendu — pour un geste qui DÉCIDE où
 * va le focus (fermer un menu rend le focus à ce qui l'a ouvert). Rend
 * l'annulation des minuteurs.
 */
export function claimTvFocus(target: unknown): () => void {
  const node = target as FocusableNode;
  if (!node?.setNativeProps) return () => {};

  if (Platform.OS !== "ios") {
    // Android : le délai laisse la vue être posée quand la réclamation part
    // de son montage (cf. `requestAndroidTvFocus` pour la transition).
    const id = setTimeout(() => requestAndroidTvFocus(node), 120);
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
}
