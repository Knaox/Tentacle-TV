/**
 * Octave (mobile) — l'APPARITION des contenus (`enterMotion.test.ts`) : une liste ou une page qui arrive
 * monte de quelques points en se révélant, les premières cartes l'une après l'autre (décalage court), les
 * suivantes d'un coup — jamais une cascade qui fait attendre. Opacité et translation seulement ; le système
 * coupe tout sous mouvement réduit (`ReduceMotion.System`, la valeur des animations d'entrée de Reanimated).
 */

import { useCallback, useRef } from "react";
import { Easing, FadeInDown } from "react-native-reanimated";

/** Le décalage entre deux cartes (ms). */
export const STAGGER_MS = 35;
/** Au-delà de ce rang, une carte arrive sans attendre (elle est hors de la première vue, ou presque). */
export const STAGGER_MAX_ITEMS = 8;
/** Durée d'une apparition (ms) et hauteur de la montée (pt). */
export const ENTER_MS = 280;
export const ENTER_RISE = 10;

/** Le délai d'une carte selon son rang ; `null` : elle ne s'anime pas (rang trop loin). */
export function staggerDelay(index: number): number | null {
  if (!Number.isFinite(index) || index < 0 || index >= STAGGER_MAX_ITEMS) return null;
  return Math.round(index) * STAGGER_MS;
}

const EASE_OUT = Easing.out(Easing.cubic);

/** L'animation d'entrée d'un contenu (rang 0 par défaut) ; `undefined` au-delà du décalage. */
export function enterAnimation(index = 0) {
  const delay = staggerDelay(index);
  if (delay === null) return undefined;
  return FadeInDown.duration(ENTER_MS).delay(delay).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: ENTER_RISE }] });
}

/**
 * Pour une liste VIRTUALISÉE : une carte ne s'anime qu'à sa PREMIÈRE apparition dans cette liste montée —
 * remontée par la virtualisation (on revient en haut), elle est là, sans rejouer son entrée.
 */
export function useFirstEnter(scope = ""): (key: string, index: number) => ReturnType<typeof enterAnimation> {
  // Un nouveau `scope` (l'onglet de la bibliothèque) remet la mémoire à zéro : la grille remontée rejoue son entrée.
  const seen = useRef({ scope, keys: new Set<string>() });
  if (seen.current.scope !== scope) seen.current = { scope, keys: new Set<string>() };
  return useCallback((key: string, index: number) => {
    if (seen.current.keys.has(key)) return undefined;
    seen.current.keys.add(key);
    return enterAnimation(index);
  }, []);
}
