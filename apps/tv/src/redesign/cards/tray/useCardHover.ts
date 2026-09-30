import { useCallback, useEffect, useRef, useState } from "react";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { trayIdOf } from "../cardFocusKeys";

/** Le fondu du plateau, à l'entrée comme à la sortie (le `--reveal-ms` du bureau). */
export const TRAY_REVEAL_MS = 200;

export interface CardHover {
  /** La carte a l'air focalisée : elle, ou un élément de son plateau, porte le focus. */
  open: boolean;
  /** Le plateau est monté : pendant `open`, et le temps de son fondu de sortie. */
  mounted: boolean;
  /** L'élément du plateau qui porte le focus (`watchlist`…) ; null : aucun. */
  trayFocus: string | null;
  /** À poser sur le `FocusTarget` de la carte. */
  onCardFocusChange: (focused: boolean) => void;
  /** À poser sur chaque élément du plateau, avec son identifiant. */
  onTrayFocusChange: (id: string, focused: boolean) => void;
}

/**
 * L'état VISUEL d'une carte à plateau — pas sa logique de focus.
 *
 * La carte et les éléments de son plateau sont des focalisables FRÈRES : tvOS
 * ne focalise jamais un élément posé dans un autre. Quand le focus descend de
 * la carte au plateau, la carte le perd ; elle doit pourtant rester ouverte —
 * agrandie, plateau visible — tant que le focus est chez elle. Ce crochet
 * réunit les deux sources : le focus natif, et le focus figé du banc (la clé
 * de la carte, ou `<carte>:tray:<élément>`).
 *
 * Le plateau reste MONTÉ le temps de son fondu de sortie : un focus en chemin
 * de la carte vers lui ne le démonte pas, et sa sortie se joue. Au repos, il
 * n'existe pas : ses boutons ne sont focalisables que carte ouverte, et rien
 * ne tourne pour eux sur les cartes qu'on ne regarde pas.
 *
 * `onFocusChange` (la rangée : voisines qui reculent, fond teinté) apprend
 * l'ouverture et la fermeture — focus du plateau compris.
 */
export function useCardHover(focusKey: string | undefined, onFocusChange?: (focused: boolean) => void): CardHover {
  const forced = useForcedFocusKey();
  const [cardNative, setCardNative] = useState(false);
  const [trayNative, setTrayNative] = useState<string | null>(null);
  const cardFocused = forced !== null ? focusKey !== undefined && forced === focusKey : cardNative;
  const trayFocus = forced !== null ? trayIdOf(forced, focusKey) : trayNative;
  const open = cardFocused || trayFocus !== null;
  const mounted = useLinger(open, TRAY_REVEAL_MS);

  // Un seul avis par changement : la rangée passe une fonction neuve à chaque rendu.
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current === open) return;
    reported.current = open;
    onFocusChange?.(open);
  }, [open, onFocusChange]);

  const onCardFocusChange = useCallback((focused: boolean) => setCardNative(focused), []);
  const onTrayFocusChange = useCallback((id: string, focused: boolean) => {
    setTrayNative((current) => (focused ? id : current === id ? null : current));
  }, []);
  return { open, mounted, trayFocus, onCardFocusChange, onTrayFocusChange };
}

/** Vrai tant que `on`, puis encore `ms` après. */
function useLinger(on: boolean, ms: number): boolean {
  const [lingering, setLingering] = useState(on);
  useEffect(() => {
    if (on) {
      setLingering(true);
      return undefined;
    }
    const timer = setTimeout(() => setLingering(false), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return on || lingering;
}
