import { useCallback, useEffect, useRef } from "react";
import { Platform, type View } from "react-native";

// react-native-tvos expose `useTVEventHandler` comme un hook (cf. useTVRemote).
const { useTVEventHandler } = require("react-native") as {
  useTVEventHandler: (callback: (evt: { eventType: string }) => void) => void;
};

/** Le temps qu'il faut à l'écran d'arrivée pour être posé.
 *
 *  `requestFocus()` échoue sur une vue qui n'a pas encore de dimensions, et le
 *  nœud est publié par le rappel de référence — donc AVANT la mise en page. Ce
 *  délai n'est pas une superstition : c'est celui que la restauration de focus
 *  de l'accueil emploie déjà, éprouvé sur boîtier réel. */
const SET_DELAY_MS = 60;

/** tvOS n'honore `hasTVPreferredFocus` que sur une transition faux→vrai
 *  (contournement RN-tvos #849) : le nœud a déjà la valeur `true` en propriété,
 *  un simple `true` serait donc sans effet. */
const CYCLE_TVOS_MS = 50;

/**
 * Au-delà, l'armement est caduc — un filet, pas la règle.
 *
 * Sans péremption, un armement que personne ne vient consommer survit à la
 * session entière — l'écran visé peut très bien republier le nœud qu'il
 * exposait déjà, auquel cas l'état ne change pas et l'effet ne rejoue jamais.
 * Il se déclenchait alors au prochain changement venu, des minutes plus tard,
 * en plein démontage d'un autre écran.
 *
 * C'est le GESTE de l'utilisateur qui désarme (`DIRECTIONS`), pas l'horloge.
 * Le budget était de trois secondes, et une bibliothèque dont la première
 * affiche attend le réseau plus longtemps — boîtier lent, serveur froid —
 * laissait le focus sur l'entrée du rail replié : aucun anneau nulle part.
 */
const EXPIRY_MS = 15_000;

/** Naviguer soi-même reprend la main sur une intention de focus en attente. */
const DIRECTIONS = new Set(["up", "down", "left", "right"]);

/** Les évènements de la sélection qui vient d'armer peuvent suivre de peu. */
const GRACE_MS = 250;

type FocusableNode = { setNativeProps?: (p: object) => void } | null;

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
export function useContentFocusCapture(contentFocusNode: View | null): () => void {
  // La dernière publication en date, tenue dans une référence : c'est elle
  // qu'on relit au moment de poser, pas la valeur qu'on avait à l'armement.
  const nodeRef = useRef<View | null>(null);
  nodeRef.current = contentFocusNode;

  const pending = useRef(false);
  const armedAt = useRef(0);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    pending.current = false;
    if (expiry.current) { clearTimeout(expiry.current); expiry.current = null; }
  }, []);

  const arm = useCallback(() => {
    pending.current = true;
    armedAt.current = Date.now();
    if (expiry.current) clearTimeout(expiry.current);
    expiry.current = setTimeout(disarm, EXPIRY_MS);
  }, [disarm]);

  // L'utilisateur qui se déplace pendant l'attente a choisi où aller : le
  // focus ne doit plus sauter sous ses pieds à l'arrivée du contenu.
  const onRemote = useCallback((evt: { eventType: string }) => {
    if (!pending.current || !DIRECTIONS.has(evt.eventType)) return;
    if (Date.now() - armedAt.current < GRACE_MS) return;
    disarm();
  }, [disarm]);
  useTVEventHandler(onRemote);

  useEffect(() => {
    if (!pending.current || !contentFocusNode) return;
    disarm();

    const target = (): FocusableNode => nodeRef.current as FocusableNode;

    if (Platform.OS !== "ios") {
      const id = setTimeout(() => target()?.setNativeProps?.({ hasTVPreferredFocus: true }), SET_DELAY_MS);
      return () => clearTimeout(id);
    }

    let trueId: ReturnType<typeof setTimeout>;
    const falseId = setTimeout(() => {
      target()?.setNativeProps?.({ hasTVPreferredFocus: false });
      trueId = setTimeout(() => target()?.setNativeProps?.({ hasTVPreferredFocus: true }), CYCLE_TVOS_MS);
    }, SET_DELAY_MS);
    return () => { clearTimeout(falseId); clearTimeout(trueId); };
  }, [contentFocusNode, disarm]);

  // Le chrome de navigation vit aussi longtemps que l'application ; le
  // minuteur de péremption, lui, ne doit pas survivre à un démontage.
  useEffect(() => () => {
    if (expiry.current) clearTimeout(expiry.current);
  }, []);

  return arm;
}
