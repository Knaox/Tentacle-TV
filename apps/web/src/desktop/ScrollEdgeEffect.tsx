import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { isRouteHeld, subscribeRouteHold } from "../components/routeTransition/routeHold";
import { useWindowGlass } from "./windowGlass";

/**
 * L'effet de bord de défilement de macOS 26 (« scroll edge effect ») : sous la
 * barre d'outils, le contenu qui remonte se FOND et se FLOUTE progressivement
 * au lieu de passer net sous une bande opaque.
 *
 * Deux couches (`windowGlass.css`) : un flou dont le masque s'éteint vers le
 * bas — le flou progressif —, et une teinte de la surface qui garde les feux,
 * la barre et le titre lisibles sur n'importe quelle affiche.
 *
 * # Monté seulement quand quelque chose passe dessous
 *
 * En haut de page, rien ne défile sous la barre : la couche n'existe pas
 * (règle 1 de « Coût GPU » — un `backdrop-filter` masqué n'est pas gratuit).
 * Dès le premier pixel de défilement, elle naît, et son opacité suit les
 * `RAMP` premiers pixels : la bannière d'accueil, qui passe déjà sous la barre
 * de navigation au repos, ne se floute pas d'un coup. Seule l'opacité varie,
 * écrite sur la couche par une `ref` : opération de compositeur, aucun rendu
 * React par image.
 *
 * Au repos, défilée ou non, rien ne bouge derrière : le flou n'est pas
 * recalculé, le GPU dort.
 *
 * # Pendant qu'une navigation attend
 *
 * La page quittée reste à l'écran, épinglée (`RouteExit`), pendant que la fenêtre
 * est déjà remise au défilement de la page suivante. L'effet ne suit donc plus la
 * page qu'on voit : il se retire, et c'est elle qui EMPORTE le sien, figé où il
 * était (`CarriedScrollEdge`). Sans cela, le haut d'une page quittée défilée
 * redevenait net sous la barre le temps de l'attente (vu au banc, lot « rf2 »),
 * et celui d'une page quittée en haut se floutait dès que la suivante retrouvait
 * son défilement. L'attente finie, il reprend le défilement de la fenêtre.
 */

const RAMP = 48;

/** L'opacité de l'effet pour un défilement donné : pleine après `RAMP` pixels. */
export function scrollEdgeOpacity(scrollY: number): number {
  return Math.max(0, Math.min(1, scrollY / RAMP));
}

const notHeld = (): boolean => false;

export function ScrollEdgeEffect() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(() => typeof window !== "undefined" && window.scrollY > 0);
  const held = useSyncExternalStore(subscribeRouteHold, isRouteHeld, notHeld);
  const frame = useRef(0);

  useLayoutEffect(() => {
    const apply = () => {
      frame.current = 0;
      const y = window.scrollY;
      // Retourner la même valeur court-circuite le rendu : React ne re-rend
      // qu'en franchissant le haut de page.
      setMounted((prev) => (y > 0 === prev ? prev : y > 0));
      const el = ref.current;
      if (el) el.style.opacity = String(scrollEdgeOpacity(y));
    };
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
  }, []);

  // La couche fraîchement montée (premier pixel de défilement, fin d'une attente)
  // prend son opacité AVANT la première peinture.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.style.opacity = String(scrollEdgeOpacity(window.scrollY));
  }, [mounted, held]);

  if (!mounted || held) return null;
  return <div ref={ref} aria-hidden className="lgc-edge" />;
}

/**
 * L'effet de bord qu'une page ÉPINGLÉE emporte (`RouteExit`) : celui qu'on lui voyait à
 * l'instant où on l'a quittée, posé DANS son enveloppe — au-dessus de son contenu, sous sa
 * barre —, et qui s'efface avec elle. Hors du verre de fenêtre, ou pour une page quittée en
 * haut : rien.
 *
 * Il paraît à l'instant où l'effet de la fenêtre se retire (le début de l'attente, lu au même
 * magasin : les deux changent dans la même image — jamais deux voiles l'un sur l'autre, jamais
 * aucun), puis reste jusqu'au bout de la sortie de sa page.
 */
export function CarriedScrollEdge({ scrollY }: { scrollY: number }) {
  const glass = useWindowGlass();
  const held = useSyncExternalStore(subscribeRouteHold, isRouteHeld, isRouteHeld);
  const [taken, setTaken] = useState(false);
  if (held && !taken) setTaken(true);
  if (!glass || !taken || scrollY <= 0) return null;
  return <div aria-hidden className="lgc-edge" style={{ opacity: scrollEdgeOpacity(scrollY) }} />;
}
