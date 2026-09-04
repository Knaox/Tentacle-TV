import { useTranslation } from "react-i18next";
import { useDeleteRating, useItemRating, useMediaItem, useRateItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { episodeRatingIdentityFor, ratingIdentityForItem, tmdbIdForItem, tvdbIdForItem } from "../../lib/ratingIdentity";
import { StarRating } from "./StarRating";

/**
 * Bloc « Votre note » de la fiche détaillée. S'efface totalement quand le
 * titre n'est pas notable (pas de tmdbId). L'écriture est optimiste : la note
 * part en base tout de suite, la sync TMDB/AniList suit en arrière-plan.
 * Un épisode se note avec le tmdb de sa SÉRIE : la fiche série est déjà en
 * cache, la page la charge pour le lien « voir la série ».
 */
export function DetailRating({ item }: { item: MediaItem }) {
  const { t } = useTranslation("reco");
  const isEpisode = item.Type === "Episode";
  const { data: series } = useMediaItem(isEpisode ? item.SeriesId : undefined, { enabled: isEpisode });
  const identity = isEpisode
    ? episodeRatingIdentityFor(item, tmdbIdForItem(series))
    : ratingIdentityForItem(item);
  const tvdbId = isEpisode ? (series ? tvdbIdForItem(series) : null) : tvdbIdForItem(item);
  const rating = useItemRating(identity);
  const rate = useRateItem();
  const remove = useDeleteRating();

  if (!identity) return null;
  const score = rating?.score ?? null;

  return (
    <span className="flex items-center gap-2.5 rounded-full border border-line-strong bg-fill-subtle px-4 py-2">
      <span className="text-sm text-content-secondary">{t("yourRating")}</span>
      <StarRating
        value={score}
        onRate={(s) =>
          rate.mutate({ ...identity, jellyfinItemId: item.Id, tvdbId, score: s })
        }
        onClear={() => remove.mutate(identity)}
      />
      {score != null && (
        <span className="text-sm font-semibold tabular-nums text-content-primary">
          {t("ratingValue", { score })}
        </span>
      )}
    </span>
  );
}
