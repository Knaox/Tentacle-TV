import { useTranslation } from "react-i18next";
import { useWatchedItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeIn } from "@/components/ui";
import { MediaRow } from "@/components/MediaRow";
import { homeRowFadeDelay } from "./homeRowFade";

interface Props {
  index: number;
  renderCard: (item: MediaItem) => React.ReactNode;
}

/** « Déjà visionné » — s'alimente seule : aucune requête si la rangée est
 *  éteinte, rien sans visionnage. */
export function HomeWatchedRow({ index, renderCard }: Props) {
  const { t } = useTranslation("common");
  const { data } = useWatchedItems();
  if (!data?.length) return null;
  return (
    <FadeIn delay={homeRowFadeDelay(index)}>
      <MediaRow title={t("alreadyWatched")} data={data} renderItem={renderCard} />
    </FadeIn>
  );
}
