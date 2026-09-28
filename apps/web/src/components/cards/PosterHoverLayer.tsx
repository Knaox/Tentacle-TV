import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardActionTray } from "./CardActionTray";
import { PosterHoverShell } from "./PosterHoverShell";
import { HoverRatingStars } from "../rating/HoverRatingStars";
import { ratingIdentityForItem } from "../../lib/ratingIdentity";

interface PosterHoverLayerProps {
  item: MediaItem;
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /** « Reprendre » plutôt que « Lire » quand une lecture est entamée. */
  resume: boolean;
  onPlay: (e: React.MouseEvent) => void;
}

/**
 * Le survol d'une affiche 2:3, en trois temps et trois places — rien dans les
 * angles, que les marqueurs du repos occupent :
 *
 *   1. un VOILE qui assombrit l'affiche par le bas (l'image reste lisible en
 *      haut, où montent les puces qualité/langues) ;
 *   2. le bouton LECTURE, au centre, au dégradé de marque — la seule action
 *      primaire, donc la seule en couleur ;
 *   3. en bas, la note à poser (étoiles) puis le PLATEAU : Ma liste, favori,
 *      vu, hors ligne, dans une capsule.
 *
 * Le clic sur le voile tombe sur la carte, qui ouvre la fiche : le bouton
 * « Plus d'infos » d'autrefois faisait doublon.
 *
 * Monté au survol seulement, par l'appelant (`useMountWhile`) : le plateau
 * s'abonne aux Sets de séries et à la liste des notes, et quatre-vingts cartes
 * ne doivent pas les porter au repos. Le dessin (voile, lecture, fondus) est
 * celui de `PosterHoverShell`, partagé avec les cartes de recommandation.
 */
export function PosterHoverLayer({ item, visible, resume, onPlay }: PosterHoverLayerProps) {
  const { t } = useTranslation("cards");
  const ratingIdentity = ratingIdentityForItem(item);
  const playLabel = resume ? t("resume") : t("play");

  return (
    <PosterHoverShell visible={visible} play={{ label: `${playLabel} — ${item.Name}`, onPlay }}>
      {ratingIdentity && (
        <div className="flex justify-center">
          <HoverRatingStars identity={ratingIdentity} jellyfinItemId={item.Id} />
        </div>
      )}
      {/* Gabarit `sm` à toute largeur : quatre boutons de 28 px tiennent dans
          la plus étroite des affiches (120 px) et s'écartent sur les autres. */}
      <CardActionTray item={item} size="sm" stretch />
    </PosterHoverShell>
  );
}
