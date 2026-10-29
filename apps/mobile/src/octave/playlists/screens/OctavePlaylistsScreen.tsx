/**
 * Octave mobile — « Playlists » : « Titres likés » en tête, puis les playlists du compte (téléphone : des
 * rangées ; tablette : une grille de pochettes). « + » crée, « Importer » colle un lien (Spotify, Apple
 * Music, Deezer, ou le lien d'un ami sur SON Tentacle). Une playlist modifiable se gère au « ⋯ » ou à l'appui
 * maintenu. La liste suit les autres appareils en direct (`music:playlist`).
 */

import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Heart, ListMusic, MoreHorizontal, Plus } from "lucide-react-native";
import { useMusicImport, useMusicPending, useMusicPlaylists } from "@tentacle-tv/api-client";
import { playlistTrackTotal } from "@tentacle-tv/shared/octave";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { typography } from "@/theme";
import { haptic } from "@/utils/haptics";
import { OctaveLargeTitle, OctaveTopBar, PressableScale, useOctaveColors, useOctaveLayout, useOctavePageScroll } from "../../layout";
import { LibraryPlaylistArtwork, OctavePagesHost, useOctavePagesProvider } from "../../pages";
import { useOctaveNav } from "../../pages/env/nav";
import { EmptyState, ErrorState, PillButton, TrackRowsSkeleton } from "../../pages/ui/ViewStates";
import { openPlaylistSheet } from "../sheets/playlistSheetStore";
import { GlassIconButton, GlassTextButton } from "./BarButtons";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { OfflineMissingState } from "../../offline/OfflinePageFallback";
import { SharedMark } from "../members/SharedMark";

type Item = { kind: "liked" } | { kind: "playlist"; playlist: MusicPlaylist };

