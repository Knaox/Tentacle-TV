/**
 * Octave mobile — un ALBUM, comme le bureau : pochette, nature, artistes, année,
 * nombre de titres et durée, puis ses titres disque par disque (liste
 * virtualisée, rangées de hauteur fixe), la date complète et le label au dos.
 * Un album d'ailleurs que la bibliothèque a EN ENTIER ouvre la vue de la
 * bibliothèque ; en partie, ses titres présents sont les siens
 * (`useAlbumOwnership`). Ouvert depuis une carte, l'en-tête est là aussitôt.
 */

import { useCallback, useEffect, useMemo } from "react";
import { Platform, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ownedCount, useAlbumOwnership, useMusicAlbumEntity, useRecordMusicVisit } from "@tentacle-tv/api-client";
import { albumPreview, inDiscOrder, longReleaseDate, queueActions } from "@tentacle-tv/shared/octave";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { useOctavePageScroll } from "../../layout/useOctavePageScroll";
import { KeepCollectionButton } from "../../offline/KeepCollectionButton";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useDeviceStore, useOctaveOwner, useOctavePagesProvider } from "../env/pagesEnv";
import { usePagesCurrentKey, usePagesPlayer } from "../env/pagesPlayer";
import { TrackRow } from "../ui/TrackRow";
import { ErrorState, TrackRowsSkeleton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { AlbumNotes } from "./AlbumNotes";
import { CollectionHeader, MetaLine } from "./CollectionHeader";
import { PageTopBar } from "./PageTopBar";
import { useCountAndDuration } from "./useCountAndDuration";
import { playFrom } from "../env/playFrom";
import { clipsOffscreenCells } from "../../layout/listClipping";

type Row = { kind: "disc"; disc: number } | { kind: "track"; track: MusicTrack; index: number };
const HIDE = { album: true } as const;

export function OctaveAlbumScreen({ id }: { id: string }) {
  const { t, i18n } = useTranslation("music");
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const { gutter, bottomInset } = usePageMetrics();
  // Le défilement de la coquille (page gardée au lancement) ; la tête de page pose elle-même sa marge du haut.
  const { scrollY, scrollProps } = useOctavePageScroll();
  const album = useMusicAlbumEntity(useOctavePagesProvider(), id, albumPreview);
  const { ordered, discs } = useMemo(() => inDiscOrder(album.data?.tracks ?? []), [album.data]);
  const ownership = useAlbumOwnership(album.data, ordered, album.isPlaceholder);
  useRecordMusicVisit(useDeviceStore(), useOctaveOwner(), "album", album.isPlaceholder || !ownership.settled || ownership.libraryAlbumId ? undefined : album.data);
  const tracks = ownership.tracks;
  const contextId = `album:${id}`;
  const meta = useCountAndDuration(album.data?.trackCount ?? tracks.length, album.data?.durationMs ?? tracks.reduce((s, x) => s + (x.durationMs ?? 0), 0));
  // Entièrement dans la bibliothèque : la vue de la bibliothèque, à sa place dans l'historique.
  useEffect(() => {
    if (ownership.libraryAlbumId) router.replace(octavePaths.album(ownership.libraryAlbumId) as never);
  }, [ownership.libraryAlbumId, router]);
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    tracks.forEach((track, index) => {
      if (discs.length > 1 && (index === 0 || tracks[index - 1]?.discNumber !== track.discNumber)) out.push({ kind: "disc", disc: track.discNumber ?? 1 });
      out.push({ kind: "track", track, index });
    });
    return out;
  }, [discs.length, tracks]);
  const play = useCallback((index: number) => playFrom(player, tracks, index, contextId), [contextId, player, tracks]);

  if (album.isError || (!album.isPending && !album.data)) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 60 }}>
        <ErrorState onRetry={() => void album.refetch()} message={t("album.notFound")} />
        <PageTopBar title="" scrollY={scrollY} threshold={9999} />
      </View>
    );
  }
  const data = album.data;
  const preview = album.isPending || album.isPlaceholder || !ownership.settled;
  const elsewhere = data?.jellyfinId === null;
  const owned = elsewhere ? ownedCount(tracks) : 0;
  const year = data ? (data.year != null ? String(data.year) : (data.releaseDate?.slice(0, 4) ?? null)) : null;
  const date = data ? longReleaseDate(data.releaseDate ?? null, i18n.language) : null;

  const header = (
    <View>
      {data ? (
        <CollectionHeader
          kicker={t(`album.kind.${data.kind}`)}
          title={data.title}
          artworkUrl={data.artworkUrl}
          scrollY={scrollY}
          canPlay={tracks.length > 0}
          onPlay={() => playFrom(player, tracks, 0, contextId)}
          onShuffle={() => player && queueActions.playShuffled(player, tracks, contextId)}
          extra={preview ? undefined : <KeepCollectionButton kind="album" collectionKey={data.key} title={data.title} subtitle={data.artists.map((a) => a.name).join(", ") || null} tracks={tracks} />}
          meta={
            <MetaLine
              parts={[data.artists.map((a) => a.name).join(", "), year, !preview && meta, !preview && owned > 0 && t("availability.albumCoverage", { count: owned, total: tracks.length })]}
            />
          }
        />
      ) : (
        <View style={{ height: insets.top + 400 }} />
      )}
      {preview ? <TrackRowsSkeleton count={Math.min(12, data?.trackCount ?? 8)} gutter={gutter} /> : null}
    </View>
  );
  const footer =
    !preview && data ? (
      <View>
        {date || data.label ? (
          <View style={{ paddingHorizontal: gutter, paddingTop: 20, gap: 2 }}>
            {date ? <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("views.released", { date })}</Text> : null}
            {data.label ? <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>℗ {data.label}</Text> : null}
          </View>
        ) : null}
        <AlbumNotes album={data} gutter={gutter} />
      </View>
    ) : null;

  return (
    <View style={{ flex: 1 }}>
      <Animated.FlatList
        data={preview ? [] : rows}
        keyExtractor={(r) => (r.kind === "disc" ? `disc:${r.disc}` : r.track.key)}
        renderItem={({ item }) =>
          item.kind === "disc" ? (
            <Text style={[typography.bodyBold, { color: theme.colors.text.secondary, paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 6 }]}>{t("album.disc", { number: item.disc })}</Text>
          ) : (
            <TrackRow track={item.track} index={item.index} list={tracks} contextId={contextId} playing={current === item.track.key} onPlay={play} numbered gutter={gutter} hide={HIDE} />
          )
        }
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onScroll={scrollProps.onScroll}
        scrollEventThrottle={16}
        contentOffset={scrollProps.contentOffset}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        initialNumToRender={14}
        windowSize={9}
        removeClippedSubviews={clipsOffscreenCells(Platform.OS)}
      />
      <PageTopBar title={data?.title ?? ""} scrollY={scrollY} threshold={320} />
      <OctavePagesHost />
    </View>
  );
}
