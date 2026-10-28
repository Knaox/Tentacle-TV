/**
 * Octave mobile — un ARTISTE, comme le bureau : portrait, ses titres phares
 * (cinq, « Afficher plus » pour dix ; la file reprend toujours les dix), puis
 * ses parutions rangées par type (`groupReleases`) en étagères. Un artiste
 * d'ailleurs : ce que la bibliothèque a de lui y est montré et joué comme le
 * sien (`useOwnedTracks`, `useOwnedAlbums`).
 */

import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useMusicArtistEntity, useOwnedAlbums, useOwnedTracks, useRecordMusicVisit } from "@tentacle-tv/api-client";
import { ARTIST_TOP_FOLDED, ARTIST_TOP_MAX, groupReleases, queueActions } from "@tentacle-tv/shared/octave";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { useOctavePageScroll } from "../../layout/useOctavePageScroll";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useDeviceStore, useOctaveOwner, useOctavePagesProvider } from "../env/pagesEnv";
import { usePagesPlayer } from "../env/pagesPlayer";
import { AlbumCard } from "../ui/Cards";
import { SectionTitle, Shelf } from "../ui/Shelf";
import { TrackList } from "../ui/TrackList";
import { ErrorState, TrackRowsSkeleton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { CollectionHeader, MetaLine } from "./CollectionHeader";
import { PageTopBar } from "./PageTopBar";
import { playFrom } from "../env/playFrom";
import { OfflinePageFallback } from "../../offline/OfflinePageFallback";
import { useOfflinePage } from "../../offline/useOfflinePage";
import { AlbumWarmupProvider, useAlbumWarmupPage } from "../env/albumWarmupScope";

const NO_ALBUMS: MusicAlbum[] = [];
const HIDE = { artist: true } as const;

export function OctaveArtistScreen({ id }: { id: string }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const player = usePagesPlayer();
  const { gutter, sectionGap, bottomInset } = usePageMetrics();
  // Le défilement de la coquille (page gardée au lancement) ; la tête de page pose elle-même sa marge du haut.
  const warm = useAlbumWarmupPage();
  const { scrollY, scrollProps } = useOctavePageScroll(warm.motion);
  const artist = useMusicArtistEntity(useOctavePagesProvider(), id);
  useRecordMusicVisit(useDeviceStore(), useOctaveOwner(), "artist", artist.isPlaceholder ? undefined : artist.data);
  const [expanded, setExpanded] = useState(false);
  const shownTop = useMemo(() => (artist.data?.topTracks ?? []).slice(0, ARTIST_TOP_MAX), [artist.data]);
  const { tracks: top } = useOwnedTracks(shownTop);
  const albums = useOwnedAlbums(artist.data?.albums ?? NO_ALBUMS);
  const groups = useMemo(() => groupReleases(albums), [albums]);
  const contextId = `artist:${id}`;
  const playAll = useCallback(() => playFrom(player, top, 0, contextId), [contextId, player, top]);
  const page = useOfflinePage(artist);

  if (page.view === "kept" || page.view === "offlineMissing") return <OfflinePageFallback keptKey={null} />;
  if (page.view === "error") {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 60 }}>
        <ErrorState onRetry={() => void artist.refetch()} message={t("artist.notFound")} />
        <PageTopBar title="" scrollY={scrollY} threshold={9999} />
      </View>
    );
  }
  const data = artist.data;
  const releases = data?.albums?.length ?? 0;
  return (
    <AlbumWarmupProvider scope={warm.scope}>
    <View style={{ flex: 1 }}>
      <Animated.ScrollView onScroll={scrollProps.onScroll} scrollEventThrottle={16} contentOffset={scrollProps.contentOffset} contentContainerStyle={{ paddingBottom: bottomInset }}>
        {data ? (
          <CollectionHeader
            kicker={t("artist.kicker")}
            title={data.name}
            artworkUrl={data.imageUrl}
            round
            scrollY={scrollY}
            canPlay={top.length > 0}
            onPlay={playAll}
            onShuffle={() => player && queueActions.playShuffled(player, top, contextId)}
            meta={releases > 0 ? <MetaLine parts={[t("views.releases", { count: releases })]} /> : undefined}
          />
        ) : (
          <View style={{ height: insets.top + 380 }} />
        )}
        {!data ? <TrackRowsSkeleton count={ARTIST_TOP_FOLDED} gutter={gutter} /> : null}
        <View style={{ gap: sectionGap, marginTop: 12 }}>
          {top.length > 0 ? (
            <Animated.View layout={LinearTransition.springify().damping(20)}>
              <SectionTitle title={t("artist.top")} />
              {/* La file reprend les DIX titres phares, repliés ou non : seul l'affichage se replie. */}
              <TrackList tracks={expanded ? top : top.slice(0, ARTIST_TOP_FOLDED)} queue={top} contextId={contextId} gutter={gutter} hide={HIDE} />
              {top.length > ARTIST_TOP_FOLDED ? (
                <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded }} hitSlop={8} style={{ paddingHorizontal: gutter, paddingVertical: 10 }}>
                  <Text style={[typography.bodyBold, { color: theme.colors.text.secondary }]}>{t(expanded ? "views.showLess" : "views.showMore")}</Text>
                </Pressable>
              ) : null}
            </Animated.View>
          ) : null}
          {groups.map(({ group, albums: shown }) => (
            <Shelf key={group} title={t(`artist.${group}`)} items={shown} keyOf={(a) => a.album.key} albumOf={(a) => a.album} render={({ album }, w) => <AlbumCard album={album} width={w} />} />
          ))}
        </View>
      </Animated.ScrollView>
      <PageTopBar title={data?.name ?? ""} scrollY={scrollY} threshold={320} />
      <OctavePagesHost />
    </View>
    </AlbumWarmupProvider>
  );
}
