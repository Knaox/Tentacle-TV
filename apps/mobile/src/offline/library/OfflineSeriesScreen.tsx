import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { keptBytes, localMediaItem, localVersionOfGroup } from "@tentacle-tv/offline-core";
import { DetailSkeleton } from "@/components/detail/DetailSkeleton";
import { DetailStageBlock } from "@/components/detail/DetailStageBlock";
import { detailPlayCta } from "@/components/detail/computeBadges";
import { useLocalArtworkUri } from "@/hooks/offline/useLocalSnapshot";
import { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import type { OfflineEntry } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { OfflineRowActionsSheet } from "@/offline/manage/OfflineRowActionsSheet";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { backOrHome } from "@/utils/backOrHome";
import { BANNER_ART, SERIES_ART, resolveLocalArt } from "./offlineArt";
import { OfflineActionsRow } from "./OfflineActionsRow";
import { OfflineDetailShell, useOfflineDetailMetrics } from "./OfflineDetailShell";
import { OfflineSeriesBody } from "./OfflineSeriesBody";
import { OfflineStageHeader, OfflineStageRail } from "./OfflineStageHeader";
import { useLocalWatchedToggle, useRemoveFromDevice } from "./useOfflineActions";
import { useOfflineSeries } from "./useOfflineSeries";
import { versionText } from "./localText";

/**
 * La fiche d'une série gardée sur l'appareil — et de l'une de ses saisons, par
 * `?season=` : la scène de la fiche en ligne (décor, logo, note, faits,
 * Lecture qui vise l'épisode à reprendre), puis ses épisodes présents ici et
 * ce qu'elle occupe. Pour seule source la base et les snapshots : cet écran
 * ne touche jamais le réseau.
 */
export function OfflineSeriesScreen() {
  const { seriesKey, season: seasonParam } = useLocalSearchParams<{ seriesKey: string; season?: string }>();
  const { t } = useTranslation(["common", "downloads", "offline"]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metrics = useOfflineDetailMetrics();
  const offline = useOfflineMode();
  const local = useOfflineSeries(seriesKey, seasonParam);
  const toggleWatched = useLocalWatchedToggle();
  const removeFromDevice = useRemoveFromDevice();
  const [more, setMore] = useState<OfflineEntry | null>(null);
  const { series, seriesItem, episodes } = local;
  const anims = useMediaDetailAnimations(seriesKey ?? "", series ? seriesItem : undefined, metrics.backdropH);
  const logoUri = useLocalArtworkUri(series?.posterItemId, "logo.png");
  const backdropUri = useMemo(() => (series ? resolveLocalArt(series.posterItemId, BANNER_ART) : null), [series]);

  // Le dernier épisode retiré fait disparaître la série : retour au catalogue.
  useEffect(() => {
    if (local.isFetched && !series) backOrHome(router);
  }, [local.isFetched, series, router]);

  const play = useCallback((entry: OfflineEntry) => router.push(`/watch/${entry.itemId}` as never), [router]);
  const info = useCallback((entry: OfflineEntry) => router.push(`/on-device/item/${entry.itemId}` as never), [router]);

  if (!series || !local.season) return <DetailSkeleton top={insets.top} />;

  // La série vue en entier se relance depuis son premier épisode gardé : la
  // fiche locale n'a pas d'autre catalogue où choisir.
  const cta = local.playTarget
    ? detailPlayCta(seriesItem, { type: "next", episode: localMediaItem(null, local.playTarget) }, (key) => t(`common:${key}`))
    : { targetId: null, label: t("common:play"), progress: null, remainingMinutes: null };
  const actions = (
    <OfflineActionsRow
      watched={local.watchedAll}
      onToggleWatched={() => toggleWatched(episodes.map((episode) => episode.itemId), !local.watchedAll)}
      onRemove={() => removeFromDevice(episodes, series.seriesName)}
      onOpenOnline={offline || !series.seriesId ? null : () => router.push(`/media/${series.seriesId}` as never)}
    />
  );
  const stage = (onMedia: boolean) => (
    <DetailStageBlock
      item={seriesItem}
      align={onMedia ? "center" : "start"}
      tone={onMedia ? "media" : "themed"}
      logoMaxW={onMedia ? metrics.logoMaxW : 340}
      logoMaxH={onMedia ? metrics.logoMaxH : 110}
      titleStyle={anims.titleStyle}
      metaStyle={anims.metaStyle}
      logoUri={logoUri}
      markersEnabled={false}
    />
  );
  const header = {
    item: seriesItem,
    cta,
    actions,
    anims,
    deviceParts: [
      versionText(t, localVersionOfGroup(episodes)),
      t("common:seasonsCount", { count: series.seasons.length }),
      t("downloads:episodesCount", { count: episodes.length }),
      formatBytes(keptBytes(episodes)),
    ],
  };

  return (
    <>
      <OfflineDetailShell
        backdropUri={backdropUri}
        title={series.seriesName}
        anims={anims}
        metrics={metrics}
        stage={stage(true)}
        header={<OfflineStageHeader {...header} />}
        rail={<OfflineStageRail {...header} metrics={metrics} posterItemId={series.posterItemId} posterCandidates={SERIES_ART} stage={stage(false)} />}
        body={
          <OfflineSeriesBody
            seriesItem={seriesItem}
            allEpisodes={episodes}
            seasonCount={series.seasons.length}
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
          />
        }
      />
      <OfflineRowActionsSheet entry={more} onClose={() => setMore(null)} onPlay={play} onInfo={info} />
    </>
  );
}
