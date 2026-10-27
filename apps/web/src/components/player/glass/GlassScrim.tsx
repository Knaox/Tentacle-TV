import { useEffect, useId, useRef, useState } from "react";
import { sameHoles, scrimHoles, type ScrimHole, type ScrimShape } from "./scrimHoles";
import "./playerGlassScrim.css";

interface GlassScrimProps {
  /** Le bord où le voile est le plus dense : le haut (titre), le bas (temps, boutons). */
  edge: "top" | "bottom";
  /** Les contrôles sont à l'écran : le voile naît et part avec eux. */
  visible: boolean;
}

/**
 * Durée pendant laquelle les trous suivent les formes image par image après un
 * changement (une forme qui naît, se replie, un panneau qui sort de son
 * bouton) : le ressort `morph` (584 ms) et une marge.
 */
const FOLLOW_MS = 900;

/**
 * Le VOILE du lecteur, façon tvOS 26 : un dégradé noir peint par la page, en
 * bas (temps, barre, boutons) et en haut (titre), qui rend le texte lisible sur
 * toute image — sans pilule autour des libellés.
 *
 * PERCÉ autour de chaque forme de verre (`scrimHoles.ts`) : le verre natif est
 * SOUS la page, un voile qui passerait sur lui le rendrait gris. Les trous sont
 * relus sur les rectangles AFFICHÉS des formes (transformations comprises),
 * image par image pendant `FOLLOW_MS` après tout changement — au repos, rien ne
 * tourne.
 *
 * Un SVG plutôt qu'un dégradé CSS : un masque qui s'additionne (deux formes qui
 * se fondent pendant la métamorphose restent un seul trou), et rien que du noir
 * à alpha (le seul qui se compose juste sur la fenêtre transparente).
 */
export function GlassScrim({ edge, visible }: GlassScrimProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [holes, setHoles] = useState<ScrimHole[]>([]);
  const id = `lgp-scrim-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const svg = ref.current;
    if (svg === null || typeof window === "undefined") return undefined;
    let frame = 0;
    let until = 0;
    const measure = (): void => {
      const box = svg.getBoundingClientRect();
      const next = scrimHoles({ x: box.left, y: box.top, width: box.width, height: box.height }, glassShapes());
      setHoles((previous) => (sameHoles(previous, next) ? previous : next));
    };
    const tick = (): void => {
      measure();
      frame = performance.now() < until ? window.requestAnimationFrame(tick) : 0;
    };
    const follow = (): void => {
      until = performance.now() + FOLLOW_MS;
      if (frame === 0) frame = window.requestAnimationFrame(tick);
    };
    follow();
    const scope = svg.closest(".lgp-chrome")?.parentElement ?? document.body;
    const mutations = new MutationObserver(follow);
    mutations.observe(scope, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-lgp-present", "aria-expanded", "data-lifted"] });
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(follow);
    sizes?.observe(scope);
    scope.addEventListener("transitionrun", follow);
    scope.addEventListener("animationstart", follow);
    window.addEventListener("resize", follow);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      sizes?.disconnect();
      scope.removeEventListener("transitionrun", follow);
      scope.removeEventListener("animationstart", follow);
      window.removeEventListener("resize", follow);
    };
  }, []);

  return (
    <svg ref={ref} className={`lgp-scrim lgp-scrim--${edge}`} data-lgp-present={visible} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${id}-fade`} x1="0" y1={edge === "bottom" ? "1" : "0"} x2="0" y2={edge === "bottom" ? "0" : "1"}>
          <stop offset="0" className="lgp-scrim__stop lgp-scrim__stop--0" />
          <stop offset="0.42" className="lgp-scrim__stop lgp-scrim__stop--1" />
          <stop offset="0.72" className="lgp-scrim__stop lgp-scrim__stop--2" />
          <stop offset="1" className="lgp-scrim__stop lgp-scrim__stop--3" />
        </linearGradient>
        <mask id={`${id}-holes`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect width="100%" height="100%" fill="white" />
          {holes.map((hole, index) => (
            <rect key={index} x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={hole.radius} ry={hole.radius} fill="black" />
          ))}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-fade)`} mask={`url(#${id}-holes)`} />
    </svg>
  );
}

/** Les formes de verre du lecteur à l'écran, dans le repère de la fenêtre. */
function glassShapes(): ScrimShape[] {
  const shapes: ScrimShape[] = [];
  for (const element of document.querySelectorAll<HTMLElement>(".lgp-surface")) {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const rect = element.getBoundingClientRect();
    shapes.push({
      x: rect.left, y: rect.top, width: rect.width, height: rect.height,
      radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
      scale: element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1,
    });
  }
  return shapes;
}
