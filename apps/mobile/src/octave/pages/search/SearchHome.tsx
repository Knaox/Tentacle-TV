/**
 * Octave mobile — la recherche AVANT la frappe, comme le bureau : les
 * ambiances, les albums consultés récemment et les artistes récents, « Déjà
 * écouté » (ce qu'on a écouté après ses recherches), puis les recherches
 * récentes (relancer, retirer). Lu UNE fois à l'arrivée
 * (`useSearchHomeSnapshot`) : rien ne se réordonne sous les yeux.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Clock, X } from "lucide-react-native";
import { useSearchHomeSnapshot } from "@tentacle-tv/api-client";
import { typography, useTheme } from "@/theme";
import { useDeviceStore, useOctaveOwner } from "../env/pagesEnv";
import { AlbumCard, ArtistCard } from "../ui/Cards";
import { SectionTitle, Shelf, albumSelf } from "../ui/Shelf";
import { usePageMetrics } from "../ui/pageStyle";
import { ListenedCard } from "./ListenedCard";
import { MoodChips } from "./MoodChips";

interface SearchHomeProps {
  recents: readonly string[];
  onSearch: (text: string) => void;
  onForget: (text: string) => void;
}

export const SearchHome = memo(function SearchHome({ recents, onSearch, onForget }: SearchHomeProps) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const { gutter, sectionGap, isTablet } = usePageMetrics();
  const { cards, shelves } = useSearchHomeSnapshot(recents, useDeviceStore(), useOctaveOwner());
  const nothing = cards.length === 0 && recents.length === 0 && shelves.albums.length === 0 && shelves.artists.length === 0;
  return (
    <View style={{ gap: sectionGap }}>
      <MoodChips gutter={gutter} />
      {nothing ? (
        <View style={{ paddingHorizontal: gutter, gap: 6 }}>
          <Text style={[typography.title, { color: theme.colors.text.primary }]}>{t("search.emptyTitle")}</Text>
        </View>
      ) : null}
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
      {recents.length > 0 ? (
        <View>
          <SectionTitle title={t("search.recentTitle")} />
          {recents.map((query) => (
            <View key={query} style={[styles.recent, { paddingLeft: gutter, paddingRight: gutter - 8 }]}>
              <Pressable onPress={() => onSearch(query)} accessibilityRole="button" style={styles.recentMain}>
                <Clock size={16} color={theme.colors.text.tertiary} />
                <Text numberOfLines={1} style={[typography.body, { color: theme.colors.text.primary, flex: 1 }]}>{query}</Text>
              </Pressable>
              <Pressable onPress={() => onForget(query)} hitSlop={6} style={styles.forget} accessibilityRole="button" accessibilityLabel={t("search.forget", { query })}>
                <X size={16} color={theme.colors.text.tertiary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  cards: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  recent: { flexDirection: "row", alignItems: "center" },
  recentMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  forget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
