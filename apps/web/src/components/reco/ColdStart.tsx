import { useTranslation } from "react-i18next";
import {
  useColdStartTitles,
  useDeleteRating,
  useItemRating,
  useJellyfinClient,
  useRateItem,
} from "@tentacle-tv/api-client";
import type { ColdStartTitle, RatingIdentity } from "@tentacle-tv/api-client";
import { StarRating } from "../rating/StarRating";

/**
 * État de démarrage à froid : sous cinq signaux, AUCUNE recommandation
 * personnalisée — à la place, une invitation à noter cinq titres, avec une
 * grille de titres populaires de la bibliothèque notables sur place.
 */
export function ColdStart({ signalCount }: { signalCount: number }) {
  const { t } = useTranslation("reco");
  const { data } = useColdStartTitles(true);
  const remaining = Math.max(0, 5 - signalCount);

  return (
    <div className="row-gutter mt-8">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-content-primary md:text-3xl">{t("coldTitle")}</h2>
        <p className="mt-2 text-content-secondary">{t("coldBody", { count: remaining })}</p>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {(data?.items ?? []).map((title) => (
          <ColdStartCard key={title.jellyfinItemId} title={title} />
        ))}
      </div>
    </div>
  );
}

function ColdStartCard({ title }: { title: ColdStartTitle }) {
  const client = useJellyfinClient();
  const identity: RatingIdentity = {
    mediaType: title.mediaType === "tv" ? "series" : "movie",
    tmdbId: title.tmdbId,
  };
  const rating = useItemRating(identity);
  const rate = useRateItem();
  const remove = useDeleteRating();

  return (
    <div>
      <img
        src={client.getImageUrl(title.jellyfinItemId, "Primary", { height: 360, quality: 85 })}
        alt={title.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="w-full rounded-lg border border-line-subtle object-cover"
        style={{ aspectRatio: "2 / 3" }}
      />
      <p className="mt-2 line-clamp-1 text-sm font-medium text-content-primary">{title.name}</p>
      <p className="text-xs text-content-tertiary">{title.year ?? ""}</p>
      <div className="mt-1.5">
        <StarRating
          size="sm"
          value={rating?.score ?? null}
          onRate={(score) =>
            rate.mutate({ ...identity, jellyfinItemId: title.jellyfinItemId, score })
          }
          onClear={() => remove.mutate(identity)}
        />
      </div>
    </div>
  );
}
