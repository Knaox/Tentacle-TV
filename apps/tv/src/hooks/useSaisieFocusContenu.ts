import { useCallback, useEffect, useRef } from "react";
import { Platform, type View } from "react-native";

/** Le temps qu'il faut à l'écran d'arrivée pour être posé.
 *
 *  `requestFocus()` échoue sur une vue qui n'a pas encore de dimensions, et le
 *  nœud est publié par le rappel de référence — donc AVANT la mise en page. Ce
 *  délai n'est pas une superstition : c'est celui que la restauration de focus
 *  de l'accueil emploie déjà, éprouvé sur boîtier réel. */
const DELAI_POSE_MS = 60;

/** tvOS n'honore `hasTVPreferredFocus` que sur une transition faux→vrai
 *  (contournement RN-tvos #849) : le nœud a déjà la valeur `true` en propriété,
 *  un simple `true` serait donc sans effet. */
const CYCLE_TVOS_MS = 50;

type NoeudFocalisable = { setNativeProps?: (p: object) => void } | null;

/**
 * Poser le focus sur le contenu après une navigation venue du rail.
 *
 * Sans cela, sélectionner une bibliothèque ne déplaçait rien : le rail est un
 * overlay frère du navigateur, jamais démonté, si bien que le focus natif
 * restait sur l'entrée qu'on venait de valider. Le rail se repliait, l'écran
 * arrivait, et l'anneau était toujours dans le menu.
 *
 * On arme à la sélection, et on pose quand le NOUVEL écran a publié son nœud
 * d'entrée — pas sur un compte à rebours. Les écrans ne publient pas au même
 * moment : un retour vers l'accueil publie plus tard qu'une entrée en
 * bibliothèque, dont la première cellule attend le réseau.
 *
 * Les deux téléviseurs ne se pilotent pas de la même façon. Sur Android, poser
 * la propriété vaut `requestFocus()` immédiat, une fois pour toutes
 * (`ReactViewManager.setTVPreferredFocus`). Sur Apple, il faut la faire
 * BASCULER — d'où le faux, puis le vrai.
 */
export function useSaisieFocusContenu(contentFocusNode: View | null): () => void {
  const enAttente = useRef(false);

  const armer = useCallback(() => { enAttente.current = true; }, []);

  useEffect(() => {
    if (!enAttente.current || !contentFocusNode) return;
    enAttente.current = false;
    const noeud = contentFocusNode as NoeudFocalisable;
    if (!noeud?.setNativeProps) return;

    if (Platform.OS !== "ios") {
      const id = setTimeout(() => noeud.setNativeProps?.({ hasTVPreferredFocus: true }), DELAI_POSE_MS);
      return () => clearTimeout(id);
    }

    let idVrai: ReturnType<typeof setTimeout>;
    const idFaux = setTimeout(() => {
      noeud.setNativeProps?.({ hasTVPreferredFocus: false });
      idVrai = setTimeout(() => noeud.setNativeProps?.({ hasTVPreferredFocus: true }), CYCLE_TVOS_MS);
    }, DELAI_POSE_MS);
    return () => { clearTimeout(idFaux); clearTimeout(idVrai); };
  }, [contentFocusNode]);

  return armer;
}
