import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useFavorite, useToggleWatchlist, useWatchedToggle, useSeriesWatchState } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PlayIcon, HeartIcon, BookmarkIcon, CheckCircleIcon } from "../media/MediaDetailIcons";

interface DetailActionsProps {
  item: MediaItem;
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

/**
 * Primary CTA cluster on the detail page: Play (white), Favorite, Watchlist,
 * Watched. Encapsulates all mutations + the resume label logic for series.
 */
export function DetailActions({ item }: DetailActionsProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const isSeries = item.Type === "Series";
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);
  const { add: addFav, remove: removeFav } = useFavorite(item.Id);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(item.Id);
  const { markWatched, markUnwatched } = useWatchedToggle(item.Id);

  const isFavorite = item.UserData?.IsFavorite === true;
  const isInWatchlist = item.UserData?.Likes === true;
  const isWatched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const hasResume = progress != null && progress > 0 && progress < 100;

  const handlePlay = () => {
    if (isSeries) {
      const epId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
      if (epId && epId !== item.Id) navigate(`/watch/${epId}`);
      return;
    }
    navigate(`/watch/${item.Id}`);
  };

  const playLabel = (() => {
    if (isSeries) {
      if (!watchState || watchState.type === "completed") return null;
      const ep = watchState.episode;
      const epLabel = `S${String(ep.ParentIndexNumber ?? 0).padStart(2, "0")}E${String(ep.IndexNumber ?? 0).padStart(2, "0")}`;
      if (watchState.type === "continue") return `${t("common:resume")} ${epLabel}`;
      if (watchState.type === "next") return `${t("common:play")} ${epLabel}`;
      return t("common:play");
    }
    return hasResume ? t("common:resume") : t("common:play");
  })();

  return (
    <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3">
      {playLabel && (
        <motion.button
          type="button"
          onClick={handlePlay}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2.5 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition-colors duration-150 hover:bg-white/85"
        >
          <PlayIcon /> {playLabel}
        </motion.button>
      )}

      <CircleAction
        active={isFavorite}
        onClick={() => (isFavorite ? removeFav.mutate() : addFav.mutate())}
        label={isFavorite ? t("common:removeFromFavorites") : t("common:addToFavorites")}
        icon={<HeartIcon filled={isFavorite} />}
      />
      <CircleAction
        active={isInWatchlist}
        onClick={() => (isInWatchlist ? removeWatchlist.mutate() : addWatchlist.mutate())}
        label={isInWatchlist ? t("common:removeFromMyList") : t("common:addToMyList")}
        icon={<BookmarkIcon filled={isInWatchlist} />}
      />
      <CircleAction
        active={isWatched}
        onClick={() => (isWatched ? markUnwatched.mutate() : markWatched.mutate())}
        label={isWatched ? "Marquer comme non vu" : "Marquer comme vu"}
        icon={<CheckCircleIcon filled={isWatched} />}
      />

      {hasResume && !isSeries && (
        <span className="text-sm text-white/50">
          {t("common:percentWatched", { percent: Math.round(progress!) })}
        </span>
      )}
    </motion.div>
  );
}

function CircleAction({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all hover:bg-white/15 ${
        active
          ? "border-white bg-white/15 text-white"
          : "border-white/30 text-white/85"
      }`}
    >
      {icon}
    </button>
  );
}
