import { createContext, useCallback, useContext, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from "react";
import type { View } from "react-native";

/**
 * État partagé du rail de navigation persistant (monté une seule fois par
 * TVNavChrome). Permet à un écran (ex. BACK sur l'accueil) de redonner le focus
 * au rail sans que celui-ci soit remonté à chaque navigation.
 */
interface TVNavState {
  /** Incrémenté à chaque demande de focus rail — le rail réagit via un effet. */
  railFocusSignal: number;
  /** À appeler pour focaliser l'item actif du rail (pattern tvOS/Netflix). */
  requestRailFocus: () => void;
  /**
   * Nœud natif de l'item actif du rail, publié par TVSideRail. Sur Apple TV le
   * rail est un overlay sibling du navigateur → le focus engine tvOS (cloisonné
   * par view controller) ne l'atteint pas au D-pad. `TVFocusBridgeLeft` l'utilise
   * comme `destinations` d'un TVFocusGuideView pour rediriger LEFT vers le rail.
   * (Inutilisé sur Android, dont le focus engine est global.)
   */
  railActiveNode: View | null;
  setRailActiveNode: (node: View | null) => void;
  /**
   * `true` quand le focus est DANS le rail. Sert à désactiver le pont de focus
   * (TVFocusBridgeLeft) une fois entré : sinon la bande de pont, qui chevauche
   * les items, recapte tout déplacement haut/bas/droite et le redirige vers
   * l'item actif → on reste piégé. Le pont ne doit agir QUE depuis le contenu.
   */
  railFocused: boolean;
  setRailFocused: (v: boolean) => void;
  /**
   * Nœud du focusable « d'entrée » du contenu (ex. bouton Lecture du hero),
   * publié par l'écran. Sur Apple TV, le pont DROIT (TVFocusBridgeRight) l'utilise
   * comme destination pour SORTIR du rail : sur l'Accueil les focusables du contenu
   * sont sous le rail déployé (occlusion) → RIGHT géométrique ne les atteint pas.
   */
  contentFocusNode: View | null;
  setContentFocusNode: Dispatch<SetStateAction<View | null>>;
  /**
   * DERNIER focusable de contenu réellement focalisé (carte de carrousel, etc.),
   * mémorisé dans un REF (pas de state → pas de re-render à chaque focus de carte).
   * Sert à RESTAURER le focus là où on était : sortie de sidebar (TVFocusBridgeRight)
   * et retour depuis le lecteur. Réinitialisé à null au changement d'écran.
   */
  lastContentNodeRef: MutableRefObject<View | null>;
}

const TVNavContext = createContext<TVNavState>({
  railFocusSignal: 0,
  requestRailFocus: () => {},
  railActiveNode: null,
  setRailActiveNode: () => {},
  railFocused: false,
  setRailFocused: () => {},
  contentFocusNode: null,
  setContentFocusNode: () => {},
  lastContentNodeRef: { current: null },
});

export function TVNavProvider({ children }: { children: ReactNode }) {
  const [railFocusSignal, setSignal] = useState(0);
  const requestRailFocus = useCallback(() => setSignal((s) => s + 1), []);
  const [railActiveNode, setRailActiveNode] = useState<View | null>(null);
  const [railFocused, setRailFocused] = useState(false);
  const [contentFocusNode, setContentFocusNode] = useState<View | null>(null);
  const lastContentNodeRef = useRef<View | null>(null);
  const value = useMemo(
    () => ({
      railFocusSignal, requestRailFocus,
      railActiveNode, setRailActiveNode,
      railFocused, setRailFocused,
      contentFocusNode, setContentFocusNode,
      lastContentNodeRef,
    }),
    [railFocusSignal, requestRailFocus, railActiveNode, railFocused, contentFocusNode],
  );
  return <TVNavContext.Provider value={value}>{children}</TVNavContext.Provider>;
}

export function useTVNav() {
  return useContext(TVNavContext);
}
