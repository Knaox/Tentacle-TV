import { useCallback, useRef } from "react";
import { Platform, type View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTVNav } from "../context/TVNavContext";

/**
 * Publie le focusable « d'entrée » du contenu dans TVNavContext (tvOS).
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
  const { setContentFocusNode } = useTVNav();
  const nodeRef = useRef<View | null>(null);

  const setRef = useCallback((node: View | null) => {
    nodeRef.current = node;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "ios") return;
      setContentFocusNode(nodeRef.current);
      // Au blur : ne nettoyer QUE si personne d'autre n'a déjà publié son nœud
      // (sur un pop-back, le focus du nouvel écran peut précéder ce cleanup →
      // ne pas écraser sa valeur). Mise à jour fonctionnelle.
      return () => setContentFocusNode((prev) => (prev === nodeRef.current ? null : prev));
    }, [setContentFocusNode]),
  );

  return setRef;
}
