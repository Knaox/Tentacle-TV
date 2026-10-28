/**
 * Octave mobile — la BIBLIOTHÈQUE, comme le bureau : Albums (triables, le tri
 * retenu sur l'appareil), Artistes, Playlists, par puces (dans l'adresse,
 * `?tab=`), en grilles virtualisées qui chargent la page suivante à l'approche
 * du bas. En tête, l'accès aux Titres likés. Téléphone : 2 colonnes (3 pour
 * les artistes) ; tablette : autant que la largeur en tient.
 */

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Heart, Library } from "lucide-react-native";
import { useMusicAlbums, useMusicArtists, useMusicPlaylists } from "@tentacle-tv/api-client";
import { LIBRARY_ALBUM_SORT_KEY, parseAlbumSort, parseLibraryTab, type LibraryAlbumSort, type LibraryTab } from "@tentacle-tv/shared/octave";
import type { MusicAlbum, MusicArtist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { OctaveTopBar } from "../../layout/OctaveTopBar";
import { useOctavePageScroll } from "../../layout/useOctavePageScroll";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useOctaveNav } from "../env/nav";
import { useDeviceStore } from "../env/pagesEnv";
import { AlbumCard, ArtistCard, PlaylistCard } from "../ui/Cards";
import { ShelfSkeleton } from "../ui/Shelf";
import { EmptyState, ErrorState } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { LibraryFilterBar, LibrarySortControl } from "./LibraryFilterBar";
import { OctaveBrandFill } from "../../layout/OctaveBrandFill";
import { useFirstEnter } from "../../layout/enterMotion";
import { clipsOffscreenCells } from "../../layout/listClipping";

type Item = { kind: "album"; album: MusicAlbum } | { kind: "artist"; artist: MusicArtist } | { kind: "playlist"; playlist: MusicPlaylist };

const keyOf = (i: Item) => (i.kind === "album" ? i.album.key : i.kind === "artist" ? i.artist.key : i.playlist.jellyfinId);

function LikedEntry() {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const nav = useOctaveNav();
  return (
    <Pressable onPress={nav.liked} accessibilityRole="button" style={({ pressed }) => [styles.liked, { backgroundColor: pressed ? theme.colors.fill.soft : theme.colors.fill.faint }]}>
      <View style={styles.likedIcon}>
        <OctaveBrandFill radius={10} />
        <Heart size={20} color={theme.colors.cta.brandFg} fill={theme.colors.cta.brandFg} />
      </View>
      <Text style={[typography.bodyBold, { color: theme.colors.text.primary, flex: 1 }]}>{t("liked.title")}</Text>
      <ChevronRight size={18} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

export function OctaveLibraryScreen() {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const { scrollY, scrollProps } = useOctavePageScroll();
  const router = useRouter();
  const store = useDeviceStore();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = parseLibraryTab(Array.isArray(params.tab) ? params.tab[0] : params.tab);
  const setTab = useCallback((next: LibraryTab) => router.setParams({ tab: next === "albums" ? undefined : next }), [router]);
  const [sort, setSortState] = useState<LibraryAlbumSort>(() => parseAlbumSort(store.getItem(LIBRARY_ALBUM_SORT_KEY)));
  const setSort = useCallback(
    (next: LibraryAlbumSort) => {
      setSortState(next);
      store.setItem(LIBRARY_ALBUM_SORT_KEY, next);
    },
    [store],
  );
  const { gutter, isTablet, contentWidth } = usePageMetrics();
  const albums = useMusicAlbums({ sort, enabled: tab === "albums" });
  const artists = useMusicArtists({ enabled: tab === "artists" });
  const playlists = useMusicPlaylists();

  const query = tab === "albums" ? albums : tab === "artists" ? artists : null;
  const items = useMemo<Item[]>(() => {
    if (tab === "albums") return (albums.data?.pages ?? []).flatMap((p) => p.items).map((album) => ({ kind: "album", album }));
    if (tab === "artists") return (artists.data?.pages ?? []).flatMap((p) => p.items).map((artist) => ({ kind: "artist", artist }));
    return (playlists.data ?? []).map((playlist) => ({ kind: "playlist", playlist }));
  }, [tab, albums.data, artists.data, playlists.data]);
  const pending = tab === "playlists" ? playlists.isPending : !!query?.isPending;
  const failed = tab === "playlists" ? playlists.isError : !!query?.isError;

  const target = tab === "artists" ? (isTablet ? 150 : 104) : isTablet ? 180 : 150;
  const columns = Math.max(tab === "artists" ? 3 : 2, Math.floor((contentWidth - gutter * 2) / target));
  const cell = Math.floor((contentWidth - (gutter - 6) * 2) / columns - 12);
  const enterOnce = useFirstEnter(`${tab}:${columns}`);
  const more = useCallback(() => {
    if (query?.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const header = (
    <View style={{ paddingHorizontal: gutter, gap: 16, paddingBottom: 12 }}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[typography.hero, styles.title, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {t("library.title")}
        </Text>
        {tab === "albums" ? <LibrarySortControl sort={sort} onSort={setSort} /> : null}
      </View>
      <LikedEntry />
      <LibraryFilterBar tab={tab} onTab={setTab} />
    </View>
  );
  const empty = pending ? <ShelfSkeleton round={tab === "artists"} /> : failed ? <ErrorState onRetry={() => void (query ? query.refetch() : playlists.refetch())} /> : <EmptyState icon={Library} title={t("views.libraryEmptyTitle")} hint={t("views.libraryEmptyHint")} />;

  return (
    <View style={{ flex: 1 }}>
      <Animated.FlatList
        {...scrollProps}
        key={`${tab}:${columns}`}
        data={items}
        keyExtractor={keyOf}
        numColumns={columns}
        columnWrapperStyle={{ paddingHorizontal: gutter - 6 }}
        renderItem={({ item, index }) => (
          // Un changement d'onglet remonte la grille (clé) : ses premières cartes arrivent l'une après l'autre.
          <Animated.View entering={enterOnce(keyOf(item), index)} style={{ width: `${100 / columns}%`, padding: 6 }}>
            {item.kind === "album" ? <AlbumCard album={item.album} width={cell} /> : item.kind === "artist" ? <ArtistCard artist={item.artist} width={cell} /> : <PlaylistCard playlist={item.playlist} width={cell} />}
          </Animated.View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={query?.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 20 }} /> : null}
        onEndReached={more}
        onEndReachedThreshold={1.2}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={clipsOffscreenCells(Platform.OS)}
      />
      <OctaveTopBar scrollY={scrollY} title={t("library.title")} back={false} />
      <OctavePagesHost />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, minWidth: 0 },
  liked: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, borderRadius: 14, paddingHorizontal: 12 },
  likedIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
