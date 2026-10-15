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
  /** La rangée reco qui porte la puce du filtre de plateformes (null : aucune). */
  filterChipRowKey?: string | null;
}

/**
 * LE registre de l'accueil configurable : une clé de rangée → son rendu. Les
 * quatre rangées historiques gardent leurs composants ; leur garde de
 * non-vacuité vit dans la rangée (`hideWhenEmpty`), APRÈS la tenue au survol ; `favorites` rend « Mes favoris » ; `library:<id>` rend la
 * rangée « Derniers ajouts » ; `reco:<row>` rend une rangée de recommandation
 * (mêmes composants que la page Recommandations). Clé inconnue → rien, jamais
 * une erreur.
 */
export function HomeRow({
  rowKey,
  data,
}: {
  rowKey: string;
  data: HomeRowData;
}) {
  const { t } = useTranslation("common");

  if (rowKey === "resume") {
    if (!data.resumeItems) return null;
    return (
      <ContinueWatchingRow
        title={t("common:resumeWatching")}
        items={data.resumeItems}
        hideWhenEmpty
      />
    );
  }
  if (rowKey === "nextUp") {
    if (!data.nextUp) return null;
    return (
      <ContinueWatchingRow
        title={t("common:nextEpisodes")}
        items={data.nextUp}
        hideWhenEmpty
      />
    );
  }
  if (rowKey === "watchlist") {
    if (!data.watchlist) return null;
    return (
      <MediaRow
        title={t("common:myList")}
        items={data.watchlist}
        href="/watchlist"
        hideWhenEmpty
      />
    );
  }
  if (rowKey === "watched") {
    if (!data.watchedItems) return null;
    return (
      <MediaRow
        title={t("common:alreadyWatched")}
        items={data.watchedItems}
        variant="episode"
        hideWhenEmpty
      />
    );
  }
  if (rowKey === "favorites") {
    return <HomeFavoritesRow />;
  }
  if (rowKey.startsWith("library:")) {
    const lib = data.librariesById.get(rowKey.slice("library:".length));
    if (!lib) return null;
    return (
      <LibraryLatestRow
        libraryId={lib.id}
        libraryName={lib.name}
        collectionType={lib.collectionType}
      />
    );
  }
  if (rowKey.startsWith("reco:")) {
    return (
      <HomeRecoRow
        rowKey={rowKey.slice("reco:".length)}
        filterChip={rowKey === data.filterChipRowKey}
      />
    );
  }
  return null;
}
