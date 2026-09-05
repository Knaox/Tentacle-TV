import { useTranslation } from "react-i18next";
import { useFavorites } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeIn } from "@/components/ui";
import { MediaRow } from "@/components/MediaRow";
import { homeRowFadeDelay } from "./homeRowFade";

interface Props {
  index: number;
  renderCard: (item: MediaItem) => React.ReactNode;
  onSeeAll: () => void;
}

/** « Mes favoris » — les vingt derniers favoris (films et séries), « Voir
 *  tout » vers la page Favoris. S'alimente seule ; rien sans favori. */
export function HomeFavoritesRow({ index, renderCard, onSeeAll }: Props) {
  const { t } = useTranslation("common");
  const { data } = useFavorites();
  if (!data?.length) return null;
  return (
    <FadeIn delay={homeRowFadeDelay(index)}>
      <MediaRow title={t("myFavorites")} data={data} renderItem={renderCard} onSeeAll={onSeeAll} />
    </FadeIn>
  );
}
