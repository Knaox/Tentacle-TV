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
 *
 * `slack` : quand la rangée d'onglets ÉPOUSE son contenu (le groupe de verre
 * de macOS 26, `TopNav`), sa largeur ne dit plus la place disponible — elle
 * dit la place prise. S'y ajoute alors la marge libre de la case qui s'étire
 * (`slot`) autour du groupe (`hug`). Sans `slack`, le calcul d'avant.
 */

import { useLayoutEffect, useRef, useState } from "react";

const ALWAYS_SHOWN = 2;

/**
 * Des ÉLÉMENTS, pas des refs : ceux d'un parent sont attachés APRÈS les effets
 * de ses enfants — lus ici au premier calcul, ils valaient `null`, la place
 * libre comptait 0, et chaque passe retirait un onglet (mesuré : deux onglets
 * et « Plus » sur les Réglages). L'appelant les tient en état ; leur arrivée
 * relance la mesure.
 */
export interface OverflowSlack {
  /** La case qui s'étire sur toute la place de la rangée. */
  slot: HTMLElement;
  /** Le groupe qui épouse son contenu, dans `slot`. */
  hug: HTMLElement;
}

export function usePriorityOverflow(count: number, signature: string, slack?: OverflowSlack) {
  const containerRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(count);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (container === null || measure === null) return;
    const slot = slack?.slot ?? null;
    const hug = slack?.hug ?? null;
    const compute = () => {
      const free = slot && hug ? Math.max(0, slot.clientWidth - hug.offsetWidth) : 0;
      const available = container.clientWidth + free;
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
    if (slot) observer.observe(slot);
    return () => observer.disconnect();
    // `signature` : les libellés ont changé (langue, bibliothèques) — on remesure.
  }, [count, signature, slack]);

  return { containerRef, measureRef, visible };
}
