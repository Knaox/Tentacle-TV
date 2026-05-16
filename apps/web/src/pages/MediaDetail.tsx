import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useMediaItem, useSimilarItems, useJellyfinClient } from "@tentacle-tv/api-client";
import { CastRow } from "../components/CastRow";
import { EpisodeList } from "../components/EpisodeList";
import { MediaRow } from "../components/rows/MediaRow";
import { LicenseAttribution } from "../components/media/LicenseAttribution";
import { TechInfo } from "../components/TechInfo";
import { PageTransition } from "../components/PageTransition";
import { DetailHero } from "../components/detail/DetailHero";
import { DetailMetadata } from "../components/detail/DetailMetadata";
import { DetailOverview } from "../components/detail/DetailOverview";
import { DetailActions } from "../components/detail/DetailActions";
import { CardMetaOverlay } from "../components/media/CardMetaOverlay";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1 } };

export function MediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);

  if (isLoading || !item) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-white" />
      </div>
    );
  }

  const isSeries = item.Type === "Series";
  const hasParentBackdrop = (item.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwnBackdrop = (item.BackdropImageTags?.length ?? 0) > 0;
  const backdropId = hasParentBackdrop ? (item.ParentBackdropItemId ?? item.Id) : item.Id;
  const backdropUrl = (hasParentBackdrop || hasOwnBackdrop)
    ? client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 85 })
    : null;
  const posterUrl = item.ImageTags?.Primary
    ? client.getImageUrl(item.Id, "Primary", { height: 500, quality: 90 })
    : null;
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];

  return (
    <PageTransition>
      <div className="min-h-screen bg-surface-0">
        <DetailHero backdropUrl={backdropUrl} item={item} />

        <motion.div
          className="-mt-48 relative z-10 px-4 md:px-12"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } } }}
        >
          <div className="flex gap-4 md:gap-8">
            {posterUrl && (
              <motion.div
                className="relative flex-shrink-0 overflow-hidden rounded-md"
                initial={{ opacity: 0, x: -32 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <img
                  src={posterUrl}
                  alt={item.Name}
                  className="w-24 shadow-2xl ring-1 ring-white/10 md:w-56"
                  draggable={false}
                />
                {/* Overlay qualité + drapeaux directement sur le poster, comme
                    sur les miniatures — cohérence visuelle d'un bout à l'autre. */}
                <CardMetaOverlay item={item} />
              </motion.div>
            )}

            <div className="flex-1 pt-4">
              <motion.h1
                variants={fadeUp}
                className="text-display-3 font-bold text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)] line-clamp-2 break-words max-w-3xl md:text-display-2"
              >
                {item.Name}
              </motion.h1>
              {item.OriginalTitle && item.OriginalTitle !== item.Name && (
                <motion.p variants={fadeUp} className="mt-0.5 text-sm text-white/45">
                  {item.OriginalTitle}
                </motion.p>
              )}
              {isEpisode && item.SeriesName && (
                <motion.p variants={fadeUp} className="mt-1 text-lg text-white/60">
                  {item.SeriesName} — S{item.ParentIndexNumber}E{item.IndexNumber}
                </motion.p>
              )}

              <DetailMetadata item={item} streams={streams} />
              <DetailOverview item={item} />
              <DetailActions item={item} />

              {streams.length > 0 && (
                <motion.div variants={fadeUp}>
                  <TechInfo streams={streams} />
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {isSeries && itemId && (
          <motion.section
            className="mt-10"
            variants={fadeIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="row-gutter text-xl font-semibold text-white">{t("common:seasonsEpisodes")}</h2>
            <EpisodeList seriesId={itemId} />
          </motion.section>
        )}

        {(item.People?.length || item.Studios?.length) && (
          <motion.section
            className="mt-8"
            variants={fadeIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <CastRow people={item.People ?? []} studios={item.Studios} />
          </motion.section>
        )}

        <LicenseAttribution item={item} />

        {similar && similar.length > 0 && (
          <motion.div
            className="mt-8 pb-16"
            variants={fadeIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <MediaRow title={t("common:similarTitles")} items={similar} />
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
