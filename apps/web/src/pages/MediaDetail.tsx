import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaItem, useSimilarItems, useJellyfinClient, useFavorite, useWatchedToggle, useToggleWatchlist } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import { CastRow } from "../components/CastRow";
import { EpisodeList } from "../components/EpisodeList";
import { MediaCarousel } from "../components/MediaCarousel";
import { LicenseAttribution } from "../components/media/LicenseAttribution";
import { TechInfo } from "../components/TechInfo";
import { PlayIcon, ArrowLeftIcon, StarIcon, HeartIcon, BookmarkIcon, CheckCircleIcon, QualityBadge } from "../components/media/MediaDetailIcons";
import { PageTransition } from "../components/PageTransition";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1 } };

export function MediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  const { add: addFav, remove: removeFav } = useFavorite(itemId);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(itemId);
  const { markWatched, markUnwatched } = useWatchedToggle(itemId);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  if (isLoading || !item) {
    return (
      <div className="flex h-screen items-center justify-center bg-tentacle-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    );
  }

  const isSeries = item.Type === "Series";
  const hasParentBackdrop = (item.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwnBackdrop = (item.BackdropImageTags?.length ?? 0) > 0;
  const backdropId = hasParentBackdrop ? (item.ParentBackdropItemId ?? item.Id) : item.Id;
  const backdropUrl = (hasParentBackdrop || hasOwnBackdrop) ? client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 }) : null;
  const posterUrl = item.ImageTags?.Primary
    ? client.getImageUrl(item.Id, "Primary", { height: 500, quality: 90 })
    : null;

  const runtime = formatDuration(item.RunTimeTicks);
  const progress = item.UserData?.PlayedPercentage;
  const hasResume = progress != null && progress > 0 && progress < 100;
  const isFavorite = item.UserData?.IsFavorite === true;
  const isInWatchlist = item.UserData?.Likes === true;
  const isWatched = item.UserData?.Played === true;

  // Media stream badges
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
  const videoStream = streams.find((s) => s.Type === "Video");
  const audioStream = streams.find((s) => s.Type === "Audio");
  const is4K = videoStream && videoStream.Width != null && videoStream.Width >= 3840;
  const isHDR = videoStream?.VideoRangeType != null && videoStream.VideoRangeType !== "SDR";
  const audioChannels = audioStream?.Channels ?? 0;
  const audioLabel = audioChannels >= 8 ? "7.1" : audioChannels >= 6 ? "5.1" : null;
  const isAtmos = audioStream?.Codec != null &&
    (audioStream.Codec.includes("truehd") || audioStream.Codec.includes("eac3"));

  const handlePlay = () => {
    if (isSeries) return;
    navigate(`/watch/${item.Id}`);
  };

  const toggleFavorite = () => {
    if (isFavorite) removeFav.mutate();
    else addFav.mutate();
  };

  const toggleWatchlist = () => {
    if (isInWatchlist) removeWatchlist.mutate();
    else addWatchlist.mutate();
  };

  const toggleWatched = () => {
    if (isWatched) markUnwatched.mutate();
    else markWatched.mutate();
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-tentacle-bg">
      {/* Hero backdrop */}
      <div className="relative h-[65vh] w-full overflow-hidden">
        {/* Back button — overlaid on backdrop, top-left */}
        <button
          onClick={() => navigate(-1)}
          aria-label={t("common:back")}
          className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm text-white/80 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white"
        >
          <ArrowLeftIcon />
          {t("common:back")}
        </button>
        {backdropUrl && (
          <motion.img
            src={backdropUrl} alt="" draggable={false}
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="absolute inset-0 h-full w-full object-cover animate-ken-burns"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-tentacle-bg via-tentacle-bg/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-tentacle-bg/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-tentacle-bg/40 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <motion.div
        className="-mt-48 relative z-10 px-4 md:px-12"
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
      >
        <div className="flex gap-4 md:gap-8">
          {/* Poster — visible on all sizes */}
          {posterUrl && (
            <motion.div
              className="flex-shrink-0"
              initial={{ opacity: 0, x: -40, rotateY: 12 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              whileHover={{ rotateY: 5, scale: 1.02 }}
              style={{ perspective: 800 }}
            >
              <img src={posterUrl} alt={item.Name}
                className="w-24 rounded-xl shadow-2xl ring-1 ring-white/10 md:w-64" draggable={false} />
            </motion.div>
          )}

          {/* Info column */}
          <div className="flex-1 pt-4">
            <motion.h1 variants={fadeUp} className="text-3xl font-bold text-white md:text-5xl"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              {item.Name}
            </motion.h1>

            {/* Original title */}
            {item.OriginalTitle && item.OriginalTitle !== item.Name && (
              <motion.p variants={fadeUp} className="mt-0.5 text-sm text-white/40">
                {item.OriginalTitle}
              </motion.p>
            )}

            {isEpisode && item.SeriesName && (
              <motion.p variants={fadeUp} className="mt-1 text-lg text-white/50">
                {item.SeriesName} — S{item.ParentIndexNumber}E{item.IndexNumber}
              </motion.p>
            )}

            {/* Metadata row + quality badges */}
            <motion.div variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/60">
              {item.ProductionYear && <span>{item.ProductionYear}</span>}
              {item.OfficialRating && (
                <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs">{item.OfficialRating}</span>
              )}
              {item.CommunityRating && (
                <span className="flex items-center gap-1"><StarIcon /> {item.CommunityRating.toFixed(1)}</span>
              )}
              {runtime && <span>{runtime}</span>}
              {isSeries && item.ChildCount && <span>{item.ChildCount} {t("common:seasons")}</span>}
              {isSeries && item.Status && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
                  {item.Status === "Continuing" ? t("common:ongoing") : t("common:ended")}
                </span>
              )}
              {is4K && <QualityBadge label="4K" />}
              {isHDR && <QualityBadge label="HDR" />}
              {audioLabel && <QualityBadge label={audioLabel} />}
              {isAtmos && <QualityBadge label="Atmos" />}
            </motion.div>

            {/* Genres */}
            {item.Genres && item.Genres.length > 0 && (
              <motion.div variants={fadeUp} className="mt-3 flex flex-wrap gap-2">
                {item.Genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">{g}</span>
                ))}
              </motion.div>
            )}

            {/* Tagline */}
            {item.Taglines?.[0] && (
              <motion.p variants={fadeUp} className="mt-4 text-sm italic text-white/40">
                « {item.Taglines[0]} »
              </motion.p>
            )}

            {/* Overview with truncation */}
            {item.Overview && (
              <motion.div variants={fadeUp} className="mt-3 max-w-3xl">
                <motion.div layout transition={{ duration: 0.3, ease: "easeInOut" }}>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={overviewExpanded ? "full" : "clamped"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`text-sm leading-relaxed text-white/70 ${!overviewExpanded ? "line-clamp-3" : ""}`}
                    >
                      {item.Overview}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
                {item.Overview.length > 200 && (
                  <button
                    onClick={() => setOverviewExpanded((p) => !p)}
                    className="mt-1 text-xs text-purple-400 hover:text-purple-300"
                  >
                    {overviewExpanded ? t("common:showLess") : t("common:showMore")}
                  </button>
                )}
              </motion.div>
            )}

            {/* Action buttons */}
            <motion.div variants={fadeUp} className="mt-5 flex items-center gap-3">
              {!isSeries && (
                <motion.button
                  onClick={handlePlay}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 font-semibold text-tentacle-bg shadow-lg shadow-white/10"
                >
                  <PlayIcon /> {hasResume ? t("common:resume") : t("common:play")}
                </motion.button>
              )}

              {/* Favorite button */}
              <button
                onClick={toggleFavorite}
                aria-label={isFavorite ? t("common:removeFromFavorites") : t("common:addToFavorites")}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <HeartIcon filled={isFavorite} />
              </button>

              {/* Watchlist button */}
              <button
                onClick={toggleWatchlist}
                aria-label={isInWatchlist ? t("common:removeFromMyList") : t("common:addToMyList")}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <BookmarkIcon filled={isInWatchlist} />
              </button>

              {/* Watched button */}
              <button
                onClick={toggleWatched}
                aria-label={isWatched ? "Mark as unwatched" : "Mark as watched"}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <CheckCircleIcon filled={isWatched} />
              </button>

              {hasResume && !isSeries && (
                <div className="flex items-center text-sm text-white/40">
                  {t("common:percentWatched", { percent: Math.round(progress) })}
                </div>
              )}
            </motion.div>

            {/* Tech info */}
            {streams.length > 0 && (
              <motion.div variants={fadeUp}>
                <TechInfo streams={streams} />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Episodes */}
      {isSeries && itemId && (
        <motion.div className="mt-8" variants={fadeIn}
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}>
          <h2 className="px-4 text-xl font-semibold text-white md:px-12">{t("common:seasonsEpisodes")}</h2>
          <EpisodeList seriesId={itemId} />
        </motion.div>
      )}

      {/* Credits & Cast */}
      {(item.People?.length || item.Studios?.length) && (
        <motion.div className="mt-6" variants={fadeIn}
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}>
          <CastRow people={item.People ?? []} studios={item.Studios} />
        </motion.div>
      )}

      <LicenseAttribution item={item} />

      {/* Similar items */}
      {similar && similar.length > 0 && (
        <motion.div className="mt-6 pb-16" variants={fadeIn}
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}>
          <MediaCarousel title={t("common:similarTitles")} items={similar} />
        </motion.div>
      )}
    </div>
    </PageTransition>
  );
}
