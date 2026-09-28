import { useCallback, useState, type FocusEvent, type RefObject } from "react";
import { useHoverGuard } from "../../hooks/useHoverGuard";

/**
 * Le survol d'une carte FOCALISABLE : la souris, ou le clavier.
 *
 * Une carte atteinte à la tabulation doit offrir ce que la souris trouve en
 * la survolant — Lecture, étoiles, plateau —, sans quoi ces actions n'existent
 * qu'à la souris. Le survol tient donc tant que le pointeur est dessus OU que
 * le focus clavier est dedans (la carte, ou l'un des boutons de son plateau).
 *
 * `:focus-visible` seulement : un clic pose aussi le focus sur la carte, et
 * le survol resterait alors allumé après le départ de la souris.
 */
export function useCardHover(rootRef: RefObject<HTMLElement | null>) {
  const [pointer, setPointer] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  // La rangée ou la grille défile sous un curseur immobile (cf. `useHoverGuard`).
  const unhover = useCallback(() => setPointer(false), []);
  useHoverGuard(rootRef, pointer, unhover);

  const onFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    if (e.target.matches(":focus-visible")) setKeyboard(true);
  }, []);
  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboard(false);
  }, []);
  const onMouseEnter = useCallback(() => setPointer(true), []);
  const onMouseLeave = useCallback(() => setPointer(false), []);

  return { hovered: pointer || keyboard, handlers: { onMouseEnter, onMouseLeave, onFocus, onBlur } };
}