export function OctavePlaylistsScreen() {
  const { t } = useTranslation("music");
  const { t: ti } = useTranslation("musicImport");
  const { t: tl } = useTranslation("musicLists");
  const colors = useOctaveColors();
  const layout = useOctaveLayout();
  const nav = useOctaveNav();
  const playlists = useMusicPlaylists();
  const importable = useMusicImport(useOctavePagesProvider()).available;
  const offline = useOfflineMode();
  // Les ajouts hors bibliothèque en attente comptent, comme sur la page de la playlist.
  const pending = useMusicPending(useOctavePagesProvider()).data.items;
  const totalOf = useCallback((p: MusicPlaylist) => playlistTrackTotal(p.trackCount, pending, p.jellyfinId), [pending]);
  const { scrollY, scrollProps } = useOctavePageScroll();
  const columns = layout.isTablet ? layout.columns(180) : 1;
  const items = useMemo<Item[]>(() => [{ kind: "liked" }, ...(playlists.data ?? []).map((playlist) => ({ kind: "playlist" as const, playlist }))], [playlists.data]);
  const manage = useCallback((playlist: MusicPlaylist) => {
    // Une playlist qu'on m'a partagée : ses personnes (et « Quitter ») ; la mienne : la gérer.
    const member = playlist.sharing?.role === "member";
    if (!playlist.editable && !member) return;
    haptic("longPress");
    openPlaylistSheet(member ? { kind: "members", playlist } : { kind: "manage", playlist });
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: Item }) => {
      if (item.kind === "liked") {
        return (
          <Pressable onPress={nav.liked} accessibilityRole="button" style={({ pressed }) => [styles.row, { paddingHorizontal: layout.gutter, backgroundColor: pressed ? colors.pressed : "transparent" }]}>
            <LinearGradient colors={colors.gradient as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likedTile}>
              <Heart size={24} color="#fff" fill="#fff" />
            </LinearGradient>
            <View style={styles.rowText}>
              <Text numberOfLines={1} style={[typography.bodyBold, { color: colors.text }]}>{t("liked.title")}</Text>
              <Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>{t("liked.kicker")}</Text>
            </View>
          </Pressable>
        );
      }
      const p = item.playlist;
      return (
        <Pressable
          onPress={() => nav.playlist(p.jellyfinId)}
          onLongPress={() => manage(p)}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityHint={t("count.tracks", { count: totalOf(p) })}
          style={({ pressed }) => [styles.row, { paddingHorizontal: layout.gutter, backgroundColor: pressed ? colors.pressed : "transparent" }]}
        >
          <LibraryPlaylistArtwork playlist={p} size={56} radius={8} />
          <View style={styles.rowText}>
            <Text numberOfLines={1} style={[typography.bodyBold, { color: colors.text }]}>{p.name}</Text>
            <Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>{t("count.tracks", { count: totalOf(p) })}</Text>
          </View>
          <SharedMark playlist={p} />
          {p.editable || p.sharing?.role === "member" ? (
            <Pressable onPress={() => manage(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("playlistManage.more", { name: p.name })} style={styles.more}>
              <MoreHorizontal size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </Pressable>
      );
    },
    [colors, layout.gutter, manage, nav, t, totalOf],
  );

  const renderCard = useCallback(
    ({ item }: { item: Item }) => {
      const width = layout.itemWidth(columns);
      const isLiked = item.kind === "liked";
      const name = isLiked ? t("liked.title") : item.playlist.name;
      return (
        <PressableScale
          onPress={() => (isLiked ? nav.liked() : nav.playlist(item.playlist.jellyfinId))}
          onLongPress={isLiked ? undefined : () => manage(item.playlist)}
          accessibilityLabel={name}
          style={[styles.card, { width }]}
        >
          {isLiked ? (
            <LinearGradient colors={colors.gradient as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardTile, { width, height: width }]}>
              <Heart size={Math.round(width * 0.3)} color="#fff" fill="#fff" />
            </LinearGradient>
          ) : (
            <View>
              <LibraryPlaylistArtwork playlist={item.playlist} size={width} radius={12} />
              <SharedMark playlist={item.playlist} overlay />
            </View>
          )}
          <Text numberOfLines={1} style={[typography.bodyBold, { color: colors.text, marginTop: 8 }]}>{name}</Text>
          {!isLiked ? <Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>{t("count.tracks", { count: totalOf(item.playlist) })}</Text> : null}
        </PressableScale>
      );
    },
    [colors, columns, layout, manage, nav, t, totalOf],
  );

  const actions = (
    <View style={styles.actions}>
      {importable && !offline ? <GlassTextButton label={ti("entryShort")} onPress={() => openPlaylistSheet({ kind: "import" })} /> : null}
      {/* Importer, créer : le serveur seul le sait faire — hors ligne, ces entrées n'existent pas. */}
      {offline ? null : <GlassIconButton icon={Plus} label={tl("newTitle")} onPress={() => openPlaylistSheet({ kind: "create" })} />}
    </View>
  );

  // Hors ligne sans liste gardée : le dire, jamais une attente ni un « Réessayer ».
  const empty = offline && (playlists.data ?? []).length === 0 ? (
    <OfflineMissingState />
  ) : playlists.isPending ? (
    <TrackRowsSkeleton count={6} gutter={layout.gutter} />
  ) : playlists.isError ? (
    <ErrorState onRetry={() => void playlists.refetch()} />
  ) : (playlists.data ?? []).length === 0 ? (
    <EmptyState icon={ListMusic} title={t("views.playlistsEmptyTitle")} hint={t("views.playlistsEmptyHint")} action={<PillButton label={tl("newTitle")} icon={Plus} onPress={() => openPlaylistSheet({ kind: "create" })} />} />
  ) : null;

  return (
    <View style={[styles.page, { backgroundColor: colors.ink }]}>
      <Animated.FlatList
        key={`cols-${columns}`}
        {...scrollProps}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => (item.kind === "liked" ? "liked" : item.playlist.jellyfinId)}
        renderItem={columns > 1 ? renderCard : renderRow}
        columnWrapperStyle={columns > 1 ? { gap: layout.gap, paddingHorizontal: layout.gutter, marginBottom: layout.gap } : undefined}
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
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  likedTile: { width: 56, height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: {},
  cardTile: { borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
