import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const scrollPositions = new Map<string, number>();

/**
 * Pages qui s'ouvrent TOUJOURS en haut, quelle que soit la position mémorisée.
 *
 * La mémoire de défilement a du sens sur une surface qu'on PARCOURT en largeur —
 * une bibliothèque, les favoris : on y revient pour reprendre là où on butinait,
 * et retomber en haut fait perdre le fil. Elle n'en a aucun sur une FICHE : on y
 * arrive pour un titre précis, et toute la page est construite autour de sa
 * bannière et de son affiche. Y revenir à mi-hauteur, sur la liste d'épisodes,
 * oblige à remonter pour comprendre où l'on est — d'autant plus déroutant que
 * l'ouverture est désormais animée depuis le visuel cliqué : l'animation se
 * jouait hors écran, au-dessus de la position restaurée.
 *
 * L'ACCUEIL en fait désormais partie. Ce n'est pas une surface de parcours mais
 * la page d'où l'on part : sa bannière et « Reprendre la lecture » sont tout en
 * haut, et c'est ce qu'on vient y chercher. Y revenir au milieu des rangées, sous
 * une bannière qui tourne hors écran, donne l'impression d'avoir raté la page.
 */
const ALWAYS_TOP = [/^\/$/, /^\/media\//, /^\/shared\//];

const opensAtTop = (pathname: string): boolean =>
  ALWAYS_TOP.some((pattern) => pattern.test(pathname));

export function useScrollMemory() {
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);

  useEffect(() => {
    // Save scroll position of previous route
    if (prevPath.current !== pathname) {
      scrollPositions.set(prevPath.current, window.scrollY);
      prevPath.current = pathname;
    }

    // Restore scroll position for current route
    const saved = opensAtTop(pathname) ? undefined : scrollPositions.get(pathname);
    if (saved != null) {
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
}
