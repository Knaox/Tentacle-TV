/**
 * Octave mobile — « Playlists » : « Titres likés » en tête, puis les playlists du compte (téléphone : des
 * rangées ; tablette : une grille de pochettes). « + » crée, « Importer » colle un lien (Spotify, Apple
 * Music, Deezer, ou le lien d'un ami sur SON Tentacle). « Vos favoris » en tête (celles d'une extension
 * comprises), puis « Toutes les playlists », dans l'ordre personnel (socle partagé `usePlaylistShelf`) ;
 * « ⋯ » et l'appui maintenu ouvrent la feuille d'actions partagée, « Réordonner » passe une section en rangées
 * à poignée. La liste suit les autres appareils en direct (`music:playlist`, `music:shelves`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { ListMusic, Plus } from "lucide-react-native";
import { useMusicImport, useMusicPending, useMusicPlaylists, useMusicShelvesCapability, usePlaylistShelf } from "@tentacle-tv/api-client";
import { playlistTrackTotal } from "@tentacle-tv/shared/octave";
import { shelfPlaylistKey, type MusicShelfPlaylist } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { OctaveLargeTitle, OctaveTopBar, useOctaveColors, useOctaveLayout, useOctavePageScroll } from "../../layout";
import { OctavePagesHost, useOctavePagesProvider } from "../../pages";
import { useOctaveNav } from "../../pages/env/nav";
import { SectionTitle } from "../../pages/ui/Shelf";
import { accentTextOf } from "../../pages/ui/pageStyle";
import { EmptyState, ErrorState, PillButton, TrackRowsSkeleton } from "../../pages/ui/ViewStates";
import { OfflineMissingState } from "../../offline/OfflinePageFallback";
import { hasCollectionActions } from "../../collections/collectionEligibility";
import { openCollectionSheet } from "../../collections/collectionSheetStore";
import { ShelfReorderList } from "../../collections/reorder/ShelfReorderList";
import { buildLibraryRows, type LibraryRow, type LibrarySectionId } from "../../pages/library/libraryRows";
import { takePlaylistsReorder } from "./reorderRequest";
import { useFocusEffect } from "expo-router";
import { useReorderItemOf } from "../../pages/library/LibraryCard";
import { openPlaylistSheet } from "../sheets/playlistSheetStore";
import { GlassIconButton, GlassTextButton } from "./BarButtons";
import { LikedCard, LikedRow, PlaylistEntryCard, PlaylistEntryRow } from "./PlaylistEntryViews";

type Row = { type: "liked"; key: string } | LibraryRow<MusicShelfPlaylist>;
const LIKED: Row = { type: "liked", key: "liked" };

export function OctavePlaylistsScreen() {
  const { t } = useTranslation("music");
  const { t: ti } = useTranslation("musicImport");
  const { t: tl } = useTranslation("musicLists");
  const { t: tf } = useTranslation("musicFavorites");
  const colors = useOctaveColors();
  const theme = useTheme();
  const layout = useOctaveLayout();
  const nav = useOctaveNav();
  const playlists = useMusicPlaylists();
  const shelf = usePlaylistShelf(playlists.data);
  const capable = useMusicShelvesCapability();
  const importable = useMusicImport(useOctavePagesProvider()).available;
  const offline = useOfflineMode();
  // Les ajouts hors bibliothèque en attente comptent, comme sur la page de la playlist.
  const pending = useMusicPending(useOctavePagesProvider()).data.items;
  const subtitleOf = useCallback(
    (e: MusicShelfPlaylist) => (e.kind === "library" ? t("count.tracks", { count: playlistTrackTotal(e.playlist.trackCount, pending, e.playlist.jellyfinId) }) : e.playlist.owner),
    [pending, t],
  );
  const pageScroll = useOctavePageScroll();
  const { scrollY, scrollProps } = pageScroll;
  const columns = layout.isTablet ? layout.columns(180) : 1;
  const [reordering, setReordering] = useState<LibrarySectionId | null>(null);
  useEffect(() => setReordering(null), [offline]);
  // Demandé depuis l'accueil (« Vos playlists favorites » › Réordonner) : la page, montée ou non, s'ouvre sur le tri.
  useFocusEffect(
    useCallback(() => {
      const wanted = takePlaylistsReorder();
      if (wanted) setReordering(wanted);
    }, []),
  );
  const { favorites, rest } = shelf;
  const canReorder = (section: LibrarySectionId) => {
    const list = section === "favorites" ? favorites : rest;
    return !offline && list.length > 1 && shelf.ordered(shelfPlaylistKey(list[0]!));
  };
  const rows = useMemo<Row[]>(() => [LIKED, ...buildLibraryRows({ favorites, rest, columns, keyOf: shelfPlaylistKey })], [favorites, rest, columns]);
  const reorderItemOf = useReorderItemOf();

  const open = (e: MusicShelfPlaylist) => (e.kind === "library" ? nav.playlist(e.playlist.jellyfinId) : nav.externalPlaylist(e.playlist.key));
  const menuOf = (e: MusicShelfPlaylist, section: LibrarySectionId) =>
    hasCollectionActions({ section: "playlists", item: e }, capable)
      ? () => {
          haptic("longPress");
          openCollectionSheet({ subject: { section: "playlists", item: e }, shelf, onReorder: canReorder(section) ? () => setReordering(section) : undefined });
        }
      : undefined;

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.type === "liked") {
      if (columns === 1) return <LikedRow gutter={layout.gutter} onOpen={nav.liked} />;
      return (
        <View style={[styles.cards, { gap: layout.gap, paddingHorizontal: layout.gutter, marginBottom: layout.gap }]}>
          <LikedCard width={layout.itemWidth(columns)} onOpen={nav.liked} />
        </View>
      );
    }
    if (row.type === "title") {
      const reorder = canReorder(row.section) ? (
        <Pressable onPress={() => setReordering(row.section)} hitSlop={8} accessibilityRole="button" style={styles.link}>
          <Text style={[typography.bodyBold, { color: accentTextOf(theme) }]}>{tf("actions.reorder")}</Text>
        </Pressable>
      ) : undefined;
      return <SectionTitle title={row.section === "favorites" ? tf("shelfTitle") : tf("restTitle.playlists")} action={reorder} />;
    }
    if (columns === 1) {
      const e = row.items[0]!;
      return <PlaylistEntryRow entry={e} subtitle={subtitleOf(e)} onOpen={() => open(e)} onMenu={menuOf(e, row.section)} gutter={layout.gutter} />;
    }
    return (
      <View style={[styles.cards, { gap: layout.gap, paddingHorizontal: layout.gutter, marginBottom: layout.gap }]}>
        {row.items.map((e) => (
          <PlaylistEntryCard key={shelfPlaylistKey(e)} entry={e} subtitle={subtitleOf(e)} onOpen={() => open(e)} onMenu={menuOf(e, row.section)} width={layout.itemWidth(columns)} />
        ))}
      </View>
    );
  };

  const actions = (
    <View style={styles.actions}>
      {importable && !offline ? <GlassTextButton label={ti("entryShort")} onPress={() => openPlaylistSheet({ kind: "import" })} /> : null}
      {/* Importer, créer : le serveur seul le sait faire — hors ligne, ces entrées n'existent pas. */}
      {offline ? null : <GlassIconButton icon={Plus} label={tl("newTitle")} onPress={() => openPlaylistSheet({ kind: "create" })} />}
    </View>
  );

  if (reordering) {
    const list = reordering === "favorites" ? favorites : rest;
    return (
      <View style={[styles.page, { backgroundColor: colors.ink }]}>
        <ShelfReorderList
          items={list.map((e) => reorderItemOf({ kind: "playlist", entry: e }, shelfPlaylistKey(e)))}
          title={reordering === "favorites" ? tf("shelfTitle") : tf("restTitle.playlists")}
          gutter={layout.gutter}
          scroll={pageScroll}
          onMove={shelf.move}
          onDone={() => setReordering(null)}
        />
        <OctaveTopBar scrollY={scrollY} title={t("nav.playlists")} />
        <OctavePagesHost />
      </View>
    );
  }

  const count = favorites.length + rest.length;
  // Hors ligne sans liste gardée : le dire, jamais une attente ni un « Réessayer ».
  const empty = offline && count === 0 ? (
    <OfflineMissingState />
  ) : playlists.isPending ? (
    <TrackRowsSkeleton count={6} gutter={layout.gutter} />
  ) : playlists.isError ? (
    <ErrorState onRetry={() => void playlists.refetch()} />
  ) : count === 0 ? (
    <EmptyState icon={ListMusic} title={t("views.playlistsEmptyTitle")} hint={t("views.playlistsEmptyHint")} action={<PillButton label={tl("newTitle")} icon={Plus} onPress={() => openPlaylistSheet({ kind: "create" })} />} />
  ) : null;

  return (
    <View style={[styles.page, { backgroundColor: colors.ink }]}>
      <Animated.FlatList
        key={`cols-${columns}`}
        {...scrollProps}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={<OctaveLargeTitle title={t("nav.playlists")} scrollY={scrollY} />}
        ListFooterComponent={empty}
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        windowSize={9}
      />
      <OctaveTopBar scrollY={scrollY} title={t("nav.playlists")} right={actions} />
      <OctavePagesHost />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  cards: { flexDirection: "row" },
  link: { minHeight: 44, justifyContent: "center" },
});
