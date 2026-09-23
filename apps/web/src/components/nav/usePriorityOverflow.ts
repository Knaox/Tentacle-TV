/**
 * Combien d'onglets tiennent dans la barre — le motif « priorité + » : les
 * premiers restent visibles, les suivants passent dans « Plus », et rien ne
 * défile jamais de côté (l'ancienne barre faisait glisser ses liens derrière
 * des flèches : on ne voyait pas ce qu'on ne voyait pas).
 *
 * La mesure se fait sur une rangée FANTÔME — tous les onglets et le bouton
 * « Plus », rendus hors du flux, invisibles mais mis en page — que l'on compare
 * à la place réellement disponible, à chaque changement de l'une ou de
 * l'autre (ResizeObserver). Les deux premiers onglets (Accueil, Pour vous)
 * restent quoi qu'il arrive.
 */

import { useLayoutEffect, useRef, useState } from "react";

const ALWAYS_SHOWN = 2;

export function usePriorityOverflow(count: number, signature: string) {
  const containerRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(count);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (container === null || measure === null) return;
    const compute = () => {
      const available = container.clientWidth;
      const children = Array.from(measure.children) as HTMLElement[];
      const more = children[count];
      const gap = Number.parseFloat(getComputedStyle(measure).columnGap) || 0;
      // « Plus » est toujours là : il mène aussi aux listes et aux extensions.
      let used = more === undefined ? 0 : more.offsetWidth + gap;
      let fit = 0;
      for (let i = 0; i < count; i++) {
        const width = (children[i]?.offsetWidth ?? 0) + (i > 0 ? gap : 0);
        if (used + width > available) break;
        used += width;
        fit++;
      }
      setVisible(Math.max(Math.min(ALWAYS_SHOWN, count), fit));
    };
    compute();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
    // `signature` : les libellés ont changé (langue, bibliothèques) — on remesure.
  }, [count, signature]);

  return { containerRef, measureRef, visible };
}
