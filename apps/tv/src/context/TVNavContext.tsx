import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { View } from "react-native";

/**
 * L'état partagé du rail de navigation, monté une seule fois par `TVNavChrome`.
 *
 * # Pourquoi CINQ contextes et non un
 *
 * Un contexte re-rend TOUS ses consommateurs dès que sa valeur change, qu'ils
 * lisent la partie qui a bougé ou non. Réunies dans un seul objet, ces cinq
 * valeurs faisaient donc payer à chacun les changements des quatre autres — et
 * les consommateurs les plus coûteux ne lisent que du STABLE :
 *
 *   • `FocusableRow` → chaque CELLULE montée, pour une simple référence ;
 *   • `HomeScreen` → l'écran entier, pour un poseur et une référence ;
 *   • `useTVContentEntry` → pour un poseur.
 *
 * Entrer dans le rail, en sortir, le replier : chacun de ces gestes appelle
 * `setRailFocused` et re-rendait l'accueil et toutes ses cellules, pour une
 * valeur qu'aucun d'eux ne lit. Mesuré au logcat sur trois allers-retours dans
 * le rail : 249 rendus de cellule.
 *
 * Séparés, les poseurs et les références gardent une identité figée pour la vie
 * de l'écran, et ce qui bouge ne réveille que qui le regarde. C'est le motif
 * appliqué à `AmbientFocusContext`, et la même mesure le justifie.
 */

/** Ce qui NE CHANGE JAMAIS : poseurs et références. */
interface NavActions {
  /** Focalise l'item actif du rail (pattern tvOS/Netflix). */
  requestRailFocus: () => void;
  setRailActiveNode: (node: View | null) => void;
  setRailFocused: (v: boolean) => void;
  setContentFocusNode: Dispatch<SetStateAction<View | null>>;
  /**
   * DERNIER focusable de contenu réellement focalisé (carte de carrousel, etc.),
   * mémorisé dans un REF — pas d'état, donc pas de re-rendu à chaque focus de
   * carte. Sert à RESTAURER le focus là où on était : sortie de sidebar
   * (`TVFocusBridgeRight`) et retour depuis le lecteur.
   *
   * ⚠️ La cellule qui l'écrit l'EFFACE en se démontant (`FocusableRow`) : sans
   * cela il survit à la vue qu'il nomme, et le rendre au focus lève
   * « Trying to update non-existent view ».
   */
  lastContentNodeRef: MutableRefObject<View | null>;
}

const EMPTY_REF: MutableRefObject<View | null> = { current: null };

const ActionsContext = createContext<NavActions>({
  requestRailFocus: () => {},
  setRailActiveNode: () => {},
  setRailFocused: () => {},
  setContentFocusNode: () => {},
  lastContentNodeRef: EMPTY_REF,
});

/** Incrémenté à chaque demande de focus rail — le rail réagit via un effet. */
const SignalContext = createContext(0);

/**
 * Nœud natif de l'item actif du rail, publié par `TVSideRail`. Sur Apple TV le
 * rail est un overlay frère du navigateur → le moteur de focus tvOS, cloisonné
 * par contrôleur de vue, ne l'atteint pas au D-pad. `TVFocusBridgeLeft` l'utilise
 * comme `destinations` d'un `TVFocusGuideView` pour rediriger GAUCHE vers le
 * rail. (Inutilisé sur Android, dont le moteur de focus est global.)
 */
const RailNodeContext = createContext<View | null>(null);

/**
 * `true` quand le focus est DANS le rail. Sert à désactiver le pont de focus
 * (`TVFocusBridgeLeft`) une fois entré : sinon la bande de pont, qui chevauche
 * les items, recapte tout déplacement et le redirige vers l'item actif — on
 * reste piégé. Le pont ne doit agir QUE depuis le contenu.
 */
const RailFocusedContext = createContext(false);

/**
 * Nœud du focusable « d'entrée » du contenu (ex. bouton Lecture du héros),
 * publié par l'écran. Sur Apple TV, le pont DROIT (`TVFocusBridgeRight`) l'utilise
 * comme destination pour SORTIR du rail : sur l'accueil, les focusables du contenu
 * sont sous le rail déployé (occlusion) → un DROITE géométrique ne les atteint pas.
 */
const ContentNodeContext = createContext<View | null>(null);

export function TVNavProvider({ children }: { children: ReactNode }) {
  const [railFocusSignal, setSignal] = useState(0);
  const [railActiveNode, setRailActiveNode] = useState<View | null>(null);
  const [railFocused, setRailFocused] = useState(false);
  const [contentFocusNode, setContentFocusNode] = useState<View | null>(null);
  const lastContentNodeRef = useRef<View | null>(null);

  const requestRailFocus = useCallback(() => setSignal((s) => s + 1), []);

  // Les poseurs d'état de React sont déjà stables ; cet objet doit l'être
  // autant, sans quoi la séparation ne servirait à rien. Aucune dépendance :
  // il est construit une fois pour la vie du fournisseur.
  const actions = useMemo<NavActions>(
    () => ({
      requestRailFocus,
      setRailActiveNode,
      setRailFocused,
      setContentFocusNode,
      lastContentNodeRef,
    }),
    [requestRailFocus],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <SignalContext.Provider value={railFocusSignal}>
        <RailNodeContext.Provider value={railActiveNode}>
          <RailFocusedContext.Provider value={railFocused}>
            <ContentNodeContext.Provider value={contentFocusNode}>
              {children}
            </ContentNodeContext.Provider>
          </RailFocusedContext.Provider>
        </RailNodeContext.Provider>
      </SignalContext.Provider>
    </ActionsContext.Provider>
  );
}

/**
 * Les poseurs et les références — c'est CE hook que doivent appeler les
 * composants nombreux ou coûteux. Il ne re-rend jamais.
 */
export function useTVNavActions(): NavActions {
  return useContext(ActionsContext);
}

/** Les valeurs qui bougent. S'y abonner, c'est se re-rendre avec elles :
 *  n'appeler que celle dont on dessine vraiment quelque chose. */
export const useRailFocusSignal = (): number => useContext(SignalContext);
export const useRailActiveNode = (): View | null => useContext(RailNodeContext);
export const useRailFocused = (): boolean => useContext(RailFocusedContext);
export const useContentFocusNode = (): View | null => useContext(ContentNodeContext);
