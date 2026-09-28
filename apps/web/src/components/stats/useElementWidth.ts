import { useEffect, useState } from "react";

/**
 * La largeur rendue d'un élément, suivie par `ResizeObserver` : un graphique
 * SVG se dessine en pixels réels (texte net, traits d'un pixel), pas dans une
 * `viewBox` étirée qui déformerait les libellés.
 *
 * Une référence-fonction plutôt qu'un objet : l'élément peut n'apparaître
 * qu'au second rendu (état vide, puis données), et l'observation doit suivre.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === next ? prev : next));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return { ref: setNode, width };
}
