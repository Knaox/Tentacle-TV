import { useCallback, useEffect, useRef, useState } from "react";
import { useForcedFocusKey } from "../focus/focusPreview";

export interface CardFocused {
  /** La carte a le focus — natif, ou figé par le banc. */
  focused: boolean;
  /** À poser sur le `FocusTarget` de la carte. */
  onTargetFocusChange: (focused: boolean) => void;
}

/**
 * L'état VISUEL du focus d'une carte — pas sa logique de focus.
 *
 * Sur tvOS, un focalisable RECOUVERT par ce qui dessine n'est plus proposé par
 * la recherche géométrique : la cible de la carte est un `FocusTarget` sans
 * rendu, posé AU-DESSUS de son image. Ce que la carte dessine (l'agrandissement,
 * la légende, l'indication de l'appui maintenu) lit donc le focus ici, qui
 * réunit le focus natif de la cible et le focus figé du banc.
 *
 * `onFocusChange` (la rangée : voisines qui reculent, fond teinté) l'apprend
 * une fois par changement — focus figé compris.
 */
export function useCardFocused(focusKey: string | undefined, onFocusChange?: (focused: boolean) => void): CardFocused {
  const forced = useForcedFocusKey();
  const [native, setNative] = useState(false);
  const focused = forced !== null ? focusKey !== undefined && forced === focusKey : native;

  // Un seul avis par changement : la rangée passe une fonction neuve à chaque rendu.
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current === focused) return;
    reported.current = focused;
    onFocusChange?.(focused);
  }, [focused, onFocusChange]);

  const onTargetFocusChange = useCallback((next: boolean) => setNative(next), []);
  return { focused, onTargetFocusChange };
}
