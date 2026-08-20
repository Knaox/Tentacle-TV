import { useCallback, useRef } from "react";
import type { View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTVNavActions } from "../context/TVNavContext";

/**
 * Publie le focusable « d'entrée » du contenu dans TVNavContext.
 *
 * `contentFocusNode` doit être un VRAI Focusable (Pressable) : c'est la cible du
 * pont droit (sortie rail) ET du focus impératif d'auto-collapse à la sélection
 * (`setNativeProps({hasTVPreferredFocus})` n'a d'effet que sur un Pressable, pas
 * sur un TVFocusGuideView).
 *
 * Publié via `useFocusEffect` → c'est l'écran ACTUELLEMENT focus qui expose son
 * nœud (robuste au push/pop du native-stack qui garde les écrans montés).
 *
 * Usage : `const ref = useTVContentEntry();` puis `<Focusable ref={ref} … />`.
 */
export function useTVContentEntry() {
  const { setContentFocusNode } = useTVNavActions();
  const nodeRef = useRef<View | null>(null);
  // L'écran est-il actuellement focus ? Les écrans à données asynchrones
  // (grilles) montent leur premier focusable APRÈS le focus d'écran : setRef
  // doit alors publier lui-même, sinon le nœud n'est jamais exposé et le rail
  // garde le focus (sélection au rail sans effet).
  const screenFocusedRef = useRef(false);

  const setRef = useCallback((node: View | null) => {
    nodeRef.current = node;
    if (node) {
      if (screenFocusedRef.current) setContentFocusNode(node);
      return;
    }
    /**
     * Détachement — et la question n'est pas tranchable dans l'instant.
     *
     * Le recyclage d'une cellule détache l'ancienne et attache celle qui la
     * remplace, dans un ordre que rien ne garantit : effacer tout de suite
     * effacerait parfois la publication de la SUIVANTE. On attend donc un tour.
     * Si plus rien ne s'est rattaché, c'est que la cible a bien disparu.
     *
     * Et une cible disparue qu'on laisse publiée finit en `setNativeProps` sur
     * une vue morte — « Trying to update non-existent view with tag N ». C'est
     * la même précaution que `FocusableRow` prend pour la mémoire de focus.
     */
    setTimeout(() => {
      if (nodeRef.current === null && screenFocusedRef.current) {
        setContentFocusNode(null);
      }
    }, 0);
  }, [setContentFocusNode]);

  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      setContentFocusNode(nodeRef.current);
      // Au blur : ne nettoyer QUE si personne d'autre n'a déjà publié son nœud
      // (sur un pop-back, le focus du nouvel écran peut précéder ce cleanup →
      // ne pas écraser sa valeur). Mise à jour fonctionnelle.
      return () => {
        screenFocusedRef.current = false;
        setContentFocusNode((prev) => (prev === nodeRef.current ? null : prev));
      };
    }, [setContentFocusNode]),
  );

  return setRef;
}
