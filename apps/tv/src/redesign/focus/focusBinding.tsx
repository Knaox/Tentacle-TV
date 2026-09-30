import { createContext, useCallback, useContext, type ComponentType, type ReactNode, type Ref } from "react";
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native";

/**
 * Le PORT du focus : ce que l'intégration pose sur un élément focalisable
 * d'une vue, sans que la vue le sache. La vue ne connaît que ses clés
 * (`focusKey`, documentées dans l'en-tête de chaque vue) ; l'intégration monte
 * `FocusBindingProvider` et répond, clé par clé, par un `FocusBinding` — ou
 * par rien. Au banc, aucun fournisseur : rien n'est posé, le focus reste natif
 * (ou figé par le banc).
 *
 * Deux sortes de clés : celle d'un ÉLÉMENT (`FocusTarget`) et celle d'un
 * GROUPE (`FocusGroup` — l'habillage du lecteur, un panneau, une rangée).
 *
 * UN SEUL port pour tous les écrans : une session qui a besoin d'autre chose
 * l'ajoute ici, elle n'en écrit pas de variante.
 */

/** Ce que reçoit le conteneur d'un groupe : il le pose tel quel. */
export interface FocusGroupContainerProps {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps["pointerEvents"];
  children?: ReactNode;
}

export interface FocusBinding {
  /** La vue native de l'élément : restauration du focus, destinations d'un guide. */
  ref?: Ref<View>;
  /**
   * Les props natives de focus, posées telles quelles sur l'élément :
   * `hasTVPreferredFocus`, `nextFocusUp`…, `focusable`… La politique vit dans
   * l'intégration ; une vue ne les nomme jamais (le lint le refuse).
   */
  native?: Record<string, unknown>;
  /**
   * Ignore l'OK qui n'a pas COMMENCÉ sur cet élément — le relâchement d'un OK
   * maintenu qui vient de révéler l'habillage du lecteur : il faut un appui
   * (`onPressIn`) sur l'élément avant que la validation compte.
   */
  phantomPressGuard?: boolean;
  /** Observe le focus de la clé (restauration, rangée active…), sans le décider. */
  onFocus?: () => void;
  onBlur?: () => void;
  /**
   * Clé d'un GROUPE seulement : le conteneur natif qui enveloppe ses éléments
   * — un guide de focus qui mémorise le dernier élément (`autoFocus`), retient
   * le focus (`trapFocus*`) ou le redirige (`destinations`). Il reçoit le
   * style et les `pointerEvents` du groupe et les pose tels quels.
   *
   * STABLE, impérativement : un composant défini une fois (au niveau du
   * module). Changer d'identité remonte tout le groupe — état perdu, focus
   * perdu. Ce qui varie (un piège levé, une destination qui paraît) se lit
   * DANS le conteneur (contexte, magasin), jamais par un nouveau composant ;
   * et la clé se lie dès le premier rendu, pas en cours de route.
   */
  container?: ComponentType<FocusGroupContainerProps>;
}

/** La réponse de l'intégration pour une clé ; `undefined` : rien à poser. */
export type FocusBinder = (focusKey: string) => FocusBinding | undefined;

const BinderContext = createContext<FocusBinder | null>(null);

/**
 * Fournit le port à tout ce qu'il enveloppe. Imbriqué (un panneau dans un
 * écran), le fournisseur intérieur répond d'abord, l'extérieur ensuite.
 * `bind` doit être stable (`useCallback`) : le changer redessine chaque
 * élément focalisable enveloppé.
 */
export function FocusBindingProvider({ bind, children }: { bind: FocusBinder; children: ReactNode }) {
  const outer = useContext(BinderContext);
  const chained = useCallback<FocusBinder>((key) => bind(key) ?? outer?.(key), [bind, outer]);
  return <BinderContext.Provider value={chained}>{children}</BinderContext.Provider>;
}

/** Ce que l'intégration pose sur `focusKey` ; rien sans fournisseur ni clé. */
export function useFocusBinding(focusKey?: string): FocusBinding | undefined {
  const bind = useContext(BinderContext);
  return focusKey && bind ? bind(focusKey) : undefined;
}
