/**
 * Le facteur qui fait tenir un objet de `naturalWidth` dans le cadre mesuré.
 *
 * Jamais au-dessus de 1 : on rétrécit ce qui déborde, on n'agrandit rien — un
 * aperçu grossi ne montrerait plus la taille réelle du texte. Partagé par les
 * aperçus qui montent un composant du lecteur plus large que leur cadre (la
 * fiche « à suivre », l'affiche de fin) : le composant ne doit pas apprendre
 * une largeur d'aperçu, on mesure le cadre et on l'y ramène par la transformée
 * la moins chère.
 */

import { useEffect, useRef, useState } from "react";

export function useFitScale(
  // L'ÉLÉMENT, pas un ref : l'effet se rejoue quand le cadre est remplacé —
  // un `.current` lu à dépendances figées ratait tout remontage.
  stage: HTMLDivElement | null,
  naturalWidth: number,
): number {
  const [scale, setScale] = useState(1);
  const naturalRef = useRef(naturalWidth);
  naturalRef.current = naturalWidth;

  useEffect(() => {
    if (!stage || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(width > 0 ? Math.min(1, width / naturalRef.current) : 1);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  return scale;
}
