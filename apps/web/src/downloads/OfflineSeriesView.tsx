/**
 * La fiche d'une SÉRIE gardée sur cette machine — la scène de la fiche en
 * ligne (décor, logo, note, faits, Lecture qui vise le bon épisode), puis ses
 * épisodes présents ici, saison par saison, et ce qu'elle occupe.
 *
 * Tout vient du disque — la page fonctionne à l'identique en ligne et hors
 * ligne, sans aucune requête serveur ; la fiche complète reste à un geste
 * quand le serveur répond.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { keptBytes, localVersionOfGroup } from "@tentacle-tv/offline-core";
import { PageTransition } from "../components/PageTransition";
import { DetailStage } from "../components/detail/DetailStage";
import { DetailPoster } from "../components/detail/DetailPoster";
import { DetailTitle } from "../components/detail/DetailTitle";
import { DetailScoreline } from "../components/detail/DetailScoreline";
import { DetailMetadata } from "../components/detail/DetailMetadata";
import { DetailOverview } from "../components/detail/DetailOverview";
import { DetailPlaceholder } from "../components/detail/DetailPlaceholder";
import { textCascadeDelayed } from "../theme/motion";
import { useOfflineMode } from "../offline/useOfflineMode";
import { DeleteDownloadModal } from "./DeleteDownloadModal";
import { formatBytes } from "./presets";
import { OfflineDeviceLine } from "./detail/OfflineDeviceLine";
import { OfflineStageActions } from "./detail/OfflineStageActions";
import { OfflineSeriesSections } from "./detail/OfflineSeriesSections";
import { useOfflineSeries } from "./detail/useOfflineSeries";
import { useOfflineWatchedToggle, useRemoveFromDevice } from "./detail/useOfflineActions";
import { versionLabel } from "./detail/offlineDetailText";
import { seriesPlayAction } from "./detail/seriesPlayAction";

export function OfflineSeriesView() {
  const { seriesKey } = useParams<{ seriesKey: string }>();
  const { t } = useTranslation(["common", "downloads"]);
  const navigate = useNavigate();
  const offline = useOfflineMode();
  const local = useOfflineSeries(seriesKey);
  const toggleWatched = useOfflineWatchedToggle();
  const removeFromDevice = useRemoveFromDevice();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { series, item, episodes } = local;

  // Le dernier épisode retiré fait disparaître la série : pas de page vide.
  useEffect(() => {
    if (local.ready && !series && !removing) navigate("/", { replace: true });
  }, [local.ready, series, removing, navigate]);

  const remove = useCallback(async () => {
    setRemoving(true);
    await removeFromDevice(episodes);
    setConfirmRemove(false);
    navigate(-1);
  }, [episodes, removeFromDevice, navigate]);

  if (!local.ready || !series || !item) {
    return <DetailPlaceholder failed={false} retrying={false} onRetry={() => undefined} />;
  }

  const allWatched = episodes.length > 0 && episodes.every((episode) => episode.played);
  const deviceParts = [
    versionLabel(t, localVersionOfGroup(episodes)),
    t("downloads:seasonsCount", { count: series.seasons.length }),
    t("downloads:episodesCount", { count: episodes.length }),
    formatBytes(keptBytes(episodes)),
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-surface-0">
        <DetailStage backdropUrl={local.backdropUrl} item={item} glowUrl={local.backdropUrl}>
          <motion.div
            className="flex items-end gap-8 px-5 pb-10 pt-28 md:px-12 md:pb-14 xl:gap-12 xl:px-16"
            initial="hidden"
            animate="show"
            variants={textCascadeDelayed}
          >
            <DetailPoster item={item} imageUrl={local.posterUrl} />
            <div className="min-w-0 max-w-4xl flex-1">
              <DetailTitle item={item} logoUrl={local.logoUrl} />
              <DetailScoreline item={item} markersEnabled={false} />
              <DetailMetadata item={item} linkGenres={false} />
              <OfflineDeviceLine parts={deviceParts} />
              <DetailOverview item={item} />
              <OfflineStageActions
                play={seriesPlayAction(t, episodes, local.playTarget)}
                watched={allWatched}
                onToggleWatched={() => void toggleWatched(episodes.map((episode) => episode.itemId), !allWatched)}
                onlineItemId={offline ? null : series.seriesId}
                onRemove={() => setConfirmRemove(true)}
                removeLabel={t("downloads:detailRemoveSeries")}
              />
            </div>
          </motion.div>
        </DetailStage>

        <OfflineSeriesSections
          series={series}
          episodes={episodes}
          item={item}
          people={local.people}
          playTarget={local.playTarget}
          onRemove={() => setConfirmRemove(true)}
        />
      </div>

      {confirmRemove && (
        <DeleteDownloadModal
          title={item.Name}
          heading={t("downloads:detailRemoveSeriesTitle", { count: episodes.length })}
          message={t("downloads:bulkDeleteConfirmMessage")}
          busy={removing}
          onConfirm={() => void remove()}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </PageTransition>
  );
}
