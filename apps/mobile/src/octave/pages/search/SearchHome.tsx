/**
 * Octave mobile — la recherche AVANT la frappe, comme le bureau : les
 * ambiances, l'historique (recherches récentes, titres récemment recherchés :
 * `RecentSearchHistory`), les albums consultés récemment et les artistes
 * récents, puis « Déjà écouté » (ce qu'on a écouté après ses recherches). Lu
 * UNE fois à l'arrivée (`useSearchHomeSnapshot`) : rien ne se réordonne sous
 * les yeux.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSearchHomeSnapshot, type OctaveSearchHistory } from "@tentacle-tv/api-client";
import { typography, useTheme } from "@/theme";
import { useDeviceStore, useOctaveOwner } from "../env/pagesEnv";
import { AlbumCard, ArtistCard } from "../ui/Cards";
import { SectionTitle, Shelf, albumSelf } from "../ui/Shelf";
import { usePageMetrics } from "../ui/pageStyle";
import { ListenedCard } from "./ListenedCard";
import { MoodChips } from "./MoodChips";
import { RecentSearchHistory } from "./RecentSearchHistory";

interface SearchHomeProps {
  recents: readonly string[];
  history: OctaveSearchHistory;
  onSearch: (text: string) => void;
}

export const SearchHome = memo(function SearchHome({ recents, history, onSearch }: SearchHomeProps) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const { gutter, sectionGap, isTablet } = usePageMetrics();
  const { cards, shelves } = useSearchHomeSnapshot(recents, useDeviceStore(), useOctaveOwner());
  const nothing = cards.length === 0 && recents.length === 0 && history.history.tracks.length === 0 && shelves.albums.length === 0 && shelves.artists.length === 0;
  return (
    <View style={{ gap: sectionGap }}>
      <MoodChips gutter={gutter} />
      {nothing ? (
        <View style={{ paddingHorizontal: gutter, gap: 6 }}>
          <Text style={[typography.title, { color: theme.colors.text.primary }]}>{t("search.emptyTitle")}</Text>
        </View>
      ) : null}
      <RecentSearchHistory recents={recents} history={history} onSearch={onSearch} />
      <Shelf title={t("octaveHome.viewedAlbums")} items={shelves.albums} keyOf={(a) => a.key} albumOf={albumSelf} render={(album, w) => <AlbumCard album={album} width={w} />} />
      <Shelf title={t("octaveHome.viewedArtists")} items={shelves.artists} keyOf={(a) => a.key} render={(artist, w) => <ArtistCard artist={artist} width={w} />} />
      {cards.length > 0 ? (
        <View>
          <SectionTitle title={t("search.listenedTitle")} hint={t("search.listenedHint")} />
          <View style={[styles.cards, { paddingHorizontal: gutter }]}>
            {cards.map((card) => (
              <View key={card.id} style={{ width: isTablet ? "50%" : "100%", padding: 4 }}>
                <ListenedCard card={card} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  cards: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
});
