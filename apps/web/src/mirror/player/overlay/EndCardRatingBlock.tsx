import { useTranslation } from "react-i18next";
import type { EndCardRating } from "@tentacle-tv/api-client";
import { StarRating } from "../../../components/rating/StarRating";

const SHADOW = "0 0 4px rgba(0,0,0,0.85)";

/**
 * Noter l'épisode FINI sous les actions de l'affiche de fin —
 * `EndCardRatingBlock` de l'app : libellé 11 px capitales à 18 sous les
 * actions, étoiles puis la note. Poser une étoile tue le décompte.
 */
export function EndCardRatingBlock({ rating, onRatingEngage }: { rating: EndCardRating; onRatingEngage?: () => void }) {
  const { t } = useTranslation("player");
  const { t: tReco } = useTranslation("reco");
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", textShadow: SHADOW }}>
        {t("rateJustWatched")}
        {rating.episodeCode ? ` — ${rating.episodeCode}` : ""}
      </p>
      <div className="flex flex-row items-center" style={{ gap: 12, marginTop: 8 }}>
        <StarRating
          value={rating.value}
          tone="onMedia"
          onRate={(score) => { onRatingEngage?.(); rating.rate(score); }}
          onClear={() => { onRatingEngage?.(); rating.clear(); }}
        />
        {rating.value != null && (
          <span className="tabular-nums" style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: 14, fontWeight: 600 }}>
            {tReco("ratingValue", { score: rating.value })}
          </span>
        )}
      </div>
    </div>
  );
}
