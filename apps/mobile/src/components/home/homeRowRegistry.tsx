import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeIn } from "@/components/ui";
import { MediaRow } from "@/components/MediaRow";
import { MyListRow } from "@/components/MyListRow";
import { HomeLibraryRow } from "./HomeLibraryRow";
import { HomeWatchedRow } from "./HomeWatchedRow";
import { HomeFavoritesRow } from "./HomeFavoritesRow";
import { homeRowFadeDelay } from "./homeRowFade";

export interface HomeRowData {
  resume: MediaItem[];
  nextUp: MediaItem[];
  watchlist: MediaItem[];
  librariesById: Map<string, { id: string; name: string; collectionType?: string; index: number }>;
}

export interface HomeRowActions {
  renderCard: (item: MediaItem) => React.ReactNode;
  onItemPress: (jellyfinId: string) => void;
  onItemLongPress: (jellyfinId: string) => void;
  onSeeAll: (route: "/watchlist" | "/favorites") => void;
}

interface HomeRowProps {
  rowKey: string;
  /** Position dans l'accueil — la cascade d'entrée en dépend. */
  index: number;
  data: HomeRowData;
  actions: HomeRowActions;
}

/**
 * LE registre de l'accueil configurable du mobile : une clé de rangée → son
 * rendu, miroir de `homeRowRegistry` web. Les rangées historiques gardent
 * leurs composants et leurs gardes de non-vacuité ; « Déjà visionné », « Mes
 * favoris » et « Derniers ajouts » s'alimentent seules (aucune requête si la
 * rangée est éteinte). Clé inconnue → rien, jamais une erreur. Mémoïsé :
 * `data` et `actions` sont stables entre deux rendus de l'écran.
 */
export const HomeRow = memo(function HomeRow({ rowKey, index, data, actions }: HomeRowProps) {
  const { t } = useTranslation("common");

  if (rowKey === "resume") {
    if (!data.resume.length) return null;
    return (
      <FadeIn delay={homeRowFadeDelay(index)}>
        <MediaRow title={t("resumeWatching")} data={data.resume} renderItem={actions.renderCard} />
      </FadeIn>
    );
  }
  if (rowKey === "nextUp") {
    if (!data.nextUp.length) return null;
    return (
      <FadeIn delay={homeRowFadeDelay(index)}>
        <MediaRow title={t("nextEpisodes")} data={data.nextUp} renderItem={actions.renderCard} />
      </FadeIn>
    );
  }
  if (rowKey === "watchlist") {
    return (
      <FadeIn delay={homeRowFadeDelay(index)}>
        <MyListRow
          personalItems={data.watchlist}
          onSeeAll={() => actions.onSeeAll("/watchlist")}
          onItemPress={actions.onItemPress}
          onItemLongPress={actions.onItemLongPress}
        />
      </FadeIn>
    );
  }
  if (rowKey === "watched") return <HomeWatchedRow index={index} renderCard={actions.renderCard} />;
  if (rowKey === "favorites") {
    return (
      <HomeFavoritesRow index={index} renderCard={actions.renderCard} onSeeAll={() => actions.onSeeAll("/favorites")} />
    );
  }
  if (rowKey.startsWith("library:")) {
    const lib = data.librariesById.get(rowKey.slice("library:".length));
    if (!lib) return null;
    return (
      <HomeLibraryRow
        libraryId={lib.id}
        libraryName={lib.name}
        collectionType={lib.collectionType}
        renderCard={actions.renderCard}
        index={lib.index}
      />
    );
  }
  return null;
});
