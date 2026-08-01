import { useCallback, useEffect, useRef, useState } from "react";
import { rowWindow, type RowWindowRange } from "./rowWindow";

/**
 * Mesures et cadence du fenêtrage d'une rangée. L'arithmétique, elle, vit dans
 * `rowWindow` — pur et testé.
 *
 * # Ce que ça économise, et ce que `content-visibility` n'économisait pas
 *
 * `.render-row` saute la mise en page, la peinture et le compositing d'une
 * rangée hors écran. Il ne libère RIEN de ce qui coûte de la mémoire, et les
 * postes sont, dans l'ordre :
 *
 *  • les bitmaps DÉCODÉS. Une affiche demandée en `height: 450` fait 540 Ko une
 *    fois décodée, une vignette 16:9 en `width: 720` en fait 1,17 Mo. Les `<img>`
 *    restant montées à vie, l'accueil grimpait vers ~90 Mo au fil du parcours
 *    sans jamais redescendre ;
 *  • un `IntersectionObserver` ET un écouteur `visibilitychange` par carte
 *    (`CardImage` → `useInViewport`), soit une centaine de chaque ;
 *  • les abonnements TanStack de chaque carte, que la moindre invalidation fait
 *    tous re-rendre ;
 *  • les nœuds DOM et les fibres React — le poste le moins grave, contrairement
 *    à l'intuition.
 *
 * # Pourquoi la rangée n'est PAS démontée quand elle sort de l'écran
 *
 * Démonter la `<section>` détruirait le scroller, et avec lui le `scrollLeft`
 * que le navigateur conserve gratuitement : défiler une rangée, descendre,
 * remonter, et elle serait revenue à zéro. `useRowCardWidth` devrait en outre
 * remesurer, et la transition d'entrée de la section rejouerait.
 *
 * La rangée reste donc en place et c'est sa FENÊTRE qui se vide : une seule cale
 * de la largeur totale, zéro carte. L'élément survit, `scrollWidth` ne bouge
 * pas, `scrollLeft` est préservé, et tout ce qui coûte de la mémoire est libéré
 * d'un coup.
 */

/**
 * Cartes rendues de part et d'autre de la zone visible.
 *
 * Trois : un clic de flèche défile de `min(600, 0,85 × largeur)` px, soit moins
 * de trois cartes ; une carte hors du champ HORIZONTAL n'est jamais demandée par
 * `loading="lazy"`, donc trois cartes d'avance valent environ un écran de
 * préchargement ; et pendant une inertie, l'accroche au défilement se résout sur
 * la position prédite, qui doit déjà exister.
 */
const OVERSCAN = 3;

/**
 * Sursis avant de vider une rangée sortie de l'écran.
 *
 * Un défilement rapide traverse une dizaine de rangées : les vider puis les
 * remplir au passage coûterait plus que ce que cela économise. Même patron que
 * `useHoverMount`, pour la même raison.
 */
const VACATE_GRACE_MS = 600;

interface RowWindowOptions {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  count: number;
  /** `null` quand la largeur n'est pas connue en JS (mobile) : tout est rendu. */
  cardWidth: number | null;
  /** La rangée est-elle dans (ou près de) l'écran ? */
  onScreen: boolean;
}

/** Plage « tout rendre », quand le fenêtrage ne s'applique pas. */
const toutRendre = (count: number): RowWindowRange => ({
  start: 0,
  end: count - 1,
  padStart: 0,
  padEnd: 0,
});

export function useRowWindow({ scrollRef, count, cardWidth, onScreen }: RowWindowOptions) {
  const [range, setRange] = useState<RowWindowRange>(() => toutRendre(count));
  /**
   * Index de la carte survolée. Un REF, jamais un état : il n'est lu que dans le
   * rappel qui recalcule la plage, donc le poser ne doit pas provoquer de rendu.
   * En régime établi la carte survolée est de toute façon dans la fenêtre
   * visible, et l'épingle ne change alors rien — survoler une carte coûte zéro
   * rendu à la rangée.
   */
  const pinned = useRef<number | null>(null);
  /** Gouttière et gouttière inter-cartes, mesurées puis mémorisées. */
  const metrics = useRef({ paddingLeft: 0, gap: 0 });
  const frame = useRef(0);
  const vacant = useRef(false);

  const compute = useCallback(() => {
    const el = scrollRef.current;
    if (!el || cardWidth == null) {
      setRange(toutRendre(count));
      return;
    }
    const next = rowWindow({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      paddingLeft: metrics.current.paddingLeft,
      gap: metrics.current.gap,
      cardWidth,
      count,
      overscan: OVERSCAN,
      pinned: pinned.current,
      vacant: vacant.current,
    });
    // Comparaison avant écriture : une image de défilement qui ne change pas la
    // fenêtre ne doit pas coûter un rendu de la rangée. Les DEUX cales sont
    // comparées, pas seulement la plage : à fenêtre égale, un redimensionnement
    // change la largeur de carte, donc celle des cales.
    setRange((prev) =>
      prev.start === next.start && prev.end === next.end
        && prev.padStart === next.padStart && prev.padEnd === next.padEnd
        ? prev
        : next,
    );
  }, [scrollRef, cardWidth, count]);

  /** Une seule lecture du DOM par image, quoi qu'il arrive. */
  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(compute);
  }, [compute]);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    metrics.current = {
      paddingLeft: parseFloat(cs.paddingLeft) || 0,
      gap: parseFloat(cs.columnGap) || 0,
    };
    schedule();
  }, [scrollRef, schedule]);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [measure, scrollRef]);

  // La porte de rangée. Le sursis ne joue QUE dans le sens de la fermeture :
  // revenir à l'écran doit remplir tout de suite.
  useEffect(() => {
    if (onScreen) {
      vacant.current = false;
      schedule();
      return;
    }
    const id = setTimeout(() => {
      vacant.current = true;
      schedule();
    }, VACATE_GRACE_MS);
    return () => clearTimeout(id);
  }, [onScreen, schedule]);

  const setHoveredIndex = useCallback(
    (index: number | null) => {
      pinned.current = index;
    },
    [],
  );

  return { range, onScroll: schedule, setHoveredIndex };
}
