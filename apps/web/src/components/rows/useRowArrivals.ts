import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { rowShift } from "@tentacle-tv/shared";

/**
 * L'ARRIVÉE d'une carte dans une rangée déjà à l'écran — un titre ajouté à la
 * bibliothèque, annoncé par le serveur pendant qu'on regarde l'accueil. On la
 * voit entrer : les cartes en place glissent d'une place (elles ne se
 * remontent plus : leurs clés sont celles des titres, `rowItemKeys`), la
 * nouvelle paraît à la place libérée, et un liseré de marque s'allume puis
 * s'éteint sur son affiche — « elle vient d'arriver ».
 *
 * Tout passe par des animations d'éléments (`transform` et `opacity`, rien
 * d'autre : aucune peinture par image), jouées UNE fois, sans état React —
 * zéro rendu en plus. Elles ne bloquent rien : un clic pendant le glissement
 * vise la carte qui est sous le pointeur, puisque l'animation part de
 * l'ancienne place vers la nouvelle.
 *
 * Rangée défilée loin de son début : rien ne bouge sous les yeux. Le
 * défilement est compensé du nombre de places gagnées, la nouvelle carte
 * attend en tête, hors champ — les flèches disent qu'il y a du neuf à gauche.
 * Mouvement réduit (réglage du système) : un simple fondu de la nouvelle.
 *
 * ⚠️ L'accroche (`scroll-snap`) est COUPÉE le temps de l'arrivée. Après un
 * changement de mise en page, Chrome ré-accroche la carte qui l'était (règle
 * de la spécification) : une insertion en tête faisait défiler la rangée
 * d'une place, et la nouvelle carte naissait hors champ, à gauche — jamais
 * vue, son affiche jamais demandée (mesuré : 390 px après deux ajouts). La
 * position d'avant se lit donc sur le dernier défilement connu, pas sur
 * l'élément, qu'une mise en page a pu déjà déplacer.
 */

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const SLIDE_MS = 380;
const ENTER_MS = 400;
const ENTER_DELAY_MS = 90;
const GLOW_MS = 1_600;
/** L'accroche revient une fois les cartes posées. */
const SNAP_BACK_MS = ENTER_DELAY_MS + ENTER_MS + 60;
/** Le liseré de `CardFrame` (`highlighted`) : la même marque, le temps d'une arrivée. */
const GLOW_CLASS = "pointer-events-none absolute inset-0 z-30 rounded-[inherit] ring-2 ring-inset ring-[rgba(var(--brand-rgb),0.85)]";

interface RowRange {
  start: number;
  end: number;
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Les cartes montées, dans l'ordre de la liste — les cales portent `aria-hidden`. */
function mountedCards(scroller: HTMLElement): HTMLElement[] {
  return [...scroller.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute("aria-hidden"));
}

/** La largeur d'une place (carte + écart), lue sur les cartes posées. */
function slotWidth(scroller: HTMLElement, cards: HTMLElement[]): number {
  if (cards.length > 1) return cards[1].offsetLeft - cards[0].offsetLeft;
  return cards[0].offsetWidth + (parseFloat(getComputedStyle(scroller).columnGap) || 0);
}

function glow(card: HTMLElement): void {
  const box = card.querySelector<HTMLElement>("[data-card-visual] > div");
  if (!box) return;
  const ring = document.createElement("div");
  ring.setAttribute("aria-hidden", "true");
  ring.className = GLOW_CLASS;
  box.appendChild(ring);
  ring
    .animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], {
      duration: GLOW_MS,
      delay: ENTER_DELAY_MS,
      easing: "ease-out",
      fill: "both",
    })
    .finished.finally(() => ring.remove())
    .catch(() => undefined);
}

export function useRowArrivals(scrollRef: RefObject<HTMLElement | null>, keys: readonly string[], range: RowRange): void {
  const previous = useRef<readonly string[] | null>(null);
  /** Le défilement d'avant le changement : l'élément, lui, a pu être ré-accroché. */
  const lastLeft = useRef(0);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => { lastLeft.current = scroller.scrollLeft; };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, [scrollRef]);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = keys;
    if (before === keys) return;
    const shift = rowShift(before, keys);
    if (shift.arrived.size === 0 && shift.moved.size === 0) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const cards = mountedCards(scroller);
    if (cards.length === 0) return;

    // Plus d'accroche jusqu'à ce que les cartes soient posées (cf. l'en-tête).
    scroller.style.scrollSnapType = "none";
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      snapTimer.current = null;
      scroller.style.scrollSnapType = "";
    }, SNAP_BACK_MS);

    const slot = slotWidth(scroller, cards);
    const was = lastLeft.current;

    // Défilée loin du début : garder la carte qu'on regardait à sa place à l'écran.
    if (before && was > slot / 2) {
      const looked = before[Math.min(before.length - 1, Math.floor(was / slot))];
      const now = keys.indexOf(looked);
      const then = before.indexOf(looked);
      const target = now >= 0 ? was + (now - then) * slot : was;
      scroller.scrollTo({ left: target, behavior: "instant" });
      return;
    }
    // Au début : y rester — c'est là que la nouvelle carte entre.
    if (scroller.scrollLeft !== 0) scroller.scrollTo({ left: 0, behavior: "instant" });

    const reduced = reducedMotion();
    cards.forEach((card, offset) => {
      const key = keys[range.start + offset];
      if (key === undefined) return;
      if (shift.arrived.has(key)) {
        card.animate(
          reduced
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [{ opacity: 0, transform: "translateY(14px) scale(0.92)" }, { opacity: 1, transform: "none" }],
          { duration: reduced ? 200 : ENTER_MS, delay: reduced ? 0 : ENTER_DELAY_MS, easing: EASE_OUT, fill: "backwards" },
        );
        if (!reduced) glow(card);
        return;
      }
      const places = shift.moved.get(key);
      if (places && !reduced) {
        card.animate([{ transform: `translateX(${places * slot}px)` }, { transform: "none" }], { duration: SLIDE_MS, easing: EASE_OUT });
      }
    });
  }, [keys, range.start, scrollRef]);
}
