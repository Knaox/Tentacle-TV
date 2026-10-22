import { useLayoutEffect } from "react";

/**
 * Pose, sur chaque surface qui se replie (`[data-lgp-collapse]`) d'un ensemble,
 * l'écart de son centre au PIVOT de l'ensemble (`[data-lgp-pivot]` : le
 * transport en bas, le retour en haut) — `--lgp-collapse-x/y`, lus par
 * `playerGlass.css`. Les capsules repliées s'y rejoignent, s'y fondent (même
 * groupe natif) et s'y résorbent.
 *
 * Mesuré sur la MISE EN PAGE (`offset*`), jamais sur le rectangle affiché :
 * une capsule repliée est transformée, son rectangle n'est plus le sien. Remesuré
 * quand l'ensemble ou l'une de ses capsules change de taille (titre, boutons,
 * fenêtre).
 */
export function useCollapsePivots(container: HTMLElement | null): void {
  useLayoutEffect(() => {
    if (container === null) return undefined;
    const place = (): void => {
      const pivot = container.querySelector<HTMLElement>("[data-lgp-pivot]");
      if (pivot === null) return;
      const target = centerWithin(pivot, container);
      for (const surface of container.querySelectorAll<HTMLElement>("[data-lgp-collapse]")) {
        const own = centerWithin(surface, container);
        surface.style.setProperty("--lgp-collapse-x", `${Math.round(target.x - own.x)}px`);
        surface.style.setProperty("--lgp-collapse-y", `${Math.round(target.y - own.y)}px`);
      }
    };
    place();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(place);
    observer.observe(container);
    for (const surface of container.querySelectorAll("[data-lgp-collapse]")) observer.observe(surface);
    return () => observer.disconnect();
  }, [container]);
}

/** Le centre de l'élément dans l'ensemble, d'après la mise en page (transformations ignorées). */
export function centerWithin(element: HTMLElement, container: HTMLElement): { x: number; y: number } {
  let x = element.offsetWidth / 2;
  let y = element.offsetHeight / 2;
  let node: HTMLElement | null = element;
  while (node !== null && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}
