import { useTranslation } from "react-i18next";
import { formatDuration } from "@/components/playerControls/utils";
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
 * Deux indices, et ils ne sont pas décoratifs : le geste n'a rien d'évident la
 * première fois, et l'écart entre « OK confirme » et « Retour annule sans rien
 * déplacer » est précisément ce qui rend le curseur fantôme sûr.
 */

interface ProprietesScrub {
  titre: string;
  position: number;
  palier: number;
  currentTime: number;
  duration: number;
  buffered: number;
}

export function SurcoucheScrubTv({
  titre,
  position,
  palier,
  currentTime,
  duration,
  buffered,
}: ProprietesScrub) {
  const { t } = useTranslation("player");

  return (
    <div className="scrub-tv">
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
