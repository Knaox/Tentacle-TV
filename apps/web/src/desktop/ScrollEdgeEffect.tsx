import { useLayoutEffect, useRef, useState } from "react";

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
 */

const RAMP = 48;

export function ScrollEdgeEffect() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(() => typeof window !== "undefined" && window.scrollY > 0);
  const frame = useRef(0);

  useLayoutEffect(() => {
    const apply = () => {
      frame.current = 0;
      const y = window.scrollY;
      // Retourner la même valeur court-circuite le rendu : React ne re-rend
      // qu'en franchissant le haut de page.
      setMounted((prev) => (y > 0 === prev ? prev : y > 0));
      const el = ref.current;
      if (el) el.style.opacity = String(Math.min(1, y / RAMP));
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

  // La couche fraîchement montée prend son opacité AVANT la première peinture.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.style.opacity = String(Math.min(1, window.scrollY / RAMP));
  }, [mounted]);

  if (!mounted) return null;
  return <div ref={ref} aria-hidden className="lgc-edge" />;
}
