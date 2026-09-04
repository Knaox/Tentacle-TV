import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "../rows/MediaRow";
import { ContinueWatchingRow } from "../rows/ContinueWatchingRow";
import { LibraryLatestRow } from "../rows/LibraryLatestRow";
import { HomeFavoritesRow } from "./HomeFavoritesRow";
import { HomeRecoRow } from "./HomeRecoRow";

export interface HomeRowData {
  resumeItems: MediaItem[] | undefined;
  nextUp: MediaItem[] | undefined;
  watchlist: MediaItem[] | undefined;
  watchedItems: MediaItem[] | undefined;
  librariesById: Map<string, { id: string; name: string; collectionType?: string; index: number }>;
  /** Bandeau « reco » actif : les items qu'il montre, que « Pour vous » saute. */
  heroExcludeKeys?: readonly string[];
}

/**
 * LE registre de l'accueil configurable : une clé de rangée → son rendu. Les
 * quatre rangées historiques gardent leurs composants et leurs gardes de
 * non-vacuité ; `favorites` rend « Mes favoris » ; `library:<id>` rend la
 * rangée « Derniers ajouts » ; `reco:<row>` rend une rangée de recommandation
 * (mêmes composants que la page Recommandations). Clé inconnue → rien, jamais
 * une erreur.
 */
export function HomeRow({
  rowKey,
  animDelay,
  data,
}: {
  rowKey: string;
  animDelay: number;
  data: HomeRowData;
}) {
  const { t } = useTranslation("common");

  if (rowKey === "resume") {
    if (!data.resumeItems?.length) return null;
    return (
      <ContinueWatchingRow
        title={t("common:resumeWatching")}
        items={data.resumeItems}
        animDelay={animDelay}
      />
    );
  }
  if (rowKey === "nextUp") {
    if (!data.nextUp?.length) return null;
    return (
      <ContinueWatchingRow
        title={t("common:nextEpisodes")}
        items={data.nextUp}
        animDelay={animDelay}
      />
    );
  }
  if (rowKey === "watchlist") {
    if (!data.watchlist?.length) return null;
    return (
      <MediaRow
        title={t("common:myList")}
        items={data.watchlist}
        animDelay={animDelay}
        href="/watchlist"
      />
    );
  }
  if (rowKey === "watched") {
    if (!data.watchedItems?.length) return null;
    return (
      <MediaRow
        title={t("common:alreadyWatched")}
        items={data.watchedItems}
        variant="episode"
        animDelay={animDelay}
      />
    );
  }
  if (rowKey === "favorites") {
    return <HomeFavoritesRow animDelay={animDelay} />;
  }
  if (rowKey.startsWith("library:")) {
    const lib = data.librariesById.get(rowKey.slice("library:".length));
    if (!lib) return null;
    return (
      <LibraryLatestRow
        libraryId={lib.id}
        libraryName={lib.name}
        collectionType={lib.collectionType}
        delayIndex={lib.index}
      />
    );
  }
  if (rowKey.startsWith("reco:")) {
    const sub = rowKey.slice("reco:".length);
    return (
      <HomeRecoRow
        rowKey={sub}
        animDelay={animDelay}
        excludeKeys={sub === "forYou" ? data.heroExcludeKeys : undefined}
      />
    );
  }
  return null;
}
