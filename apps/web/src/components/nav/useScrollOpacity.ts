import { useEffect, useRef, useState } from "react";

/**
 * Progression 0→1 pilotée par le défilement : elle fait passer la barre de
 * navigation de transparente (au-dessus de la bannière) à opaque (au-dessus du
 * contenu).
 *
 * Coalescé en `requestAnimationFrame`. Sans ça, un `setState` partait à CHAQUE
 * évènement de défilement — et un trackpad en émet volontiers plusieurs par
 * image. Chacun re-rendait toute la barre : recherche, notifications, avatar,
 * liens, chips de connectivité, le tout au-dessus d'un `backdrop-filter` sur
 * une barre fixe pleine largeur. Sur toutes les pages.
 *
 * Le hook reste un hook pour que la barre demeure côté client et n'ajoute
 * aucun effet de mise en page.
 */
export function useScrollOpacity(threshold = 80): number {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const apply = () => {
      frame.current = 0;
      const y = window.scrollY;
      setProgress(Math.min(1, Math.max(0, y / threshold)));
    };
    // Une seule mesure par image, quelle que soit la cadence des évènements.
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
  }, [threshold]);

  return progress;
}
