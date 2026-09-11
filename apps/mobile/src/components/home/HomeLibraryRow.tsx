import { useTranslation } from "react-i18next";
import { useLatestItems, useSeriesRatings } from "@tentacle-tv/api-client";
import { missingSeriesRatingIds, type MediaItem } from "@tentacle-tv/shared";
import { FadeIn } from "@/components/ui";
import { MediaRow } from "@/components/MediaRow";
import { SeriesRatingProvider } from "@/contexts/SeriesRatingContext";

interface Props {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
  renderCard: (item: MediaItem) => React.ReactNode;
  index: number;
}

/**
 * « Derniers ajouts de … » d'une bibliothèque — extraite de `HomeScreen`
 * (règle des 300 lignes). `collectionType` active le regroupement en
 * collection des bibliothèques séries (runs d'épisodes → tuile série + badge
 * "+N") — parité desktop. Rien sans ajout.
 */
export function HomeLibraryRow({ libraryId, libraryName, collectionType, renderCard, index }: Props) {
  const { t } = useTranslation("common");
  const { data } = useLatestItems(libraryId, { collectionType });
  // Les notes qui manquent aux tuiles de lot « +N » et aux épisodes isolés,
  // en UNE requête. Appelé avant la sortie anticipée, comme tout hook ; une
  // bibliothèque de films n'en réclame aucune et ne requête pas.
  const ratings = useSeriesRatings(missingSeriesRatingIds(data ?? []));
  if (!data || data.length === 0) return null;
  return (
    <FadeIn delay={320 + index * 90}>
      <SeriesRatingProvider ratings={ratings}>
        <MediaRow title={t("latestAdditions", { name: libraryName })} data={data} renderItem={renderCard} />
      </SeriesRatingProvider>
    </FadeIn>
  );
}
