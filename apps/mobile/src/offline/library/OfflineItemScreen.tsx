import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { localVersionOf } from "@tentacle-tv/offline-core";
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
import { ITEM_BANNER_ART, MOVIE_ART, SERIES_ART, resolveLocalArt } from "./offlineArt";
import { OfflineActionsRow } from "./OfflineActionsRow";
import { OfflineDetailShell, useOfflineDetailMetrics } from "./OfflineDetailShell";
import { OfflineItemBody } from "./OfflineItemBody";
import { OfflineStageHeader, OfflineStageRail } from "./OfflineStageHeader";
import { useLocalWatchedToggle, useRemoveFromDevice } from "./useOfflineActions";
import { useOfflineItem } from "./useOfflineItem";
import { versionText } from "./localText";

/**
 * La fiche locale d'un film ou d'un épisode gardé sur l'appareil — la fiche
 * en scène du serveur (décor sur 70 % de l'écran, bloc titre posé dedans,
 * Lecture au dégradé), nourrie par la base et le snapshot : les flux du
 * FICHIER, la progression locale, les visuels posés sur le disque. Un titre
 * retiré ou incomplet renvoie d'où l'on vient.
 */
export function OfflineItemScreen({ itemId }: { itemId: string }) {
  const { t } = useTranslation(["offline", "common", "downloads"]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metrics = useOfflineDetailMetrics();
  const offline = useOfflineMode();
  const local = useOfflineItem(itemId);
  const toggleWatched = useLocalWatchedToggle();
  const removeFromDevice = useRemoveFromDevice();
  const [more, setMore] = useState<OfflineEntry | null>(null);
  const { entry, item } = local;
  const isEpisode = entry?.kind === "episode";
  const anims = useMediaDetailAnimations(itemId, item ?? undefined, metrics.backdropH);
  const logoUri = useLocalArtworkUri(entry && !isEpisode ? itemId : undefined, "logo.png");
  const backdropUri = useMemo(() => (entry ? resolveLocalArt(itemId, ITEM_BANNER_ART) : null), [entry, itemId]);

  // Retiré (ici, depuis la feuille ou l'écran de gestion) : retour d'où l'on vient.
  useEffect(() => {
    if (local.isFetched && (!entry || entry.status !== "complete")) backOrHome(router);
  }, [local.isFetched, entry, router]);

  const play = useCallback((target: OfflineEntry) => router.push(`/watch/${target.itemId}` as never), [router]);
  const info = useCallback((target: OfflineEntry) => {
    if (target.itemId !== itemId) router.push(`/on-device/item/${target.itemId}` as never);
  }, [router, itemId]);
  const openSeries = useCallback(() => {
    if (local.seriesKey === null) return;
    router.push({
      pathname: "/on-device/series/[seriesKey]",
      params: { seriesKey: local.seriesKey, ...(local.seasonKey ? { season: local.seasonKey } : {}) },
    } as never);
  }, [router, local.seriesKey, local.seasonKey]);

  if (!entry || !item) return <DetailSkeleton top={insets.top} />;

  const cta = detailPlayCta(item, undefined, (key) => t(`common:${key}`));
  const actions = (
    <OfflineActionsRow
      watched={entry.played}
      onToggleWatched={() => toggleWatched([entry.itemId], !entry.played)}
      onRemove={() => removeFromDevice([entry], item.Name)}
      onOpenOnline={offline ? null : () => router.push(`/media/${itemId}` as never)}
    />
  );
  const stage = (onMedia: boolean) => (
    <DetailStageBlock
      item={item}
      align={onMedia ? "center" : "start"}
      tone={onMedia ? "media" : "themed"}
      logoMaxW={onMedia ? metrics.logoMaxW : 340}
      logoMaxH={onMedia ? metrics.logoMaxH : 110}
      titleStyle={anims.titleStyle}
      metaStyle={anims.metaStyle}
      logoUri={logoUri}
      markersEnabled={false}
      onOpenSeries={local.seriesKey ? openSeries : undefined}
    />
  );
  const header = { item, cta, actions, anims, deviceParts: [versionText(t, localVersionOf(entry)), formatBytes(entry.bytesDone)] };

  return (
    <>
      <OfflineDetailShell
        backdropUri={backdropUri}
        title={item.Name}
        anims={anims}
        metrics={metrics}
        stage={stage(true)}
        header={<OfflineStageHeader {...header} />}
        rail={
          <OfflineStageRail
            {...header}
            metrics={metrics}
            posterItemId={itemId}
            posterCandidates={isEpisode ? SERIES_ART : MOVIE_ART}
            stage={stage(false)}
          />
        }
        body={
          <OfflineItemBody
            entry={entry}
            item={item}
            people={local.people}
            genres={local.genres}
            siblings={local.siblings}
            seasonName={local.seasonName}
            onPlay={play}
            onMore={setMore}
          />
        }
      />
      <OfflineRowActionsSheet entry={more} onClose={() => setMore(null)} onPlay={play} onInfo={info} />
    </>
  );
}
