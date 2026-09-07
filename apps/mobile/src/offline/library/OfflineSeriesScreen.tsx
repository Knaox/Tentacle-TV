import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserId } from "@tentacle-tv/api-client";
import { DetailSkeleton } from "@/components/detail/DetailSkeleton";
import { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import { setLocalWatched, type OfflineEntry } from "@/offline/engineApi";
import { OfflineRowActionsSheet } from "@/offline/manage/OfflineRowActionsSheet";
import { backOrHome } from "@/utils/backOrHome";
import { BANNER_ART } from "./offlineArt";
import { OfflineDetailShell, useOfflineDetailMetrics } from "./OfflineDetailShell";
import { OfflineSeriesBody } from "./OfflineSeriesBody";
import { OfflineSeriesHeader } from "./OfflineSeriesHeader";
import { useOfflineSeries } from "./useOfflineSeries";

/**
 * La vue d'une série gardée sur l'appareil — et de l'une de ses saisons, par
 * `?season=` : la parité de la fiche en ligne (parallaxe, affiche, logo,
 * méta, casting, pilules, lignes d'épisodes) avec pour seule source la base
 * et les snapshots. Cet écran ne touche jamais le réseau.
 */
export function OfflineSeriesScreen() {
  const { seriesKey, season: seasonParam } = useLocalSearchParams<{ seriesKey: string; season?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const metrics = useOfflineDetailMetrics();
  const local = useOfflineSeries(seriesKey, seasonParam);
  const [more, setMore] = useState<OfflineEntry | null>(null);
  const anims = useMediaDetailAnimations(seriesKey ?? "", local.series ? local.seriesItem : undefined, metrics.backdropH);

  // Le dernier épisode retiré fait disparaître la série : retour au catalogue.
  useEffect(() => {
    if (local.isFetched && !local.series) backOrHome(router);
  }, [local.isFetched, local.series, router]);

  const play = useCallback((entry: OfflineEntry) => router.push(`/watch/${entry.itemId}` as never), [router]);
  const info = useCallback((entry: OfflineEntry) => router.push(`/on-device/item/${entry.itemId}` as never), [router]);
  const toggleWatched = useCallback((entry: OfflineEntry, played: boolean) => {
    if (userId !== null) setLocalWatched(userId, entry.itemId, played);
  }, [userId]);

  if (!local.series || !local.season) return <DetailSkeleton top={insets.top} />;

  return (
    <>
      <OfflineDetailShell
        backdropItemId={local.series.posterItemId}
        backdropCandidates={BANNER_ART}
        title={local.series.seriesName}
        anims={anims}
        metrics={metrics}
        header={
          <OfflineSeriesHeader
            series={local.series}
            seriesItem={local.seriesItem}
            sampleItem={local.sampleItem}
            playTarget={local.playTarget}
            playLabel={local.playLabel}
            watchedAll={local.watchedAll}
            metrics={metrics}
            anims={anims}
            onPlay={play}
          />
        }
        body={
          <OfflineSeriesBody
            genres={local.genres}
            overview={local.overview}
            people={local.people}
            seasonItems={local.seasonItems}
            activeSeasonKey={local.season.key}
            onSelectSeason={local.selectSeason}
            episodes={local.season.episodes}
            currentEpisodeId={local.playTarget?.itemId}
            onPlay={play}
            onMore={setMore}
            onToggleWatched={toggleWatched}
          />
        }
      />
      <OfflineRowActionsSheet entry={more} onClose={() => setMore(null)} onPlay={play} onInfo={info} />
    </>
  );
}
