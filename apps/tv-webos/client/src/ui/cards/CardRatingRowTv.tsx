import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useDeleteRating, useItemRating, useRateItem, type RatingIdentity } from "@tentacle-tv/api-client";
import { STAR_PATH, STAR_VIEWBOX } from "@tentacle-tv/shared";

interface CardRatingRowTvProps {
  identity: RatingIdentity;
  jellyfinItemId: string | null;
}

/**
 * La note d'un titre, à la télécommande : cinq étoiles ENTIÈRES.
 *
 * La saisie du web — dix demi-étoiles — avait été retirée du téléviseur, et
 * pour de bonnes raisons (`shims/noRating.ts`) : dix arrêts du D-pad pour
 * traverser une ligne, un anneau plus large que les glyphes. Cinq cibles de
 * taille salon règlent les deux : la note se pose en étoiles entières
 * (2, 4… 10 sur 10), OK sur la note actuelle la retire. Une note à demi-étoile
 * posée ailleurs s'affiche telle quelle — elle se lit, elle ne se perd pas.
 *
 * C'est la même note que partout (`/api/ratings`, identité de
 * `useCardRatingTarget`) : la pastille de la carte la montre aussitôt.
 */
export function CardRatingRowTv({ identity, jellyfinItemId }: CardRatingRowTvProps) {
  const { t } = useTranslation("reco");
  const rating = useItemRating(identity);
  const rate = useRateItem();
  const remove = useDeleteRating();
  const score = rating?.score ?? null;
  // Un identifiant propre aux références SVG : `useId` rend des caractères
  // (« : », « « ») qu'une `url(#…)` de Chrome 53 ne résout pas à coup sûr.
  const clip = `etoile${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className="actions-carte-tv-note" role="group" aria-label={t("yourRating")}>
      <p className="actions-carte-tv-note-titre">{t("yourRating")}</p>
      <div className="actions-carte-tv-etoiles">
        {[1, 2, 3, 4, 5].map((star) => {
          const value = star * 2;
          const current = score === value;
          const fill = score === null ? 0 : score >= value ? 1 : score === value - 1 ? 0.5 : 0;
          const label = current ? t("removeRatingAria", { score: value }) : t("rateAria", { score: value });
          return (
            <button
              key={star}
              type="button"
              className="actions-carte-tv-etoile"
              data-remplie={fill > 0}
              aria-label={label}
              aria-pressed={current}
              onClick={() =>
                current
                  ? remove.mutate(identity)
                  : rate.mutate({ ...identity, jellyfinItemId: jellyfinItemId ?? undefined, score: value })
              }
            >
              <svg viewBox={STAR_VIEWBOX} aria-hidden>
                <defs>
                  <clipPath id={`${clip}-${star}`}>
                    <rect x="0" y="0" width={20 * fill} height="20" />
                  </clipPath>
                </defs>
                <path className="actions-carte-tv-etoile-trait" d={STAR_PATH} />
                {fill > 0 && <path className="actions-carte-tv-etoile-plein" d={STAR_PATH} clipPath={`url(#${clip}-${star})`} />}
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
