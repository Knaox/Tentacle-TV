import { useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardMetaOverlay } from "../media/CardMetaOverlay";

interface DetailPosterProps {
  item: MediaItem;
  /**
   * Rectangle final du visuel, mesuré après mise en page. C'est la CIBLE de
   * l'animation d'ouverture : le calque fait voyager l'image de la carte
   * jusqu'à cette place exacte, au lieu de la faire grossir au hasard.
   */
  onMeasure?: (rect: { top: number; left: number; width: number; height: number }) => void;
}

/**
 * Visuel d'en-tête de la fiche.
 *
 * Le format suit le TYPE de média, ce qui n'était pas le cas :
 *  • film / série / collection → affiche 2:3, le format de l'objet ;
 *  • ÉPISODE → sa Primary est un still 16:9. Elle était affichée dans une
 *    colonne de 224 px pensée pour un portrait : la vignette occupait le tiers
 *    haut de la case et flottait, minuscule, à côté d'un titre en display-2.
 *    Elle prend désormais toute la largeur de la colonne, en 16:9.
 */
export function DetailPoster({ item, onMeasure }: DetailPosterProps) {
  const client = useJellyfinClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const hasImage = Boolean(item.ImageTags?.Primary);

  // `useLayoutEffect` : la mesure doit être prise AVANT la peinture, sinon le
  // calque d'ouverture afficherait une frame à l'ancienne position puis
  // sauterait. Mesuré une fois l'image en place, la cible est définitive.
  useLayoutEffect(() => {
    if (!hasImage || !onMeasure || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    onMeasure({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [hasImage, onMeasure]);

  if (!hasImage) return null;

  const isEpisode = item.Type === "Episode";
  const url = client.getImageUrl(item.Id, "Primary", {
    ...(isEpisode ? { width: 640 } : { height: 500 }),
    quality: 90,
  });

  return (
    // Entrée en OPACITÉ seule, jamais en `y`/`scale`. Une transformation
    // fausserait la mesure ci-dessus : `getBoundingClientRect()` renverrait la
    // position de départ de l'animation, et le visuel en vol atterrirait à
    // côté de sa cible. C'est aussi inutile — le calque d'ouverture assure
    // déjà l'arrivée de ce visuel.
    <motion.div
      ref={boxRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      // `self-start` : sans lui la boîte s'ÉTIRE sur toute la hauteur de la
      // rangée flex (comportement par défaut, `align-items: stretch`), pendant
      // que l'image garde son ratio. Le cadre arrondi se retrouvait alors
      // beaucoup plus haut que son image, avec un aplat vide en dessous —
      // criant sur un still d'épisode (352 × 198 dans un cadre de 330 de haut),
      // discret sur une affiche 2:3 qui remplit presque la rangée.
      className={`relative flex-shrink-0 self-start overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-line-subtle ${
        isEpisode ? "w-40 md:w-[22rem]" : "w-24 md:w-56"
      }`}
      style={{ boxShadow: "var(--elev-3)" }}
    >
      <img
        src={url}
        alt={item.Name}
        draggable={false}
        className={`w-full object-cover ${isEpisode ? "aspect-video" : "aspect-[2/3]"}`}
      />
      {/* Qualité + langues directement sur le visuel, comme sur les vignettes —
          cohérence d'un bout à l'autre du parcours. */}
      <CardMetaOverlay item={item} />
    </motion.div>
  );
}
