import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration } from "@/components/playerControls/utils";
import { useTrickplay } from "@/hooks/useTrickplay";
import { BarreProgressionTv } from "./BarreProgressionTv";

/**
 * L'écran de déplacement dans le flux.
 *
 * Il REMPLACE la rangée de transport au lieu de se poser dessus. Ce n'est pas
 * une économie de dessin : les boutons démontés cessent d'être des candidats au
 * focus, donc la question « que fait OK pendant un déplacement » ne se pose
 * plus. Le modèle d'Android TV a besoin d'une garde sur chaque poignée de
 * bouton pour la même raison ; ici il n'y a rien à garder.
 *
 * **La vignette est le vrai repère.** Un horodatage dit où l'on va, pas ce
 * qu'on y trouvera — et c'est la scène qu'on cherche en se déplaçant. Le client
 * web la montre au survol, dans un cadre de 256 px ; l'Apple TV la met en plein
 * écran, parce qu'à trois mètres un timbre-poste ne se lit pas. C'est ce
 * dernier parti qui est repris.
 *
 * Le hook du client web sert tel quel : le manifeste n'offre qu'une définition,
 * 320 px de large, et il n'y a donc aucun choix hi-res à faire — l'image est
 * étirée, et parfaitement reconnaissable pour ce qu'on lui demande.
 *
 * Deux indices, et ils ne sont pas décoratifs : le geste n'a rien d'évident la
 * première fois, et l'écart entre « OK confirme » et « Retour annule sans rien
 * déplacer » est précisément ce qui rend le curseur fantôme sûr.
 */

/** La largeur du canevas. La dalle l'agrandit ensuite de moitié. */
const CANEVAS_PX = 1280;

interface ProprietesScrub {
  titre: string;
  position: number;
  palier: number;
  currentTime: number;
  duration: number;
  buffered: number;
  item?: MediaItem;
  mediaSourceId?: string;
}

export function SurcoucheScrubTv({
  titre,
  position,
  palier,
  currentTime,
  duration,
  buffered,
  item,
  mediaSourceId,
}: ProprietesScrub) {
  const { t } = useTranslation("player");
  const { available, info, getFrameAt, preloadNeighbors } = useTrickplay(item, mediaSourceId);

  const vignette = useMemo(() => {
    if (!available || !info) return null;
    // `getFrameAt` met la mosaïque en cache au passage. L'opération est
    // idempotente — une entrée de `Map` — et n'a lieu qu'aux quatre tics par
    // seconde du maintien, jamais à chaque rendu.
    const image = getFrameAt(position * 1000);
    if (!image) return null;

    const echelle = CANEVAS_PX / info.Width;
    return {
      tuile: image.tileIndex,
      style: {
        backgroundImage: `url(${image.url})`,
        backgroundSize: `${Math.round(info.Width * info.TileWidth * echelle)}px ${Math.round(
          info.Height * info.TileHeight * echelle,
        )}px`,
        backgroundPosition: `-${Math.round(image.xInTile * echelle)}px -${Math.round(
          image.yInTile * echelle,
        )}px`,
      },
    };
  }, [available, info, getFrameAt, position]);

  const tuile = vignette ? vignette.tuile : null;
  useEffect(() => {
    if (tuile !== null) preloadNeighbors(tuile);
  }, [tuile, preloadNeighbors]);

  return (
    // Même barrière que sur l'habillage : le conteneur du `VideoPlayer` bascule
    // la lecture à tout clic qui lui parvient. Ici c'est le clic de la Magic
    // Remote qui est en cause — reprendre la lecture en plein déplacement
    // laisserait le curseur fantôme courir sur une vidéo qui avance.
    <div className="scrub-tv" onClick={(evenement) => evenement.stopPropagation()}>
      {vignette && <div className="scrub-tv-vignette" style={vignette.style} />}
      <div className="scrub-tv-voile" />

      <div className="scrub-tv-haut">
        <p className="scrub-tv-titre">{titre}</p>
        {palier > 1 && <span className="scrub-tv-palier">{`${palier}×`}</span>}
      </div>

      <div className="scrub-tv-bas">
        <p className="scrub-tv-horodatage">{formatDuration(position)}</p>
        <BarreProgressionTv
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          fantome={position}
        />
        <p className="scrub-tv-indices">
          <span>{t("player:scrubConfirmHint")}</span>
          <span>{t("player:scrubCancelHint")}</span>
        </p>
      </div>
    </div>
  );
}
