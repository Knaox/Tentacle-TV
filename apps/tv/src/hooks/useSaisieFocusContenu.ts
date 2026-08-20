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

/**
 * Au-delà, l'armement est caduc.
 *
 * Sans péremption, un armement que personne ne vient consommer survit à la
 * session entière — l'écran visé peut très bien republier le nœud qu'il
 * exposait déjà, auquel cas l'état ne change pas et l'effet ne rejoue jamais.
 * Il se déclenchait alors au prochain changement venu, des minutes plus tard,
 * en plein démontage d'un autre écran. Une intention de focus qui n'a pas
 * trouvé preneur en trois secondes ne veut plus rien dire ; c'est le même
 * budget que le moteur de la LG accorde à l'arrivée sur un écran.
 */
const PEREMPTION_MS = 3000;

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
 * **Le nœud est relu au moment de poser, jamais capturé à l'armement.** Entre
 * les deux il s'écoule soixante millisecondes, et elles suffisent : une liste
 * peut recycler la cellule visée, un écran peut finir de se démonter. Envoyer
 * la propriété à la vue qu'on avait en main, c'est lever « Trying to update
 * non-existent view with tag N » — le défaut que l'accueil avait déjà rencontré
 * et corrigé de la même façon.
 *
 * Les deux téléviseurs ne se pilotent pas pareil. Sur Android, poser la
 * propriété vaut `requestFocus()` immédiat, une fois pour toutes
 * (`ReactViewManager.setTVPreferredFocus`). Sur Apple, il faut la faire
 * BASCULER — d'où le faux, puis le vrai.
 */
export function useSaisieFocusContenu(contentFocusNode: View | null): () => void {
  // La dernière publication en date, tenue dans une référence : c'est elle
  // qu'on relit au moment de poser, pas la valeur qu'on avait à l'armement.
  const noeudRef = useRef<View | null>(null);
  noeudRef.current = contentFocusNode;

  const enAttente = useRef(false);
  const peremption = useRef<ReturnType<typeof setTimeout> | null>(null);

  const desarmer = useCallback(() => {
    enAttente.current = false;
    if (peremption.current) { clearTimeout(peremption.current); peremption.current = null; }
  }, []);

  const armer = useCallback(() => {
    enAttente.current = true;
    if (peremption.current) clearTimeout(peremption.current);
    peremption.current = setTimeout(desarmer, PEREMPTION_MS);
  }, [desarmer]);

  useEffect(() => {
    if (!enAttente.current || !contentFocusNode) return;
    desarmer();

    const viser = (): NoeudFocalisable => noeudRef.current as NoeudFocalisable;

    if (Platform.OS !== "ios") {
      const id = setTimeout(() => viser()?.setNativeProps?.({ hasTVPreferredFocus: true }), DELAI_POSE_MS);
      return () => clearTimeout(id);
    }

    let idVrai: ReturnType<typeof setTimeout>;
    const idFaux = setTimeout(() => {
      viser()?.setNativeProps?.({ hasTVPreferredFocus: false });
      idVrai = setTimeout(() => viser()?.setNativeProps?.({ hasTVPreferredFocus: true }), CYCLE_TVOS_MS);
    }, DELAI_POSE_MS);
    return () => { clearTimeout(idFaux); clearTimeout(idVrai); };
  }, [contentFocusNode, desarmer]);

  // Le chrome de navigation vit aussi longtemps que l'application ; le
  // minuteur de péremption, lui, ne doit pas survivre à un démontage.
  useEffect(() => () => {
    if (peremption.current) clearTimeout(peremption.current);
  }, []);

  return armer;
}
