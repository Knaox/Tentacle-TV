import { useCallback } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { TVPosterCard } from "../cards/TVPosterCard";
import { TVEpisodeCard } from "../cards/TVEpisodeCard";
import { TV_POSTER_WIDTH, TV_EPISODE_WIDTH } from "../cards/cardSizes";
import { TVLibraryRow } from "../rows/TVLibraryRow";
import { Spacing } from "../../theme/colors";
import { possessiveLibraryName } from "../../utils/libraryLabel";

interface LibrarySummary {
  Id: string;
  Name: string;
  CollectionType?: string;
}

interface TVHomeRowsProps {
  resume?: MediaItem[];
  nextUp?: MediaItem[];
  watchlist?: MediaItem[];
  watched?: MediaItem[];
  libraries?: readonly LibrarySummary[];
  onPlay: (item: MediaItem) => void;
  onDetail: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
  onItemFocus: (item: MediaItem) => void;
  onWrapperLayout: (y: number) => void;
  onRowLayout: (key: string, y: number) => void;
  onRowFocus: (key: string) => void;
}

/**
 * Les rangées de l'accueil — ordre et libellés du web (`Home.tsx`) : Reprendre,
 * Prochains épisodes, Ma liste, Déjà vu, puis « Derniers ajouts de … » par
 * bibliothèque. Extraites de `HomeScreen` pour le budget de 300 lignes.
 *
 * AUCUN chevauchement avec la bannière : la référence l'a supprimé (le `-mt-12`
 * web masquait la couture d'une bannière à fond perdu, qui n'existe plus — la
 * carte porte son écart bas). Chaque rangée garde sa marge BASSE (web `mb-10`).
 */
export function TVHomeRows({
  resume,
  nextUp,
  watchlist,
  watched,
  libraries,
  onPlay,
  onDetail,
  onLongPress,
  onItemFocus,
  onWrapperLayout,
  onRowLayout,
  onRowFocus,
}: TVHomeRowsProps) {
  const { t, i18n } = useTranslation("common");

  const renderPortrait = useCallback(
    (item: MediaItem, _i: number, focused: boolean) => (
      <TVPosterCard item={item} focused={focused} />
    ),
    [],
  );
  const renderLandscape = useCallback(
    (item: MediaItem, _i: number, focused: boolean) => (
      <TVEpisodeCard item={item} focused={focused} />
    ),
    [],
  );

  return (
    <View onLayout={(e) => onWrapperLayout(e.nativeEvent.layout.y)}>
      {resume && resume.length > 0 && (
        <FocusableRow
          title={t("resumeWatching")}
          data={resume}
          renderItem={renderLandscape}
          keyExtractor={(item) => item.Id}
          itemWidth={TV_EPISODE_WIDTH.md}
          style={{ marginBottom: Spacing.rowGap }}
          onItemPress={onPlay}
          onItemLongPress={onLongPress}
          onItemFocus={(item) => onItemFocus(item)}
          onLayout={(e) => onRowLayout("resume", e.nativeEvent.layout.y)}
          onRowFocus={() => onRowFocus("resume")}
        />
      )}

      {nextUp && nextUp.length > 0 && (
        <FocusableRow
          title={t("nextEpisodes")}
          data={nextUp}
          renderItem={renderLandscape}
          keyExtractor={(item) => item.Id}
          itemWidth={TV_EPISODE_WIDTH.md}
          style={{ marginBottom: Spacing.rowGap }}
          onItemPress={onPlay}
          onItemLongPress={onLongPress}
          onItemFocus={(item) => onItemFocus(item)}
          onLayout={(e) => onRowLayout("nextUp", e.nativeEvent.layout.y)}
          onRowFocus={() => onRowFocus("nextUp")}
        />
      )}

      {watchlist && watchlist.length > 0 && (
        <FocusableRow
          title={t("myList")}
          data={watchlist}
          renderItem={renderPortrait}
          keyExtractor={(item) => item.Id}
          itemWidth={TV_POSTER_WIDTH.md}
          style={{ marginBottom: Spacing.rowGap }}
          onItemPress={onDetail}
          onItemFocus={(item) => onItemFocus(item)}
          onLayout={(e) => onRowLayout("watchlist", e.nativeEvent.layout.y)}
          onRowFocus={() => onRowFocus("watchlist")}
        />
      )}

      {/* « Déjà regardés » (16:9), comme le web */}
      {watched && watched.length > 0 && (
        <FocusableRow
          title={t("alreadyWatched")}
          data={watched}
          renderItem={renderLandscape}
          keyExtractor={(item) => item.Id}
          itemWidth={TV_EPISODE_WIDTH.md}
          style={{ marginBottom: Spacing.rowGap }}
          onItemPress={onPlay}
          onItemLongPress={onLongPress}
          onItemFocus={(item) => onItemFocus(item)}
          onLayout={(e) => onRowLayout("watched", e.nativeEvent.layout.y)}
          onRowFocus={() => onRowFocus("watched")}
        />
      )}

      {(libraries ?? []).map((lib) => (
        <TVLibraryRow
          key={lib.Id}
          libraryId={lib.Id}
          libraryName={possessiveLibraryName(lib.Name, i18n.language)}
          collectionType={lib.CollectionType}
          renderCard={renderPortrait}
          onItemPress={onDetail}
          onItemFocus={(item) => onItemFocus(item)}
          onLayout={(e) => onRowLayout(`lib_${lib.Id}`, e.nativeEvent.layout.y)}
          onRowFocus={() => onRowFocus(`lib_${lib.Id}`)}
        />
      ))}
    </View>
  );
}
