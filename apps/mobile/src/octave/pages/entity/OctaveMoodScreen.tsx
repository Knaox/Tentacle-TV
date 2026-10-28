/**
 * Octave mobile — une AMBIANCE, comme le bureau : sa tête à sa couleur, ses
 * titres (ce que la bibliothèque a, montré et joué comme le sien, compté), et
 * d'autres playlists de l'ambiance. Sans extension qui les sert : « introuvable »,
 * sans rien trahir.
 */

import { useCallback, useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { moodContextId, ownedCount, useMusicMoodMix, useOwnedTracks } from "@tentacle-tv/api-client";
import { queueActions } from "@tentacle-tv/shared/octave";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { usePagesCurrentKey, usePagesPlayer } from "../env/pagesPlayer";
import { PAGE_BOTTOM_ROOM } from "../home/OctaveHomeScreen";
import { ExternalPlaylistCard } from "../ui/Cards";
import { Shelf } from "../ui/Shelf";
import { TrackRow } from "../ui/TrackRow";
import { ErrorState, TrackRowsSkeleton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { CollectionHeader, MetaLine } from "./CollectionHeader";
import { PageTopBar } from "./PageTopBar";
import { useCountAndDuration } from "./useCountAndDuration";

const NO_TRACKS: MusicTrack[] = [];

export function OctaveMoodScreen({ id }: { id: string }) {
  const { t, i18n } = useTranslation("music");
  const insets = useSafeAreaInsets();
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const { gutter, sectionGap } = usePageMetrics();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const mix = useMusicMoodMix(useOctavePagesProvider(), id, i18n.language);
  const { tracks } = useOwnedTracks(mix.data?.tracks ?? NO_TRACKS);
  const contextId = moodContextId(id);
  const play = useCallback((index: number) => player?.playList(tracks, index, contextId), [contextId, player, tracks]);
  const meta = useCountAndDuration(tracks.length, tracks.reduce((s, x) => s + (x.durationMs ?? 0), 0));
  const owned = useMemo(() => ownedCount(tracks), [tracks]);

  if (mix.isError || (!mix.isPending && !mix.data)) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 60 }}>
        <ErrorState onRetry={() => void mix.refetch()} message={t("moods.notFound")} />
        <PageTopBar title="" scrollY={scrollY} threshold={9999} />
      </View>
    );
  }
  const data = mix.data;
  const header = (
    <View>
      {data ? (
        <CollectionHeader
          kicker={t("moods.kicker")}
          title={data.mood.name}
          artworkUrl={data.artworkUrl ?? data.mood.artworkUrl}
          tint={data.mood.color}
          scrollY={scrollY}
          canPlay={tracks.length > 0}
          onPlay={() => player?.playList(tracks, 0, contextId)}
          onShuffle={() => player && queueActions.playShuffled(player, tracks, contextId)}
          meta={<MetaLine parts={[meta, owned > 0 && t("moods.inLibrary", { count: owned })]} />}
        />
      ) : (
        <View style={{ height: insets.top + 400 }} />
      )}
      {!data ? <TrackRowsSkeleton count={8} gutter={gutter} /> : null}
    </View>
  );
  const footer = data?.playlists?.length ? (
    <View style={{ marginTop: sectionGap }}>
      <Shelf title={t("moods.morePlaylists")} items={data.playlists} keyOf={(p) => p.key} render={(p, w) => <ExternalPlaylistCard playlist={p} width={w} />} />
    </View>
  ) : null;
  return (
    <View style={{ flex: 1 }}>
      <Animated.FlatList
        data={tracks as MusicTrack[]}
        keyExtractor={(track) => track.key}
        renderItem={({ item, index }) => <TrackRow track={item} index={index} list={tracks} contextId={contextId} playing={current === item.key} onPlay={play} gutter={gutter} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + PAGE_BOTTOM_ROOM }}
        initialNumToRender={12}
        windowSize={9}
        removeClippedSubviews
      />
      <PageTopBar title={data?.mood.name ?? ""} scrollY={scrollY} threshold={320} />
      <OctavePagesHost />
    </View>
  );
}
