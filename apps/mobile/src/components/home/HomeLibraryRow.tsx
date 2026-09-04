import { useTranslation } from "react-i18next";
import { useLatestItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeIn } from "@/components/ui";
import { MediaRow } from "@/components/MediaRow";

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
  if (!data || data.length === 0) return null;
  return (
    <FadeIn delay={320 + index * 90}>
      <MediaRow title={t("latestAdditions", { name: libraryName })} data={data} renderItem={renderCard} />
    </FadeIn>
  );
}
