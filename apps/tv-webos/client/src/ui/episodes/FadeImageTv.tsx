import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { FadeImage as WebFadeImage } from "@/components/FadeImage?original";

/**
 * La vignette d'une ligne d'épisode, chargée seulement à l'approche de l'écran.
 *
 * Remplace `components/FadeImage.tsx`, qui ne sert qu'aux lignes d'épisodes.
 * Sur le web, `loading="lazy"` suffit ; Chrome 53 l'ignore (il faut Chrome
 * 77). Et la liste de la dalle monte TOUTES ses lignes (`EpisodeListTv`, pour
 * que la géométrie ne bouge pas sous le focus) : une saison de 196 épisodes
 * demandait ses 196 vignettes d'un coup, 450 px chacune, et le moteur les
 * décodait toutes. Désormais la vignette n'existe qu'à moins d'un écran du
 * champ ; hors de là, une boîte vide à ses mesures (mêmes classes) tient la
 * place — la ligne ne change pas de taille quand elle arrive.
 *
 * Verrou à sens unique : une vignette chargée le reste.
 */
export function FadeImage(props: ComponentProps<typeof WebFadeImage>) {
  const [near, setNear] = useState(false);
  const [holder, setHolder] = useState<HTMLSpanElement | null>(null);
  const ref = useCallback((el: HTMLSpanElement | null) => setHolder(el), []);

  useEffect(() => {
    if (near || !holder) return;
    return watchNear(holder, () => setNear(true));
  }, [near, holder]);

  if (near) return <WebFadeImage {...props} />;
  return <span ref={ref} aria-hidden className={props.className} style={{ ...props.style, display: "block" }} />;
}

/**
 * UN observateur pour toutes les vignettes : cent quatre-vingt-seize
 * observateurs d'un élément chacun se recalculeraient tous à chaque image du
 * défilement, sur le processeur d'un téléviseur.
 */
const pending = new Map<Element, () => void>();
let observer: IntersectionObserver | null = null;

function watchNear(el: Element, onNear: () => void): () => void {
  // Moteur sans observateur : ne jamais retenir une image.
  if (typeof IntersectionObserver !== "function") {
    onNear();
    return () => {};
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        pending.get(entry.target)?.();
        pending.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    },
    // Un écran d'avance au-dessus comme au-dessous : l'image est là quand la
    // ligne entre, même au défilement rapide de la télécommande.
    { rootMargin: "1080px 0px" },
  );
  pending.set(el, onNear);
  observer.observe(el);
  return () => {
    pending.delete(el);
    observer?.unobserve(el);
  };
}
