import { useState, useCallback, useRef, useEffect } from "react";

export interface RowScrollState {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollByAmount: (direction: "left" | "right") => void;
  onScroll: () => void;
}

const SCROLL_AMOUNT_PX = 600;

/**
 * Les flèches d'une rangée : ce qu'il reste à défiler de chaque côté.
 *
 * La piste se REMESURE quand sa taille change (ResizeObserver) ET quand ses
 * enfants changent (MutationObserver) : une rangée se monte avec sa cale de
 * hauteur réservée, SANS ses cartes (`useRowTrackReserve`, la fenêtre de
 * `useRowWindow`) — leur arrivée ne change pas la boîte de la piste quand la
 * cale avait déjà leur hauteur, et la mesure du montage (« rien à défiler »)
 * restait : plus de flèche jusqu'au premier défilement. Une mesure par image
 * au plus (elle lit `scrollWidth`, donc la mise en page).
 */
export function useRowScroll(): RowScrollState {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  const scrollByAmount = useCallback(
    (direction: "left" | "right") => {
      const el = scrollRef.current;
      if (!el) return;
      const amount = Math.min(SCROLL_AMOUNT_PX, Math.floor(el.clientWidth * 0.85));
      el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
      setTimeout(update, 360);
    },
    [update],
  );

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    // Les cartes montées, la fenêtre déplacée : les ENFANTS directs de la piste.
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [update]);

  return { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll: update };
}
