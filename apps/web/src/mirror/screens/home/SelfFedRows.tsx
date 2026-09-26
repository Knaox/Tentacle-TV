import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFavorites, useLatestItems, useSeriesRatings, useWatchedItems } from "@tentacle-tv/api-client";
import { missingSeriesRatingIds, type MediaItem } from "@tentacle-tv/shared";
import { SeriesRatingProvider } from "../../../components/cards/SeriesRatingContext";
import { MediaRow } from "../../rows/MediaRow";
import { FadeIn, homeRowFadeDelay } from "../../hero/FadeIn";

type RenderCard = (item: MediaItem) => ReactNode;
const keyOf = (item: MediaItem) => item.Id;

/**
 * Les rangées de l'accueil qui s'alimentent SEULES (`HomeWatchedRow`,
 * `HomeFavoritesRow`, `HomeLibraryRow` de l'app) : aucune requête si la
 * rangée est éteinte (le composant n'est pas monté), rien sans contenu.
 */
export function HomeWatchedRow({ index, renderCard }: { index: number; renderCard: RenderCard }) {
  const { t } = useTranslation("common");
  const { data } = useWatchedItems();
  if (!data?.length) return null;
  return (
    <FadeIn delay={homeRowFadeDelay(index)}>
      <MediaRow title={t("alreadyWatched")} data={data} renderItem={renderCard} keyOf={keyOf} />
    </FadeIn>
  );
}

/** « Mes favoris » : « Voir tout » vers la page Favoris. */
export function HomeFavoritesRow({ index, renderCard, onSeeAll }: { index: number; renderCard: RenderCard; onSeeAll: () => void }) {
  const { t } = useTranslation("common");
  const { data } = useFavorites();
  if (!data?.length) return null;
  return (
    <FadeIn delay={homeRowFadeDelay(index)}>
      <MediaRow title={t("myFavorites")} data={data} renderItem={renderCard} keyOf={keyOf} onSeeAll={onSeeAll} />
    </FadeIn>
  );
}

/**
 * « Derniers ajouts de … » : `collectionType` regroupe les runs d'épisodes
 * d'une bibliothèque séries (tuile série + « +N ») ; les notes manquantes
 * des tuiles de lot arrivent en UNE requête. Délai d'entrée de l'app :
 * 320 + 90 × rang de la bibliothèque.
 */
export function HomeLibraryRow({ libraryId, libraryName, collectionType, libraryIndex, renderCard }: {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
  libraryIndex: number;
  renderCard: RenderCard;
}) {
  const { t } = useTranslation("common");
  const { data } = useLatestItems(libraryId, { collectionType });
  const ratings = useSeriesRatings(missingSeriesRatingIds(data ?? []));
  if (!data || data.length === 0) return null;
  return (
    <FadeIn delay={320 + libraryIndex * 90}>
      <SeriesRatingProvider ratings={ratings}>
        <MediaRow title={t("latestAdditions", { name: libraryName })} data={data} renderItem={renderCard} keyOf={keyOf} />
      </SeriesRatingProvider>
    </FadeIn>
  );
}
