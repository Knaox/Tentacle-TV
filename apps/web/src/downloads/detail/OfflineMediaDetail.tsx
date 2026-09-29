/**
 * La fiche d'un film ou d'un épisode gardé sur cette machine — la fiche en
 * scène du serveur (décor plein écran, logo, note, Lecture au dégradé), avec
 * ce que le disque sait : le DTO du snapshot réécrit à la vérité du fichier
 * (`localMediaItem`), la progression locale, les visuels posés à côté.
 *
 * Elle remplace la boîte modale qui tenait lieu de fiche : un synopsis et un
 * bouton, là où la fiche en ligne est une page. Aucune requête serveur — elle
 * se lit à l'identique en ligne et hors ligne ; la fiche complète reste à un
 * geste quand le serveur répond.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { localVersionOf } from "@tentacle-tv/offline-core";
import { resumeState } from "@tentacle-tv/shared";
import { PageTransition } from "../../components/PageTransition";
import { DetailStage } from "../../components/detail/DetailStage";
import { DetailTextColumn } from "../../components/detail/DetailTextColumn";
import { DetailPoster } from "../../components/detail/DetailPoster";
import { DetailTitle } from "../../components/detail/DetailTitle";
import { DetailScoreline } from "../../components/detail/DetailScoreline";
import { DetailMetadata } from "../../components/detail/DetailMetadata";
import { DetailOverview } from "../../components/detail/DetailOverview";
import { DetailPlaceholder } from "../../components/detail/DetailPlaceholder";
import { remainingLabel } from "../../components/detail/DetailPlayButton";
import { textCascadeDelayed } from "../../theme/motion";
import { useOfflineMode } from "../../offline/useOfflineMode";
import { DeleteDownloadModal } from "../DeleteDownloadModal";
import { formatBytes } from "../presets";
import { OfflineDeviceLine } from "./OfflineDeviceLine";
import { OfflineStageActions } from "./OfflineStageActions";
import { OfflineTitleSections } from "./OfflineTitleSections";
import { useOfflineTitle } from "./useOfflineTitle";
import { useOfflineWatchedToggle, useRemoveFromDevice } from "./useOfflineActions";
import { versionLabel } from "./offlineDetailText";

export function OfflineMediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const { t } = useTranslation(["common", "downloads", "media"]);
  const navigate = useNavigate();
  const offline = useOfflineMode();
  const local = useOfflineTitle(itemId);
  const toggleWatched = useOfflineWatchedToggle();
  const removeFromDevice = useRemoveFromDevice();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { entry, item } = local;

  // Titre retiré (ici ou depuis l'écran des téléchargements), ou lien périmé :
  // pas de page vide — retour au catalogue.
  useEffect(() => {
    if (local.ready && !entry && !removing) navigate("/", { replace: true });
  }, [local.ready, entry, removing, navigate]);

  const openSeries = useCallback(() => {
    if (local.seriesKey) navigate(`/offline/series/${encodeURIComponent(local.seriesKey)}`);
  }, [local.seriesKey, navigate]);

  const remove = useCallback(async () => {
    if (!entry) return;
    setRemoving(true);
    await removeFromDevice([entry]);
    setConfirmRemove(false);
    navigate(-1);
  }, [entry, removeFromDevice, navigate]);

  if (!local.ready || !entry || !item) {
    return <DetailPlaceholder failed={false} retrying={false} onRetry={() => undefined} />;
  }

  const resume = resumeState(item);
  const verb = resume ? t("common:resume") : t("common:play");
  const play = {
    label: verb,
    remaining: resume?.remainingMinutes != null ? remainingLabel(resume.remainingMinutes, t) : null,
    progress: resume?.progress ?? null,
    itemId: entry.itemId,
    name: item.Name,
  };

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
            <DetailTextColumn>
              <DetailTitle item={item} logoUrl={local.logoUrl} onOpenSeries={local.seriesKey ? openSeries : undefined} />
              <DetailScoreline item={item} markersEnabled={false} />
              <DetailMetadata item={item} linkGenres={false} />
              <OfflineDeviceLine parts={[versionLabel(t, localVersionOf(entry)), formatBytes(entry.bytesDone)]} />
              <DetailOverview item={item} />
              <OfflineStageActions
                play={play}
                watched={entry.played}
                onToggleWatched={() => void toggleWatched([entry.itemId], !entry.played)}
                onlineItemId={offline ? null : entry.itemId}
                onRemove={() => setConfirmRemove(true)}
                removeLabel={t("downloads:detailRemove")}
              />
            </DetailTextColumn>
          </motion.div>
        </DetailStage>

        <OfflineTitleSections
          entry={entry}
          item={item}
          people={local.people}
          siblings={local.siblings}
          onRemove={() => setConfirmRemove(true)}
        />
      </div>

      {confirmRemove && (
        <DeleteDownloadModal
          title={item.Name}
          busy={removing}
          onConfirm={() => void remove()}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </PageTransition>
  );
}
