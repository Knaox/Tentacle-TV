import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useMediaItem, useSimilarItems, useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import { Navbar } from "../components/Navbar";
import { CastRow } from "../components/CastRow";
import { EpisodeList } from "../components/EpisodeList";
import { MediaCarousel } from "../components/MediaCarousel";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1 } };

export function MediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
  const { data: similar } = useSimilarItems(itemId);

  if (isLoading || !item) {
    return (
      <div className="flex h-screen items-center justify-center bg-tentacle-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    );
  }

  const isSeries = item.Type === "Series";
  const isEpisode = item.Type === "Episode";
  const backdropId = item.ParentBackdropItemId ?? item.Id;
  const backdropUrl = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 });
  const posterUrl = item.ImageTags?.Primary
    ? client.getImageUrl(item.Id, "Primary", { height: 500, quality: 90 })
    : null;

  const runtime = formatDuration(item.RunTimeTicks);
  const progress = item.UserData?.PlayedPercentage;
  const hasResume = progress != null && progress > 0 && progress < 100;

  const handlePlay = () => {
    if (isSeries) return;
    navigate(`/watch/${item.Id}`);
  };

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />

      {/* Hero backdrop — Ken Burns zoom-out + fade */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <motion.img
          src={backdropUrl} alt="" draggable={false}
          initial={{ opacity: 0, scale: 1.15 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tentacle-bg via-tentacle-bg/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-tentacle-bg/80 to-transparent" />
      </div>

      {/* Content — staggered cascade */}
      <motion.div
        className="-mt-48 relative z-10 px-4 md:px-12"
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
      >
        <div className="flex gap-8">
          {/* Poster — slide in from left */}
          {posterUrl && (
            <motion.div
              className="hidden flex-shrink-0 md:block"
              initial={{ opacity: 0, x: -40, rotateY: 12 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            >
              <img src={posterUrl} alt={item.Name}
                className="w-56 rounded-xl shadow-2xl ring-1 ring-white/10" draggable={false} />
            </motion.div>
          )}

          {/* Info column */}
          <div className="flex-1 pt-4">
            <motion.h1 variants={fadeUp} className="text-2xl font-bold text-white md:text-4xl">
              {item.Name}
            </motion.h1>

            {isEpisode && item.SeriesName && (
              <motion.p variants={fadeUp} className="mt-1 text-lg text-white/50">
                {item.SeriesName} — S{item.ParentIndexNumber}E{item.IndexNumber}
              </motion.p>
            )}

            {/* Metadata row */}
            <motion.div variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
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

            {/* Overview */}
            {item.Overview && (
              <motion.p variants={fadeUp} className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70">
                {item.Overview}
              </motion.p>
            )}

            {/* Action buttons */}
            <motion.div variants={fadeUp} className="mt-5 flex gap-3">
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
              {hasResume && !isSeries && (
                <div className="flex items-center text-sm text-white/40">
                  {t("common:percentWatched", { percent: Math.round(progress) })}
                </div>
              )}
            </motion.div>
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

      {/* Similar items */}
      {similar && similar.length > 0 && (
        <motion.div className="mt-6 pb-16" variants={fadeIn}
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}>
          <MediaCarousel title={t("common:similarTitles")} items={similar} />
        </motion.div>
      )}
    </div>
  );
}

function PlayIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}

function StarIcon() {
  return <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
}
