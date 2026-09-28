import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "../../rows/MediaRow";
import { FadeIn, homeRowFadeDelay } from "../../hero/FadeIn";
import { HomeRecoRow } from "./HomeRecoRow";
import { MyListRow } from "./MyListRow";
import { HomeFavoritesRow, HomeLibraryRow, HomeWatchedRow } from "./SelfFedRows";

export interface HomeRowData {
  resume: MediaItem[];
  nextUp: MediaItem[];
  watchlist: MediaItem[];
  librariesById: Map<string, { id: string; name: string; collectionType?: string; index: number }>;
  /** La rangée reco qui porte la puce du filtre de plateformes (null : aucune). */
  filterChipRowKey: string | null;
}

export type SeeAllRoute = "/watchlist" | "/favorites" | "/recommendations";

export interface HomeRowActions {
  renderCard: (item: MediaItem) => ReactNode;
  onItemPress: (jellyfinId: string) => void;
  onItemLongPress: (item: MediaItem) => void;
  onSeeAll: (route: SeeAllRoute) => void;
  canOpenReco: (item: RecoRowItem) => boolean;
  onRecoPress: (item: RecoRowItem) => void;
  onRecoLongPress: (item: RecoRowItem) => void;
}

const keyOf = (item: MediaItem) => item.Id;

/**
 * `homeRowRegistry` de l'app : une clé de rangée → son rendu. « Reprendre »,
 * « Épisodes suivants » et « À regarder » viennent de l'écran ; « Déjà
 * visionné », « Mes favoris » et « Derniers ajouts » s'alimentent seules ;
 * `reco:<row>` lit la page de recommandations du compte. Clé inconnue → rien.
 */
export const HomeRow = memo(function HomeRow({ rowKey, index, data, actions }: {
  rowKey: string;
  index: number;
  data: HomeRowData;
  actions: HomeRowActions;
}) {
  const { t } = useTranslation("common");

  if (rowKey === "resume" || rowKey === "nextUp") {
    const items = rowKey === "resume" ? data.resume : data.nextUp;
    if (!items.length) return null;
    return (
      <FadeIn delay={homeRowFadeDelay(index)}>
        <MediaRow
          title={rowKey === "resume" ? t("resumeWatching") : t("nextEpisodes")}
          data={items}
          renderItem={actions.renderCard}
          keyOf={keyOf}
        />
      </FadeIn>
    );
  }
  if (rowKey === "watchlist") {
    return (
      <FadeIn delay={homeRowFadeDelay(index)}>
        <MyListRow
          items={data.watchlist}
          onSeeAll={() => actions.onSeeAll("/watchlist")}
          onItemPress={actions.onItemPress}
          onItemLongPress={actions.onItemLongPress}
        />
      </FadeIn>
    );
  }
  if (rowKey === "watched") return <HomeWatchedRow index={index} renderCard={actions.renderCard} />;
  if (rowKey === "favorites") {
    return <HomeFavoritesRow index={index} renderCard={actions.renderCard} onSeeAll={() => actions.onSeeAll("/favorites")} />;
  }
  if (rowKey.startsWith("library:")) {
    const lib = data.librariesById.get(rowKey.slice("library:".length));
    if (!lib) return null;
    return (
      <HomeLibraryRow
        libraryId={lib.id}
        libraryName={lib.name}
        collectionType={lib.collectionType}
        libraryIndex={lib.index}
        renderCard={actions.renderCard}
      />
    );
  }
  if (rowKey.startsWith("reco:")) {
    return (
      <HomeRecoRow
        rowKey={rowKey.slice("reco:".length)}
        index={index}
        filterChip={rowKey === data.filterChipRowKey}
        onSeeAll={() => actions.onSeeAll("/recommendations")}
        canOpen={actions.canOpenReco}
        onItemPress={actions.onRecoPress}
        onItemLongPress={actions.onRecoLongPress}
      />
    );
  }
  return null;
});
