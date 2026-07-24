import { useCallback, useLayoutEffect, useRef } from "react";
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
  /**
   * Le visuel arrive par le calque d'ouverture : pas de fondu propre.
   *
   * Les deux se superposaient — le calque déposait l'image à cet endroit
   * pendant que la boîte, dessous, montait encore son opacité. Quand le calque
   * s'effaçait avant la fin, on voyait l'affiche à mi-opacité sur le backdrop.
   */
  instant?: boolean;
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
export function DetailPoster({ item, onMeasure, instant = false }: DetailPosterProps) {
  const client = useJellyfinClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const hasImage = Boolean(item.ImageTags?.Primary);

  const publish = useCallback(() => {
    const el = boxRef.current;
    if (!onMeasure || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      onMeasure({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, [onMeasure]);

  /**
   * DEUX mesures au plus, et pas une de plus.
   *
   * La première en `useLayoutEffect`, avant la peinture : sinon le calque
   * d'ouverture afficherait une frame à l'ancienne position puis sauterait. La
   * seconde au `load` de l'image (cf. `onLoad` plus bas), parce qu'une seule ne
   * suffit pas — depuis que la boîte épouse son image (`self-start`), sa hauteur
   * dépend du visuel, qui n'est pas encore placé au premier passage.
   *
   * Un `ResizeObserver` a été essayé pour couvrir tous les cas ; il publiait en
   * flux continu, donc re-rendait l'arbre pendant que la page jouait son entrée.
   * Deux publications bornées suffisent, et `handleMeasure` (MediaDetail) ignore
   * de toute façon les rectangles identiques.
   */
  useLayoutEffect(() => {
    if (hasImage) publish();
  }, [hasImage, publish]);

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
      // `initial={false}` quand le calque dépose déjà l'image ici : les deux
      // fondus se superposaient, et si le calque s'effaçait avant la fin du
      // second on voyait l'affiche à mi-opacité sur le backdrop.
      initial={instant ? false : { opacity: 0 }}
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
      {/* Seconde et dernière mesure : la boîte épouse son image, sa hauteur
          n'est donc définitive qu'une fois celle-ci placée. */}
      <img
        src={url}
        alt={item.Name}
        draggable={false}
        onLoad={publish}
        className={`w-full object-cover ${isEpisode ? "aspect-video" : "aspect-[2/3]"}`}
      />
      {/* Qualité + langues directement sur le visuel, comme sur les vignettes —
          cohérence d'un bout à l'autre du parcours. */}
      <CardMetaOverlay item={item} />
    </motion.div>
  );
}
