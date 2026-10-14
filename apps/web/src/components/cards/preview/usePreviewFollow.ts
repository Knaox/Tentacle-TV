import { useLayoutEffect, useRef, type RefObject } from "react";
import { setHoverCompanion } from "../../../hooks/hoverCompanion";
import { followOutOfPlace, horizontalWheelDelta } from "./previewFollow";
import type { PreviewCloseCause } from "./previewLifecycle";
import type { PreviewPlacement } from "./previewPlacement";

interface PreviewFollowInput {
  /** Vue : l'accroche commence à la révélation. */
  shown: boolean;
  /** Montée — vue, ou dans sa sortie : l'accroche dure jusqu'au démontage. */
  mounted: boolean;
  /** Sa place, en coordonnées du DOCUMENT. */
  placement: PreviewPlacement | null;
  anchorRef: RefObject<HTMLElement | null>;
  portalRef: RefObject<HTMLElement | null>;
  close: (cause: PreviewCloseCause) => void;
}

/** Ce que l'accroche retient à la révélation. */
interface FollowContext {
  placement: PreviewPlacement;
  /** La rangée qui défile à l'horizontale, s'il y en a une. */
  scroller: HTMLElement | null;
  /** Son défilement à la révélation. */
  x0: number;
  /** Ce qu'on en voit (fenêtre) : sa boîte ne bouge pas avec son contenu. */
  view: { left: number; right: number } | null;
  /** La carte (fenêtre, axe horizontal), à la révélation. */
  card: { left: number; right: number };
  safeTop: number;
  /** Ce que la mini-carte a suivi de la rangée (px). */
  dx: number;
  /** Le défilement de la page à la dernière image vue. */
  lastY: number;
}

/** Posé sur la rangée qu'on mène à la molette : elle ne s'accroche plus (`previewRoom.css`). */
const LEADING = "data-preview-follow";

/** Le bas de la barre de navigation fixe, 0 sans barre. */
export function navBottom(): number {
  return document.querySelector("[data-top-nav]")?.getBoundingClientRect().bottom ?? 0;
}

function followContext(anchor: HTMLElement, placement: PreviewPlacement): FollowContext {
  const room = anchor.closest<HTMLElement>("[data-preview-room]");
  const scroller = room && room.scrollWidth > room.clientWidth + 1 ? room : null;
  const card = anchor.getBoundingClientRect();
  const box = scroller?.getBoundingClientRect();
  return {
    placement,
    scroller,
    x0: scroller?.scrollLeft ?? 0,
    view: box ? { left: Math.max(0, box.left), right: Math.min(window.innerWidth, box.right) } : null,
    card: { left: card.left, right: card.right },
    safeTop: navBottom(),
    dx: 0,
    lastY: window.scrollY,
  };
}

/**
 * La mini-carte ACCROCHÉE à sa carte pendant le défilement (règles :
 * `previewFollow.ts`). La page : rien à faire, elle est posée dans le
 * document. Une rangée : un `translate`, et la molette horizontale prise en
 * main sur la rangée comme sur la mini-carte. Un défilement qu'on ne sait pas
 * suivre (un conteneur inconnu) la ferme net.
 *
 * Le pointeur posé sur elle n'a pas quitté sa carte : inscrite comme
 * compagnon du survol (`hoverCompanion`), le garde de défilement des cartes et
 * des rangées le sait.
 *
 * Aucun écouteur pendant le préchargement caché, aucun au repos : ils naissent
 * à la révélation et meurent au démontage.
 */
export function usePreviewFollow({ shown, mounted, placement, anchorRef, portalRef, close }: PreviewFollowInput): void {
  const ctxRef = useRef<FollowContext | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const portal = portalRef.current;
    if (!mounted || !placement || !anchor || !portal) {
      ctxRef.current = null;
      return;
    }
    // Révélée sur une place neuve : l'accroche repart de zéro.
    if (shown && ctxRef.current?.placement !== placement) {
      ctxRef.current = followContext(anchor, placement);
      portal.style.removeProperty("translate");
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const release = setHoverCompanion(anchor, portal);
    const check = () => {
      const step = window.scrollY - ctx.lastY;
      ctx.lastY = window.scrollY;
      const { width, height } = ctx.placement;
      const box = { left: ctx.placement.left - window.scrollX + ctx.dx, top: ctx.placement.top - window.scrollY, width, height };
      const card = { left: ctx.card.left + ctx.dx, right: ctx.card.right + ctx.dx };
      const viewport = { width: window.innerWidth, height: window.innerHeight, safeTop: ctx.safeTop };
      if (followOutOfPlace({ box, card, view: ctx.view, viewport, step })) close("out-of-view");
    };
    const followRow = () => {
      if (!ctx.scroller) return;
      ctx.dx = ctx.x0 - ctx.scroller.scrollLeft;
      if (ctx.dx === 0) portal.style.removeProperty("translate");
      else portal.style.translate = `${ctx.dx}px 0`;
    };
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target === document) check();
      else if (target === ctx.scroller) {
        followRow();
        check();
      } else if (target instanceof Node && target.contains(anchor)) close("out-of-view");
    };
    // La molette horizontale MÈNE la rangée : elle et la mini-carte bougent
    // dans la même image. Le geste latché ailleurs (vertical d'abord) n'est
    // plus annulable : on le laisse au navigateur.
    const onWheel = (e: WheelEvent) => {
      const scroller = ctx.scroller;
      if (!scroller || !e.cancelable) return;
      const dx = horizontalWheelDelta(e, scroller.clientWidth);
      if (dx === null) return;
      e.preventDefault();
      scroller.setAttribute(LEADING, "");
      scroller.scrollLeft += dx;
      followRow();
      check();
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    const leads = shown && ctx.scroller ? [ctx.scroller, portal] : [];
    for (const el of leads) el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      release();
      window.removeEventListener("scroll", onScroll, true);
      for (const el of leads) el.removeEventListener("wheel", onWheel);
      // La rangée menée retrouve son accroche (la molette la reprendra au besoin).
      ctx.scroller?.removeAttribute(LEADING);
    };
  }, [shown, mounted, placement, anchorRef, portalRef, close]);
}
