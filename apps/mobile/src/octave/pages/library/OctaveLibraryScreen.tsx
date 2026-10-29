/**
 * Octave mobile — la BIBLIOTHÈQUE, comme le bureau : Playlists (l'onglet qui
 * l'ouvre, avec « Importer » et « + »), Albums (triables, le tri retenu sur
 * l'appareil), Artistes, par puces (dans l'adresse, `?tab=`), en grilles virtualisées qui chargent la page suivante à l'approche
 * du bas. En tête, l'accès aux Titres likés. Téléphone : 2 colonnes (3 pour
 * les artistes) ; tablette : autant que la largeur en tient. Chaque onglet range « Vos favoris » en tête
 * (socle partagé, `useLibraryShelfView`), puis le reste ; l'appui maintenu d'une carte ouvre sa feuille
 * d'actions, et « Réordonner » (au titre d'une section, ou dans la feuille) passe la section en rangées à
 * poignée (`ShelfReorderList`). Hors ligne, les favoris gardés se lisent ; l'ordre ne se change pas.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Heart, Library, ListMusic } from "lucide-react-native";
import { useMusicAlbums, useMusicArtists, useMusicPlaylists } from "@tentacle-tv/api-client";
import { LIBRARY_ALBUM_SORT_KEY, MOBILE_LIBRARY_DEFAULT_TAB, mobileLibraryTabParam, parseAlbumSort, parseLibraryTab, type LibraryAlbumSort, type LibraryTab } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { OctaveTopBar } from "../../layout/OctaveTopBar";
import { useOctavePageScroll } from "../../layout/useOctavePageScroll";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useOctaveNav } from "../env/nav";
import { useDeviceStore } from "../env/pagesEnv";
import { SectionTitle, ShelfSkeleton } from "../ui/Shelf";
import { EmptyState, ErrorState } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { LibraryFilterBar, LibrarySortControl } from "./LibraryFilterBar";
import { LibraryPlaylistActions } from "./LibraryPlaylistActions";
import { ImportedShelf, ReleaseEntryButton } from "../../releases";
import { OctaveBrandFill } from "../../layout/OctaveBrandFill";
import { useFirstEnter } from "../../layout/enterMotion";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { OfflineMissingState } from "../../offline/OfflinePageFallback";
import { clipsOffscreenCells } from "../../layout/listClipping";
import { ShelfReorderList } from "../../collections/reorder/ShelfReorderList";
import { LibraryCard, useReorderItemOf } from "./LibraryCard";
import { buildLibraryRows, type LibraryRow, type LibrarySectionId } from "./libraryRows";
import { useLibraryShelfView, type LibraryItem } from "./useLibraryShelfView";

const rowKey = (r: LibraryRow<LibraryItem>) => r.key;

/** « Réordonner » au titre d'une section : la commande visible du glisser (jamais un geste seul). */
function ReorderLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation("musicFavorites");
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.reorderLink}>
      <Text style={[typography.bodyBold, { color: theme.colors.brand.accentLight }]}>{t("actions.reorder")}</Text>
    </Pressable>
  );
}

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
  const { t: tf } = useTranslation("musicFavorites");
  const pageScroll = useOctavePageScroll();
  const { scrollY, scrollProps } = pageScroll;
  const router = useRouter();
  const store = useDeviceStore();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = parseLibraryTab(Array.isArray(params.tab) ? params.tab[0] : params.tab, MOBILE_LIBRARY_DEFAULT_TAB);
  const setTab = useCallback((next: LibraryTab) => router.setParams({ tab: mobileLibraryTabParam(next) }), [router]);
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
  const offline = useOfflineMode();

  const query = tab === "albums" ? albums : tab === "artists" ? artists : null;
  const albumList = useMemo(() => (albums.data?.pages ?? []).flatMap((p) => p.items), [albums.data]);
  const artistList = useMemo(() => (artists.data?.pages ?? []).flatMap((p) => p.items), [artists.data]);
  const shelfView = useLibraryShelfView(tab, albumList, artistList, playlists.data);
  const { favorites, rest, keyOf, shelf } = shelfView;
  const itemCount = favorites.length + rest.length;
  // Le mode « Réordonner » d'une section de CET onglet ; changer d'onglet, passer hors ligne le referme.
  const [reordering, setReordering] = useState<LibrarySectionId | null>(null);
  useEffect(() => setReordering(null), [tab, offline]);
  const pending = tab === "playlists" ? playlists.isPending : !!query?.isPending;
  const failed = tab === "playlists" ? playlists.isError : !!query?.isError;

  const target = tab === "artists" ? (isTablet ? 150 : 104) : isTablet ? 180 : 150;
  const columns = Math.max(tab === "artists" ? 3 : 2, Math.floor((contentWidth - gutter * 2) / target));
  const cell = Math.floor((contentWidth - (gutter - 6) * 2) / columns - 12);
  const enterOnce = useFirstEnter(`${tab}:${columns}`);
  const rows = useMemo(() => buildLibraryRows({ favorites, rest, columns, keyOf }), [favorites, rest, columns, keyOf]);
  // L'ordre se règle dans une section ordonnée qui a plus d'un élément (les favoris ; toutes les playlists).
  const canReorder = useCallback(
    (section: LibrarySectionId) => {
      const list = section === "favorites" ? favorites : rest;
      return !offline && list.length > 1 && shelf.ordered(keyOf(list[0]!));
    },
    [favorites, rest, offline, shelf, keyOf],
  );
  const menuFavorites = useMemo(() => ({ shelf, onReorder: canReorder("favorites") ? () => setReordering("favorites") : undefined }), [shelf, canReorder]);
  const menuRest = useMemo(() => ({ shelf, onReorder: canReorder("rest") ? () => setReordering("rest") : undefined }), [shelf, canReorder]);
  const reorderItemOf = useReorderItemOf();
  const more = useCallback(() => {
    if (query?.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const header = (
    <View style={{ paddingHorizontal: gutter, gap: 16, paddingBottom: 12 }}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[typography.hero, styles.title, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {t("library.title")}
        </Text>
        {tab === "albums" ? (
          <>
            {!offline ? <ReleaseEntryButton /> : null}
            <LibrarySortControl sort={sort} onSort={setSort} />
          </>
        ) : tab === "playlists" && !offline ? (
          <LibraryPlaylistActions />
        ) : null}
      </View>
      <LikedEntry />
      <LibraryFilterBar tab={tab} onTab={setTab} />
      {tab === "albums" && !offline ? <ImportedShelf inset={gutter} /> : null}
    </View>
  );
  const empty = itemCount === 0 && offline ? (
    <OfflineMissingState />
  ) : pending ? (
    <ShelfSkeleton round={tab === "artists"} />
  ) : failed ? (
    <ErrorState onRetry={() => void (query ? query.refetch() : playlists.refetch())} />
  ) : tab === "playlists" ? (
    // Aucune playlist : les mots de la page Playlists ; « Importer » et « + » restent à droite du titre.
    <EmptyState icon={ListMusic} title={t("views.playlistsEmptyTitle")} hint={t("views.playlistsEmptyHint")} />
  ) : (
    <EmptyState icon={Library} title={t("views.libraryEmptyTitle")} hint={t("views.libraryEmptyHint")} />
  );

  if (reordering) {
    const list = reordering === "favorites" ? favorites : rest;
    return (
      <View style={{ flex: 1 }}>
        <ShelfReorderList
          items={list.map((item) => reorderItemOf(item, keyOf(item)))}
          title={reordering === "favorites" ? tf("shelfTitle") : tf(`restTitle.${tab}`)}
          gutter={gutter}
          scroll={pageScroll}
          onMove={shelf.move}
          onDone={() => setReordering(null)}
        />
        <OctaveTopBar scrollY={scrollY} title={t("library.title")} back={false} />
        <OctavePagesHost />
      </View>
    );
  }

  const renderRow = ({ item: row, index }: { item: LibraryRow<LibraryItem>; index: number }) => {
    if (row.type === "title") {
      const label = row.section === "favorites" ? tf("shelfTitle") : tf(`restTitle.${tab}`);
      return <SectionTitle title={label} action={canReorder(row.section) ? <ReorderLink onPress={() => setReordering(row.section)} /> : undefined} />;
    }
    const menu = row.section === "favorites" ? menuFavorites : menuRest;
    return (
      <View style={[styles.cardsRow, { paddingHorizontal: gutter - 6 }]}>
        {row.items.map((item, i) => (
          // Un changement d'onglet remonte la grille (clé) : ses premières cartes arrivent l'une après l'autre.
          <Animated.View key={keyOf(item)} entering={enterOnce(keyOf(item), index * columns + i)} style={{ width: `${100 / columns}%`, padding: 6 }}>
            <LibraryCard item={item} width={cell} menu={menu} />
          </Animated.View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.FlatList
        {...scrollProps}
        key={`${tab}:${columns}`}
        data={rows}
        keyExtractor={rowKey}
        renderItem={renderRow}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={query?.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 20 }} /> : null}
        onEndReached={more}
        onEndReachedThreshold={1.2}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
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
  cardsRow: { flexDirection: "row" },
  reorderLink: { minHeight: 44, justifyContent: "center" },
  likedIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
