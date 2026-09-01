import { useTranslation } from "react-i18next";
import type { EndCardRating } from "@tentacle-tv/api-client";
import { StarRating } from "../rating/StarRating";

interface EndCardRatingRowProps {
  rating: EndCardRating;
  /** Appelé AVANT tout geste de note : tue le décompte de la suite — poser
   *  une étoile dit « je suis encore sur cet écran », et il faut le temps de
   *  corriger une demi-étoile. Le simple survol, lui, ne suspend rien. */
  onEngage?: () => void;
}

/**
 * La rangée d'étoiles de l'affiche de fin : noter l'épisode qu'on vient de
 * voir, sans quitter l'écran. Geste SECONDAIRE — sous les actions, libellé
 * discret ; `StarRating tone="onMedia"` (contours blancs + ombres statiques),
 * prévu exactement pour un texte posé sur image. Aucun backdrop-filter.
 */
export function EndCardRatingRow({ rating, onEngage }: EndCardRatingRowProps) {
  const { t } = useTranslation("player");
  const { t: tReco } = useTranslation("reco");
  return (
    <div className="mt-5">
      <p
        className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
      >
        {t("player:rateJustWatched")}
        {rating.episodeCode ? ` — ${rating.episodeCode}` : ""}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <StarRating
          value={rating.value}
          tone="onMedia"
          onRate={(score) => {
            onEngage?.();
            rating.rate(score);
          }}
          onClear={() => {
            onEngage?.();
            rating.clear();
          }}
        />
        {rating.value != null && (
          <span
            className="text-sm font-semibold text-white/80 tabular-nums"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
          >
            {tReco("ratingValue", { score: rating.value })}
          </span>
        )}
      </div>
    </div>
  );
}
