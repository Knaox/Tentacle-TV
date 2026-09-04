import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

type FocusNode = { setNativeProps?: (p: object) => void } | null;

/**
 * Retour sur l'accueil (depuis le lecteur, le détail, etc.) : restaurer le
 * focus sur le DERNIER élément de carrousel focalisé — sinon l'autoFocus
 * repart sur la 1re carte (tvOS) ou le moteur natif donne le focus à la
 * sidebar (Android). Sur 1er mount, lastContentNodeRef est null → autoFocus.
 *
 * Le nœud est relu AU MOMENT DE POSER LE FOCUS, jamais capturé à l'armement.
 * Entre les deux, il s'écoule soixante millisecondes pendant lesquelles
 * l'accueil invalide « Reprendre », « Prochains épisodes » et « Ma liste » :
 * la liste peut recycler la cellule que la mémoire de focus désigne. Celle-ci
 * s'efface alors elle-même (`FocusableRow`), et relire ici suffit à ne rien
 * envoyer à une vue détruite — ce qui levait « Trying to update non-existent
 * view with tag N ». Extrait de `HomeScreen` (règle des 300 lignes).
 */
export function useHomeFocusRestore(lastContentNodeRef: { readonly current: unknown }): void {
  useFocusEffect(
    useCallback(() => {
      const target = (): FocusNode => lastContentNodeRef.current as FocusNode;
      if (!target()?.setNativeProps) return;
      if (Platform.OS === "ios") {
        // tvOS : hasTVPreferredFocus n'est honoré que sur un cycle false→true.
        let id2: ReturnType<typeof setTimeout>;
        const id1 = setTimeout(() => {
          target()?.setNativeProps?.({ hasTVPreferredFocus: false });
          id2 = setTimeout(() => target()?.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
        }, 60);
        return () => { clearTimeout(id1); clearTimeout(id2); };
      }
      // Android : le set vaut requestFocus() immédiat (one-shot).
      const id = setTimeout(() => target()?.setNativeProps?.({ hasTVPreferredFocus: true }), 60);
      return () => clearTimeout(id);
    }, [lastContentNodeRef])
  );
}
