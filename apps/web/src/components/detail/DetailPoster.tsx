import { useCallback, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  /** Ouvre la vue « image plein écran » sur ce visuel. */
  onOpen?: () => void;
  /**
   * Visuel venu d'ailleurs que Jellyfin — la fiche d'un titre gardé le lit sur
   * le disque. `undefined` = la Primary de l'item, par le serveur.
   */
  imageUrl?: string | null;
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
export function DetailPoster({ item, onMeasure, instant = false, onOpen, imageUrl }: DetailPosterProps) {
  const { t } = useTranslation("media");
  const client = useJellyfinClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const hasImage = imageUrl === undefined ? Boolean(item.ImageTags?.Primary) : Boolean(imageUrl);

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
  const url = imageUrl ?? client.getImageUrl(item.Id, "Primary", {
    ...(isEpisode ? { width: 832 } : { height: 600 }),
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
      // `self-end` : l'affiche s'aligne sur le BAS du bloc titre, sur la ligne
      // des actions — c'est le socle de la composition.
      className={`group/poster relative hidden flex-shrink-0 self-end overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-white/15 sm:block ${
        isEpisode ? "w-72 md:w-[22rem] xl:w-[26rem]" : "w-40 md:w-52 xl:w-60"
      }`}
      style={{ boxShadow: "0 30px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(var(--brand-rgb),0.12)" }}
    >
      {/* Seconde et dernière mesure : la boîte épouse son image, sa hauteur
          n'est donc définitive qu'une fois celle-ci placée. */}
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={t("media:detailOpenPoster")}
        className="block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--border-focus)] disabled:cursor-default"
      >
        {/* Le zoom au survol vit sur l'IMAGE, jamais sur la boîte mesurée. */}
        <img
          src={url}
          alt={item.Name}
          draggable={false}
          onLoad={publish}
          className={`w-full object-cover transition-transform duration-300 ease-out group-hover/poster:scale-[1.03] ${isEpisode ? "aspect-video" : "aspect-[2/3]"}`}
        />
        <span aria-hidden className="pointer-events-none absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-200 group-hover/poster:opacity-100">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </span>
      </button>
      {/* Qualité + langues directement sur le visuel, comme sur les vignettes —
          cohérence d'un bout à l'autre du parcours. */}
      <CardMetaOverlay item={item} />
    </motion.div>
  );
}
