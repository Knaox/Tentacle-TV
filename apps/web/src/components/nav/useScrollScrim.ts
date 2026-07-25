import { useLayoutEffect, useRef, useState } from "react";

interface ScrollScrimOptions {
  /** Course de défilement, en pixels, sur laquelle la progression va de 0 à 1. */
  threshold: number;
  /** Opacité de l'assise pour une progression donnée. */
  opacityAt: (progress: number) => number;
  /**
   * Seuil au-delà duquel `crossed` bascule. C'est le SEUL état React du hook :
   * il ne change qu'en franchissant la valeur, donc au plus deux fois par
   * traversée, là où la progression change à chaque image.
   */
  crossAt?: number;
}

/**
 * Assise de barre de navigation pilotée par le défilement.
 *
 * Ce que ce hook remplace : un `useState` mis à jour à CHAQUE image de
 * défilement, dont la valeur servait à recomposer une chaîne
 * `color-mix(in srgb, var(--surface-0) X%, transparent)` posée sur la barre.
 * Deux coûts se cumulaient, et le second est le vrai sujet :
 *
 *  1. tout le contenu de la barre était re-rendu — recherche, cloche, avatar,
 *     liens — dont la pastille active de `TopNavLinks`, un `layoutId` Framer
 *     qui re-mesure sa géométrie à chaque rendu ;
 *  2. changer le `background` d'un élément le fait REPEINDRE. Or cette barre
 *     porte un `backdrop-filter` et couvre toute la largeur : chaque image de
 *     défilement redemandait une copie de l'arrière-plan et une passe de flou.
 *
 * Ici l'opacité est écrite directement sur une couche dédiée, via une `ref`.
 * Aucun rendu React, et surtout : une opacité qui change sur un calque sans
 * descendant est une opération de COMPOSITEUR, pas une peinture.
 *
 * L'écriture vise cette couche vide et jamais la barre, ce qui n'est pas un
 * détail : une variable CSS posée sur un ancêtre est héritée, donc écrire
 * dessus invalide le style calculé de toute sa descendance. Le même piège est
 * documenté dans `theme/surfaces.css`.
 *
 * `color-mix(in srgb, C X%, transparent)` sur une couleur opaque donne
 * exactement cette couleur à l'alpha X — le rendu est donc identique à un
 * aplat de la même couleur porté à `opacity: X`.
 */
export function useScrollScrim<T extends HTMLElement>({
  threshold,
  opacityAt,
  crossAt = 1.1,
}: ScrollScrimOptions) {
  const ref = useRef<T | null>(null);
  const [crossed, setCrossed] = useState(false);
  const frame = useRef(0);
  // La fonction d'opacité est souvent écrite en ligne par l'appelant : la
  // suivre par une ref évite de recâbler l'écouteur de défilement à chaque
  // rendu, sans exiger un `useCallback` de sa part.
  const opacityRef = useRef(opacityAt);
  opacityRef.current = opacityAt;

  // `useLayoutEffect` et non `useEffect` : le premier passage doit avoir posé
  // l'opacité AVANT que le navigateur ne peigne. Après peinture, on verrait la
  // barre entièrement transparente le temps d'une image — un clignotement au
  // chargement, et pire encore quand le navigateur restaure une position de
  // défilement où la barre devrait déjà être opaque.
  useLayoutEffect(() => {
    const apply = () => {
      frame.current = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / threshold));
      const el = ref.current;
      if (el) el.style.opacity = String(opacityRef.current(progress));
      // Retourner `prev` à l'identique court-circuite le rendu côté React :
      // tant qu'on ne franchit pas le seuil, ce `setState` ne coûte rien.
      setCrossed((prev) => (progress > crossAt === prev ? prev : progress > crossAt));
    };
    // Une seule mesure par image, quelle que soit la cadence des évènements —
    // un trackpad en émet volontiers plusieurs par image.
    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [threshold, crossAt]);

  return { ref, crossed };
}
