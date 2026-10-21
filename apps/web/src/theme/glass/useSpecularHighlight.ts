/**
 * Le reflet qui suit le pointeur, posé sur une surface de verre.
 *
 * Aucun rendu React : le crochet écrit deux variables CSS sur l'élément
 * (`--lg-spec-u`, `--lg-spec-v`) depuis une boucle `requestAnimationFrame`
 * qui ne tourne QUE pendant que la lumière bouge — entrée, mouvement, retour au
 * repos après la sortie — et n'écrit pas plus de 60 fois par seconde. Au
 * repos, rien ne s'exécute.
 *
 * L'élément porte `data-lg-specular` ; la feuille `physics.css` dessine le halo
 * dans un enfant `.lg-specular` (voir `GlassSpecular`) qui ne se déplace que
 * par `transform` — composité, sans repeindre la surface.
 *
 * Coupé (aucun écouteur) si le système demande moins de mouvement ou plus de
 * contraste : `html[data-lg-motion="reduce"]`, `html[data-lg-contrast="more"]`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SPECULAR_MIN_FRAME_MS,
  SPECULAR_REST_POINT,
  specularCssVars,
  specularSettled,
  specularStep,
  specularTarget,
  type SpecularPoint,
} from "./specular";

const followAllowed = (): boolean => {
  if (typeof document === "undefined") return false;
  const ds = document.documentElement.dataset;
  return ds.lgMotion !== "reduce" && ds.lgContrast !== "more" && ds.lgTransparency !== "reduce";
};

export interface SpecularHighlightOptions {
  /**
   * Faire suivre AUSSI le reflet diffus du socle (`--lg-light-x/y`, lu par
   * `--lgc-sheen`). Repeint la surface à chaque écriture : pour une surface
   * sans `GlassSpecular` seulement.
   */
  sheen?: boolean;
}

export function useSpecularHighlight<T extends HTMLElement>(
  options: SpecularHighlightOptions = {},
): (el: T | null) => void {
  const sheen = options.sheen === true;
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setElement(el), []);
  const state = useRef({ current: SPECULAR_REST_POINT as SpecularPoint, target: SPECULAR_REST_POINT as SpecularPoint });

  useEffect(() => {
    if (!element) return;
    element.dataset.lgSpecular = "";
    let frame = 0;
    let last = 0;
    let rect = element.getBoundingClientRect();

    const write = () => {
      for (const [k, v] of Object.entries(specularCssVars(state.current.current, { sheen }))) element.style.setProperty(k, v);
    };

    const tick = (now: number) => {
      const s = state.current;
      if (last !== 0 && now - last < SPECULAR_MIN_FRAME_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }
      s.current = specularStep(s.current, s.target, last === 0 ? 16 : now - last);
      last = now;
      write();
      if (specularSettled(s.current, s.target)) {
        s.current = s.target;
        write();
        frame = 0;
        last = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    const onEnter = () => {
      // Mesure une fois par entrée : la surface ne bouge pas sous le pointeur.
      rect = element.getBoundingClientRect();
      element.dataset.lgSpecularActive = "";
    };
    const onMove = (e: PointerEvent) => {
      if (!followAllowed()) return;
      state.current.target = specularTarget(rect, e.clientX, e.clientY);
      wake();
    };
    const onLeave = () => {
      delete element.dataset.lgSpecularActive;
      state.current.target = SPECULAR_REST_POINT;
      wake();
    };

    write();
    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      delete element.dataset.lgSpecular;
      delete element.dataset.lgSpecularActive;
      for (const k of ["--lg-spec-u", "--lg-spec-v", "--lg-light-x", "--lg-light-y"]) element.style.removeProperty(k);
    };
  }, [element, sheen]);

  return ref;
}
