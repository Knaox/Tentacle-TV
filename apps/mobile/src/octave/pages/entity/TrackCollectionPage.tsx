/**
 * Octave mobile — une page de COLLECTION DE TITRES venue d'ailleurs (ambiance,
 * playlist d'une extension) : la tête, les titres en liste virtualisée (ce que
 * la bibliothèque a, montré et joué comme le sien : `useOwnedTracks`), un pied
 * libre. L'attente et l'« introuvable » à leur place.
 */

import { useCallback, useMemo, type ReactElement } from "react";
import { Platform, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ownedCount, useOwnedTracks } from "@tentacle-tv/api-client";
import { queueActions } from "@tentacle-tv/shared/octave";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useOctavePageScroll } from "../../layout/useOctavePageScroll";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { usePagesCurrentKey, usePagesPlayer } from "../env/pagesPlayer";
import { TrackRow } from "../ui/TrackRow";
import { ErrorState, TrackRowsSkeleton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { CollectionHeader, MetaLine } from "./CollectionHeader";
import { PageTopBar } from "./PageTopBar";
import { useCountAndDuration } from "./useCountAndDuration";
import { playFrom, playRow } from "../env/playFrom";
import { OfflinePageFallback } from "../../offline/OfflinePageFallback";
import { useOfflinePage } from "../../offline/useOfflinePage";
import { clipsOffscreenCells } from "../../layout/listClipping";

const NO_TRACKS: MusicTrack[] = [];

export interface CollectionHead {
  kicker: string;
  title: string;
  artworkUrl: string | null;
  tint?: string;
  /** Une image composée (la mosaïque d'un mix) à la place d'`artworkUrl`. */
  renderArt?: (size: number) => ReactElement;
  /** Ce qui suit le compte de titres dans la méta (« 3 titres de votre bibliothèque »), selon ce qui est à soi. */
  extraMeta?: (owned: number) => string | null;
}

interface TrackCollectionPageProps {
  head: CollectionHead | null;
  tracks: readonly MusicTrack[] | undefined;
  contextId: string;
  pending: boolean;
  failed: boolean;
  notFound: string;
  onRetry: () => void;
  footer?: ReactElement | null;
  /** À côté de Lecture et Aléatoire (« garder sur cet appareil »), selon les titres montrés. */
  extra?: (tracks: readonly MusicTrack[]) => ReactElement | null;
  /** Hors ligne sans la page : ses clés de collection gardée possibles (`offlinePageRule.ts`). */
  keptKeys?: readonly string[];
}

export function TrackCollectionPage({ head, tracks: raw, contextId, pending, failed, notFound, onRetry, footer, extra, keptKeys }: TrackCollectionPageProps) {
  const { t } = useTranslation("music");
  const insets = useSafeAreaInsets();
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const { gutter, bottomInset } = usePageMetrics();
  // Le défilement de la coquille (page gardée au lancement) ; la tête de page pose elle-même sa marge du haut.
  const { scrollY, scrollProps } = useOctavePageScroll();
  const { tracks } = useOwnedTracks(raw ?? NO_TRACKS);
  const play = useCallback((index: number) => playRow(player, tracks, index, contextId), [contextId, player, tracks]);
  const meta = useCountAndDuration(tracks.length, tracks.reduce((s, x) => s + (x.durationMs ?? 0), 0));
  const owned = useMemo(() => ownedCount(tracks), [tracks]);
  const page = useOfflinePage({ data: head, isPending: pending, isError: failed }, keptKeys);

  if (page.view === "kept" || page.view === "offlineMissing") return <OfflinePageFallback keptKey={page.keptKey} />;
  if (page.view === "error") {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 60 }}>
        <ErrorState onRetry={onRetry} message={notFound} />
        <PageTopBar title="" scrollY={scrollY} threshold={9999} />
      </View>
    );
  }
  const header = (
    <View>
      {head ? (
        <CollectionHeader
          kicker={head.kicker}
          title={head.title}
          artworkUrl={head.artworkUrl}
          tint={head.tint}
          renderArt={head.renderArt}
          scrollY={scrollY}
          canPlay={tracks.length > 0}
          onPlay={() => playFrom(player, tracks, 0, contextId)}
          onShuffle={() => player && queueActions.playShuffled(player, tracks, contextId)}
          meta={<MetaLine parts={[meta, head.extraMeta?.(owned)]} />}
          extra={pending ? undefined : (extra?.(tracks) ?? undefined)}
        />
      ) : (
        <View style={{ height: insets.top + 400 }} />
      )}
      {pending ? <TrackRowsSkeleton count={8} gutter={gutter} /> : null}
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <Animated.FlatList
        data={pending ? NO_TRACKS : (tracks as MusicTrack[])}
        keyExtractor={(track) => track.key}
        renderItem={({ item, index }) => <TrackRow track={item} index={index} list={tracks} contextId={contextId} playing={current === item.key} onPlay={play} gutter={gutter} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer ?? null}
        onScroll={scrollProps.onScroll}
        scrollEventThrottle={16}
        contentOffset={scrollProps.contentOffset}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        initialNumToRender={12}
        windowSize={9}
        removeClippedSubviews={clipsOffscreenCells(Platform.OS)}
        accessibilityLabel={head?.title ?? t("common.playAll")}
      />
      <PageTopBar title={head?.title ?? ""} scrollY={scrollY} threshold={320} />
      <OctavePagesHost />
    </View>
  );
}
