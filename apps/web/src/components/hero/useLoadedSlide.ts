import { useEffect, useState } from "react";
import { isImageReady } from "../../lib/seenImages";

/** Le plus long qu'une diapositive attend l'image de la suivante avant de lui céder la place quand même. */
export const SLIDE_WAIT_MS = 4000;

export interface Slide {
  key: string | null;
  url: string | null;
}

/**
 * La diapositive MONTRÉE par une bannière : la dernière dont l'image est chargée.
 *
 * Le fondu enchaîné d'une diapositive à l'autre partait dès que la rotation avançait, que
 * l'image suivante soit là ou non. Sur un serveur lent, l'image en place s'effaçait donc sur
 * RIEN — une bannière éteinte, son texte seul, jusqu'à ce que la suivante arrive (banc
 * `bench:page-flicker`, réseau lent : une vingtaine d'images plus sombres que les deux
 * diapositives). L'image en place reste maintenant jusqu'à ce que la suivante soit chargée
 * hors de l'écran, puis elles s'enchaînent — deux images présentes, comme le fondu le suppose.
 *
 * Une image déjà en mémoire, ou une bannière qui ne montrait rien, prend la place tout de
 * suite. Un échec de chargement cède aussi : c'est l'image de la bannière qui le constatera et
 * passera au repli. Au-delà de `SLIDE_WAIT_MS`, on n'attend plus.
 */
export function useLoadedSlide(key: string | null, url: string | null): Slide {
  const [shown, setShown] = useState<Slide>({ key, url });
  const changed = key !== shown.key || url !== shown.url;
  // Rien à attendre : aucune image en place, aucune à venir, ou la suivante est déjà là.
  const immediate = changed && (shown.url === null || url === null || isImageReady(url));
  if (immediate) setShown({ key, url });
  const waiting = changed && !immediate;

  useEffect(() => {
    if (!waiting || !url) return;
    let alive = true;
    const adopt = (): void => {
      if (alive) setShown({ key, url });
    };
    const image = new Image();
    image.onload = adopt;
    image.onerror = adopt;
    image.src = url;
    const guard = setTimeout(adopt, SLIDE_WAIT_MS);
    return () => {
      alive = false;
      clearTimeout(guard);
      image.onload = null;
      image.onerror = null;
    };
  }, [waiting, key, url]);

  return immediate ? { key, url } : shown;
}
