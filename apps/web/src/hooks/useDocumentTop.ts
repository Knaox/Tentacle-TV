import { useEffect, useState, type RefObject } from "react";

/**
 * La distance entre le haut du DOCUMENT et l'élément — le `scrollMargin` qu'un
 * `useWindowVirtualizer` attend.
 *
 * Pas `offsetTop` : il compte depuis le premier ancêtre POSITIONNÉ. Les
 * grilles de Ma liste et de Mes favoris vivent dans un conteneur `relative`
 * posé sous la bannière ; `offsetTop` y ignorait toute la hauteur de celle-ci,
 * et la fenêtre de rendu du virtualiseur glissait d'autant. L'overscan le
 * masquait tant qu'une rangée faisait 300 px ; plus du tout quand des sections
 * repliées ne laissent que des en-têtes de 64 px.
 *
 * `deps` : tout ce qui peut déplacer l'élément (hauteur de l'en-tête, largeur
 * qui replie une barre). Une CHAÎNE ou des nombres, jamais un tableau reçu en
 * prop : un tableau de dépendances doit garder sa taille d'un rendu à l'autre.
 */
export function useDocumentTop(ref: RefObject<HTMLElement | null>, ...deps: (string | number)[]): number {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (el) setTop(Math.round(el.getBoundingClientRect().top + window.scrollY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);
  return top;
}
