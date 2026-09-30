import { createContext, useCallback, useContext, type ReactNode, type Ref } from "react";
import type { View } from "react-native";

/**
 * Le PORT du focus : ce que l'intégration pose sur un élément focalisable
 * d'une vue, sans que la vue le sache. La vue ne connaît que ses clés
 * (`focusKey`, documentées dans l'en-tête de chaque vue) ; l'intégration monte
 * `FocusBindingProvider` et répond, clé par clé, par un `FocusBinding` — ou
 * par rien. Au banc, aucun fournisseur : rien n'est posé, le focus reste natif
 * (ou figé par le banc).
 *
 * UN SEUL port pour tous les écrans : une session qui a besoin d'autre chose
 * l'ajoute ici, elle n'en écrit pas de variante.
 */

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
