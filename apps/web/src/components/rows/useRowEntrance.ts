import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  CARD_ENTER_MS, CARD_FROM, ENTRANCE_EASE, ENTRANCE_GIVE_UP_MS, ENTRANCE_HOLD_MAX_MS, ENTRANCE_VISIBLE_RATIO,
  HEADER_ENTER_MS, HEADER_FROM, cardEntranceDelays, createEntranceClock, entranceKeyframes,
} from "./rowEntrance";

/**
 * Joue l'entrée d'une rangée (cf. `rowEntrance`) UNE fois dans sa vie : une
 * rangée remontée au défilement, ou dont la fenêtre de cartes se remplit à
 * nouveau, ne bouge plus.
 *
 * Tout passe par des animations d'éléments, sans état React — zéro rendu en
 * plus, comme `useRowArrivals`. Elles ne retiennent RIEN une fois finies :
 * remplissage `backwards` seulement, l'effet disparaît à la dernière image et
 * la carte retrouve ses propres styles (survol, pièce de l'aperçu).
 *
 * La retenue avant l'entrée est un attribut posé sur la section DÈS son
 * montage (`[data-row-entrance="held"]`, theme/rowEntrance.css) : il cache le
 * titre et les cartes à la première image, sans attendre un effet. L'attribut
 * n'est pas une prop : React ne le connaît pas, aucun rendu ne le réécrit.
 *
 * Rien ne bouge la mise en page : opacité et transformation, et la section
 * garde sa place pendant la retenue — la barre de défilement ne le voit pas.
 *
 * Mouvement réduit (réglage du système) : ni retenue ni animation.
 */

const HELD = "held";
const ATTR = "data-row-entrance";

/** Une horloge pour toute l'application : les lots se forment entre rangées. */
const clock = createEntranceClock();

function reducedMotion(): boolean {
  return typeof window !== "undefined"
    && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/** Les cartes montées — les cales portent `aria-hidden`. */
function mountedCards(scroller: HTMLElement): HTMLElement[] {
  return [...scroller.children].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute("aria-hidden"),
  );
}

/**
 * Les cartes de la première vue : celles qui chevauchent la largeur visible
 * de la piste. Des rectangles, pas `offsetLeft` : celui-ci se lit depuis le
 * parent positionné, et une piste déjà défilée (la saga, ouverte sur le film
 * courant) fausserait le compte.
 */
function cardsInView(scroller: HTMLElement): HTMLElement[] {
  const track = scroller.getBoundingClientRect();
  return mountedCards(scroller).filter((card) => {
    const r = card.getBoundingClientRect();
    return r.left < track.right && r.right > track.left;
  });
}

function play(section: HTMLElement, scroller: HTMLElement): void {
  const animate = typeof section.animate === "function";
  if (animate) {
    const base = clock.slot(performance.now());
    const header = section.firstElementChild;
    if (header instanceof HTMLElement && header !== scroller) {
      header.animate(entranceKeyframes(HEADER_FROM), {
        duration: HEADER_ENTER_MS, delay: base, easing: ENTRANCE_EASE, fill: "backwards",
      });
    }
    const cards = cardsInView(scroller);
    const delays = cardEntranceDelays(cards.length);
    cards.forEach((card, i) => {
      card.animate(entranceKeyframes(CARD_FROM), {
        duration: CARD_ENTER_MS, delay: base + delays[i], easing: ENTRANCE_EASE, fill: "backwards",
      });
    });
  }
  // Retirée APRÈS la création des animations : leur premier état (rempli à
  // rebours pendant le retard) prend le relais, sans une image de trou.
  section.removeAttribute(ATTR);
}

/**
 * @param scrollRef La piste de cartes.
 * @param ready     Les cartes sont montées (la rangée a franchi sa porte).
 * @returns         Le rappel de ref à poser sur la `<section>` (à composer).
 */
export function useRowEntrance(scrollRef: RefObject<HTMLElement | null>, ready: boolean) {
  const pending = useRef(!reducedMotion());
  const section = useRef<HTMLElement | null>(null);

  const holdRef = useCallback((el: HTMLElement | null) => {
    section.current = el;
    if (el && pending.current) el.setAttribute(ATTR, HELD);
  }, []);

  useEffect(() => {
    if (!ready || !pending.current) return;
    const scroller = scrollRef.current;
    if (!section.current || !scroller) return;

    // Deux conditions, dans n'importe quel ordre : la piste est assez à
    // l'écran, ET une carte y est montée. La seconde n'est pas acquise quand
    // la porte s'ouvre : après un saut de défilement, la fenêtre de cartes ne
    // se remplit qu'une image plus tard — jouée trop tôt, l'entrée n'animait
    // que le titre, et les cartes surgissaient ensuite d'un coup.
    let inView = false;
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    const timers: number[] = [];
    const stop = () => {
      io?.disconnect();
      mo?.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
    const release = (animate: boolean) => {
      if (!pending.current) return;
      pending.current = false;
      stop();
      // Les éléments du MOMENT : une section remplacée entre-temps (rangée
      // passée par sa branche vide) garderait sinon sa retenue pour toujours.
      const root = section.current;
      const track = scrollRef.current;
      if (animate && root && track) play(root, track);
      else root?.removeAttribute(ATTR);
    };
    const attempt = () => {
      const track = scrollRef.current;
      if (inView && track && mountedCards(track).length > 0) release(true);
    };
    const seen = () => {
      inView = true;
      attempt();
    };

    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver(
        // Toute la salve (cf. useInViewport) : une entrée suffit.
        (entries) => {
          if (entries.some((e) => e.intersectionRatio >= ENTRANCE_VISIBLE_RATIO)) seen();
        },
        { threshold: ENTRANCE_VISIBLE_RATIO },
      );
      io.observe(scroller);
    } else {
      seen();
    }
    if (typeof MutationObserver === "function") {
      mo = new MutationObserver(attempt);
      mo.observe(scroller, { childList: true });
    }
    timers.push(window.setTimeout(seen, ENTRANCE_HOLD_MAX_MS));
    // Jamais une rangée invisible pour toujours : sans carte à animer, elle
    // se montre sans mouvement.
    timers.push(window.setTimeout(() => release(false), ENTRANCE_GIVE_UP_MS));
    return stop;
  }, [ready, scrollRef]);

  return holdRef;
}
