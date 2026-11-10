import { useEffect, useRef, useState } from "react";

/** Le fondu de sortie de l'habillage (`.pl-chrome`, `playerChrome.css`) — les deux se suivent. */
export const CHROME_EXIT_MS = 200;

/**
 * L'habillage du lecteur n'est dans le DOM que lorsqu'il se voit.
 *
 * Masqué par `opacity: 0`, il restait monté : sa barre, ses boutons et son curseur de volume
 * étaient rendus à chaque battement de l'horloge du lecteur, sous une image qui change vingt-quatre
 * à soixante fois par seconde — pour rien (CLAUDE.md, « ce qui n'est pas affiché ne doit rien
 * consommer »). Même recette que `useHoverMount`, pilotée par la visibilité au lieu du survol :
 *
 *  - `mounted` — la présence dans le DOM, qui SURVIT à la sortie le temps du fondu ;
 *  - `shown` — la cible du fondu (`data-shown`), posée dès le rendu de `visible`.
 *
 * L'entrée part de `@starting-style` (un élément qu'on monte n'a pas d'état précédent).
 * L'état que l'habillage doit garder d'une apparition à l'autre (panneau ouvert, vitesse de
 * lecture) vit donc AU-DESSUS de ce qui est démonté — jamais dans un bouton.
 */
export function useChromePresence(visible: boolean, exitMs: number = CHROME_EXIT_MS): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(visible);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (visible) {
      setMounted(true);
      return undefined;
    }
    timer.current = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer.current);
  }, [visible, exitMs]);

  // `visible` vrai au rendu même où l'effet n'a pas encore tourné : monté sans attendre.
  return { mounted: mounted || visible, shown: visible };
}
