import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { TVPosterCard } from "../cards/TVPosterCard";
import { TVEpisodeCard } from "../cards/TVEpisodeCard";
import { TV_POSTER_WIDTH, TV_EPISODE_WIDTH } from "../cards/cardSizes";
import { TVLibraryRow } from "../rows/TVLibraryRow";
import { TVFavoritesRow } from "../rows/TVFavoritesRow";
import { Spacing } from "../../theme/colors";
import { possessiveLibraryName } from "../../utils/libraryLabel";

export interface TVHomeRowData {
  resume?: MediaItem[];
  nextUp?: MediaItem[];
  watchlist?: MediaItem[];
  watched?: MediaItem[];
  librariesById: Map<string, { id: string; name: string; collectionType?: string }>;
}

export interface TVHomeRowHandlers {
  onPlay: (item: MediaItem) => void;
  onDetail: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
  onItemFocus: (item: MediaItem) => void;
  /** Clé de MISE EN PAGE (`resume`, `library:<id>`, `reco:forYou`) — unique
   *  par construction, c'est elle qui sert au défilement vers la rangée. */
  onRowLayout: (key: string, y: number) => void;
  onRowFocus: (key: string) => void;
}

interface TVHomeRowProps {
  rowKey: string;
  data: TVHomeRowData;
  handlers: TVHomeRowHandlers;
}

// Rendus de carte stables (aucune fermeture) : la rangée ne se re-rend pas
// pour une fonction neuve.
const renderPortrait = (item: MediaItem, _i: number, focused: boolean) => (
  <TVPosterCard item={item} focused={focused} />
);
const renderLandscape = (item: MediaItem, _i: number, focused: boolean) => (
  <TVEpisodeCard item={item} focused={focused} />
);

/**
 * LE registre de l'accueil configurable du téléviseur : une clé de rangée →
 * son rendu, miroir de `homeRowRegistry` web. Les rangées historiques gardent
 * leurs cartes (16:9 pour la reprise, les prochains épisodes et le déjà vu,
 * affiches ailleurs) ; « Mes favoris » et « Derniers ajouts » s'alimentent
 * seules (aucune requête si la rangée est éteinte). Clé inconnue → rien,
 * jamais une erreur.
 */
export function TVHomeRow({ rowKey, data, handlers }: TVHomeRowProps) {
  const { t, i18n } = useTranslation("common");
  const { onPlay, onDetail, onLongPress, onItemFocus, onRowLayout, onRowFocus } = handlers;
  const rowProps = {
    style: { marginBottom: Spacing.rowGap },
    onItemFocus: (item: MediaItem) => onItemFocus(item),
    onLayout: (e: { nativeEvent: { layout: { y: number } } }) => onRowLayout(rowKey, e.nativeEvent.layout.y),
    onRowFocus: () => onRowFocus(rowKey),
  };

  if (rowKey === "resume" || rowKey === "nextUp" || rowKey === "watched") {
    const items = data[rowKey];
    if (!items || items.length === 0) return null;
    const title = rowKey === "resume" ? t("resumeWatching") : rowKey === "nextUp" ? t("nextEpisodes") : t("alreadyWatched");
    return (
      <FocusableRow
        title={title}
        data={items}
        renderItem={renderLandscape}
        keyExtractor={(item) => item.Id}
        itemWidth={TV_EPISODE_WIDTH.md}
        onItemPress={onPlay}
        onItemLongPress={onLongPress}
        {...rowProps}
      />
    );
  }
  if (rowKey === "watchlist") {
    if (!data.watchlist || data.watchlist.length === 0) return null;
    return (
      <FocusableRow
        title={t("myList")}
        data={data.watchlist}
        renderItem={renderPortrait}
        keyExtractor={(item) => item.Id}
        itemWidth={TV_POSTER_WIDTH.md}
        onItemPress={onDetail}
        {...rowProps}
      />
    );
  }
  if (rowKey === "favorites") {
    return <TVFavoritesRow renderCard={renderPortrait} onItemPress={onDetail} {...rowProps} />;
  }
  if (rowKey.startsWith("library:")) {
    const lib = data.librariesById.get(rowKey.slice("library:".length));
    if (!lib) return null;
    return (
      <TVLibraryRow
        libraryId={lib.id}
        libraryName={possessiveLibraryName(lib.name, i18n.language)}
        collectionType={lib.collectionType}
        renderCard={renderPortrait}
        onItemPress={onDetail}
        {...rowProps}
      />
    );
  }
  return null;
}
