import { useSyncExternalStore } from "react";

/**
 * Le DÉFILEMENT en cours — ce qui fait passer des cartes sous un pointeur
 * immobile : la page, une rangée (une pièce, `data-preview-room`), ou un coup
 * de molette (le défilement suit). Tant qu'il dure, et `SCROLL_SETTLE_MS`
 * après son dernier évènement, AUCUNE intention d'aperçu ne démarre, et celle
 * qui courait est annulée — délai d'intention, demande en vol, vidéo
 * préchargée cachée (`engineEngaged`). Seule une mini-carte déjà OUVERTE
 * reste, accrochée à sa carte (`usePreviewFollow`).
 *
 * Relevé par la recette (14/10) : pendant un défilement à la molette, une
 * vignette 16:9 restée sous le pointeur lançait deux requêtes — le survol ne
 * cesse que si la carte quitte le pointeur, et une grande vignette met du
 * temps à le quitter.
 *
 * Seul compte le défilement d'un GESTE : la molette (pavé tactile compris),
 * une touche qui fait défiler. Les défilements que la page fait d'elle-même —
 * l'ancrage du navigateur quand une image arrive, `scrollIntoView`, la rangée
 * qui se raccroche après un aperçu — ne bloquent rien : le dernier repoussait
 * l'aperçu suivant de 300 ms (relevé au banc, 14/10).
 *
 * La reprise : après la molette ou le pavé tactile, la porte globale exige en
 * plus un vrai mouvement (`previewQuiet`) ; après un défilement au clavier,
 * l'arrêt franc suffit, et les règles d'intention repartent de zéro.
 */
export const SCROLL_SETTLE_MS = 180;
/**
 * Un défilement compte s'il suit un geste de moins d'une seconde : le
 * défilement doux d'un cran de molette, ou d'une touche, dure ~300 ms ; l'élan
 * du pavé tactile arrive, lui, en évènements de molette.
 */
export const GESTURE_WINDOW_MS = 1000;
/** Les touches qui font défiler la page (ou une rangée, aux flèches). */
const SCROLL_KEYS = new Set(["PageUp", "PageDown", " ", "Spacebar", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

export interface PreviewScrolling {
  isScrolling: () => boolean;
  /** Un geste qui fait défiler : la molette (qui défile aussitôt), une touche. */
  onGesture: (kind: "wheel" | "key") => void;
  /** Un évènement de défilement : ne compte que dans la foulée d'un geste. */
  onScroll: () => void;
  subscribe: (listener: () => void) => () => void;
}

/** `now` : l'horloge, injectée par les tests. */
export function createPreviewScrolling(now: () => number = () => performance.now()): PreviewScrolling {
  let scrolling = false;
  let last = 0;
  let gesture = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  // Une seule minuterie par geste, réarmée sur ce qui reste à attendre :
  // jamais un `clearTimeout` + `setTimeout` par évènement de défilement.
  const settle = () => {
    const left = last + SCROLL_SETTLE_MS - now();
    if (left > 0) {
      timer = setTimeout(settle, left);
      return;
    }
    timer = null;
    scrolling = false;
    notify();
  };
  const mark = () => {
    last = now();
    if (timer === null) timer = setTimeout(settle, SCROLL_SETTLE_MS);
    if (scrolling) return;
    scrolling = true;
    notify();
  };
  return {
    isScrolling: () => scrolling,
    onGesture: (kind) => {
      gesture = now();
      if (kind === "wheel") mark();
    },
    onScroll: () => {
      if (now() - gesture <= GESTURE_WINDOW_MS) mark();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Le défilement de l'application, écouté dès l'import (comme `previewQuiet`). */
export const previewScrolling = createPreviewScrolling();

if (typeof window !== "undefined") {
  // En capture : une rangée défile dans son propre conteneur, et `scroll` ne
  // remonte pas. Seuls comptent la page et les pièces des cartes : une liste
  // déroulante qui défile ne fait passer aucune carte sous le pointeur.
  window.addEventListener(
    "scroll",
    (e) => {
      const target = e.target;
      if (target === document || (target instanceof Element && target.hasAttribute("data-preview-room"))) previewScrolling.onScroll();
    },
    { capture: true, passive: true },
  );
  window.addEventListener("wheel", () => previewScrolling.onGesture("wheel"), { capture: true, passive: true });
  window.addEventListener(
    "keydown",
    (e) => {
      if (SCROLL_KEYS.has(e.key)) previewScrolling.onGesture("key");
    },
    { capture: true, passive: true },
  );
}

/** Un défilement est-il en cours ? Un abonnement par session d'aperçu (carte survolée). */
export function usePreviewScrolling(): boolean {
  return useSyncExternalStore(previewScrolling.subscribe, previewScrolling.isScrolling, previewScrolling.isScrolling);
}
