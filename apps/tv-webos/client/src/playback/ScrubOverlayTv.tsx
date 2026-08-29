import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration } from "@/components/playerControls/utils";
import { useTrickplay } from "@/hooks/useTrickplay";
import { BarreProgressionTv } from "./ProgressBarTv";

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

interface ScrubProps {
  title: string;
  position: number;
  step: number;
  currentTime: number;
  duration: number;
  /** Fraction déjà chargée, de 0 à 1 — cf. `ProgressBarTv`. */
  bufferedFraction: number;
  item?: MediaItem;
  mediaSourceId?: string;
}

export function ScrubOverlayTv({
  title,
  position,
  step,
  currentTime,
  duration,
  bufferedFraction,
  item,
  mediaSourceId,
}: ScrubProps) {
  const { t } = useTranslation("player");
  const { available, info, getFrameAt, preloadNeighbors } = useTrickplay(item, mediaSourceId);

  const vignette = useMemo(() => {
    if (!available || !info) return null;
    // `getFrameAt` met la mosaïque en cache au passage. L'opération est
    // idempotente — une entrée de `Map` — et n'a lieu qu'aux quatre tics par
    // seconde du maintien, jamais à chaque rendu.
    const image = getFrameAt(position * 1000);
    if (!image) return null;

    /**
     * La mosaïque est cadrée en POURCENTAGES, pas en pixels.
     *
     * Le client web fixe la taille de son cadre — deux cent cinquante-six
     * pixels — et en déduit l'échelle à appliquer à la mosaïque. Ici le cadre
     * est l'écran : sa taille dépend de la dalle, et la calculer d'après une
     * constante ne vaut que pour la dalle dont on est parti. Ailleurs, la
     * mosaïque était trop petite pour la boîte et l'on voyait plusieurs
     * vignettes côte à côte — chaque tuile voisine entrant dans le cadre.
     *
     * En pourcentages, la question ne se pose plus : la mosaïque fait toujours
     * autant de fois la boîte qu'elle contient de tuiles, et la position se lit
     * en rangs plutôt qu'en pixels. Rien ne dépend plus de la définition.
     */
    const columns = Math.max(1, info.TileWidth);
    const rows = Math.max(1, info.TileHeight);
    const column = Math.round(image.xInTile / info.Width);
    const row = Math.round(image.yInTile / info.Height);

    return {
      tile: image.tileIndex,
      style: {
        backgroundImage: `url(${image.url})`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        // Un fond en pourcentage aligne le point X% de l'IMAGE sur le point X%
        // de la boîte : le dernier rang tombe donc à 100 %, et non au-delà.
        backgroundPosition: `${(column / Math.max(1, columns - 1)) * 100}% ${
          (row / Math.max(1, rows - 1)) * 100
        }%`,
      },
    };
  }, [available, info, getFrameAt, position]);

  const tile = vignette ? vignette.tile : null;
  useEffect(() => {
    if (tile !== null) preloadNeighbors(tile);
  }, [tile, preloadNeighbors]);

  return (
    // Même barrière que sur l'habillage : le conteneur du `VideoPlayer` bascule
    // la lecture à tout clic qui lui parvient. Ici c'est le clic de la Magic
    // Remote qui est en cause — reprendre la lecture en plein déplacement
    // laisserait le curseur fantôme courir sur une vidéo qui avance.
    <div className="scrub-tv" onClick={(event) => event.stopPropagation()}>
      {vignette && <div className="scrub-tv-vignette" style={vignette.style} />}
      <div className="scrub-tv-voile" />

      <div className="scrub-tv-haut">
        <p className="scrub-tv-titre">{title}</p>
        {step > 1 && <span className="scrub-tv-palier">{`${step}×`}</span>}
      </div>

      <div className="scrub-tv-bas">
        <p className="scrub-tv-horodatage">{formatDuration(position)}</p>
        <BarreProgressionTv
          currentTime={currentTime}
          duration={duration}
          bufferedFraction={bufferedFraction}
          ghost={position}
        />
        <p className="scrub-tv-indices">
          <span>{t("player:scrubConfirmHint")}</span>
          <span>{t("player:scrubCancelHint")}</span>
        </p>
      </div>
    </div>
  );
}
